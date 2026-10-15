import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deriveDeterministicUuid, syncCurrentClerkUser } from '../lib/clerkSync';
import { getAuthenticatedUser, requireAuth, requireAdmin } from '../lib/auth';
import { createClient } from '../lib/supabase/server';
import { ProfileRow } from '../types/database';
import { validateOwnershipOrAdmin } from '../lib/domainService';

// Mock @clerk/nextjs/server
vi.mock('@clerk/nextjs/server', () => {
  return {
    currentUser: vi.fn(),
    auth: vi.fn()
  };
});

// Mock @supabase/ssr
vi.mock('@supabase/ssr', () => {
  return {
    createServerClient: vi.fn((url, key, options) => {
      return {
        url,
        key,
        options,
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null })
        },
        from: vi.fn()
      };
    })
  };
});

// Mock next/headers
vi.mock('next/headers', () => {
  return {
    cookies: vi.fn().mockResolvedValue({
      getAll: vi.fn().mockReturnValue([]),
      set: vi.fn()
    })
  };
});

import { currentUser, auth } from '@clerk/nextjs/server';
import { createServerClient } from '@supabase/ssr';

describe('Phase 4: SEC-02 Clerk-Supabase Identity Mapping & Token Bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. UUID Syntax & Deterministic Identity Derivation', () => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    it('derives valid, syntactically correct UUID format from Clerk user ID', () => {
      const clerkId = 'user_2bF89xKL34ABCDEF1234567890';
      const uuid = deriveDeterministicUuid(clerkId);

      expect(uuid).toMatch(uuidRegex);
      expect(uuid).toHaveLength(36);
    });

    it('produces deterministic output for identical Clerk user IDs', () => {
      const clerkId = 'user_2bF89xKL34ABCDEF1234567890';
      const uuid1 = deriveDeterministicUuid(clerkId);
      const uuid2 = deriveDeterministicUuid(clerkId);

      expect(uuid1).toBe(uuid2);
    });

    it('produces distinct UUIDs for different Clerk user IDs', () => {
      const uuidA = deriveDeterministicUuid('user_alpha_123');
      const uuidB = deriveDeterministicUuid('user_beta_456');

      expect(uuidA).not.toBe(uuidB);
      expect(uuidA).toMatch(uuidRegex);
      expect(uuidB).toMatch(uuidRegex);
    });
  });

  describe('2. Supabase Server Client Token Forwarding', () => {
    it('attaches Bearer token to Supabase global headers when Clerk JWT is available', async () => {
      const mockToken = 'mock_clerk_jwt_token_header_payload_sig';
      vi.mocked(auth).mockResolvedValueOnce({
        getToken: vi.fn().mockResolvedValue(mockToken)
      } as any);

      await createClient();

      expect(createServerClient).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          global: {
            headers: {
              Authorization: `Bearer ${mockToken}`
            }
          }
        })
      );
    });

    it('omits Authorization header gracefully when Clerk token is not present', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        getToken: vi.fn().mockResolvedValue(null)
      } as any);

      await createClient();

      expect(createServerClient).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          global: {
            headers: {}
          }
        })
      );
    });

    it('handles Clerk auth() throwing an error gracefully and continues without token', async () => {
      vi.mocked(auth).mockRejectedValueOnce(new Error('Clerk context missing'));

      await createClient();

      expect(createServerClient).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          global: {
            headers: {}
          }
        })
      );
    });

    it('throws an error when requireAuth: true is specified and Clerk token is missing', async () => {
      vi.mocked(auth).mockResolvedValueOnce({
        userId: 'user_123',
        getToken: vi.fn().mockResolvedValue(null)
      } as any);

      await expect(createClient({ requireAuth: true })).rejects.toThrow(
        /Unauthorized: Valid authenticated session token required/
      );
    });

    it('succeeds when requireAuth: true is specified and Clerk token is available', async () => {
      const mockToken = 'valid_clerk_token_third_party';
      vi.mocked(auth).mockResolvedValueOnce({
        userId: 'user_123',
        getToken: vi.fn().mockResolvedValue(mockToken)
      } as any);

      const client = await createClient({ requireAuth: true });
      expect(client).toBeDefined();
      expect(createServerClient).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          global: {
            headers: {
              Authorization: `Bearer ${mockToken}`
            }
          }
        })
      );
    });

    it('calls native authObj.getToken() with no arguments for Supabase Third-Party Auth', async () => {
      const mockToken = 'native_third_party_token';
      const mockGetToken = vi.fn().mockResolvedValue(mockToken);

      vi.mocked(auth).mockResolvedValueOnce({
        userId: 'user_native',
        getToken: mockGetToken
      } as any);

      await createClient();

      expect(mockGetToken).toHaveBeenCalledWith();
      expect(createServerClient).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          global: {
            headers: {
              Authorization: `Bearer ${mockToken}`
            }
          }
        })
      );
    });
  });

  describe('3. Clerk Identity-to-Profile Resolution & Data Isolation', () => {
    const mockCustomerProfile: ProfileRow = {
      id: 'c3333333-3333-3333-3333-333333333333',
      clerk_id: 'user_clerk_customer_01',
      role: 'CUSTOMER',
      full_name: 'Jennelyn Customer',
      email: 'jennelyn@customer.ph',
      phone: '0919-334-8877',
      avatar_url: null,
      barangay: 'Ampayon',
      street_address: 'Purok 5',
      city: 'Butuan City',
      province: 'Agusan del Norte',
      id_type: 'UMID',
      id_number: 'CRN-0111-9876543-2',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    it('resolves authenticated Clerk user to their persisted database profile and UUID', async () => {
      vi.mocked(currentUser).mockResolvedValueOnce({
        id: 'user_clerk_customer_01',
        emailAddresses: [{ emailAddress: 'jennelyn@customer.ph' }],
        firstName: 'Jennelyn',
        lastName: 'Customer'
      } as any);

      // Mock createServerClient behavior inside createClient
      vi.mocked(createServerClient).mockReturnValueOnce({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null })
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: mockCustomerProfile, error: null })
            })
          })
        })
      } as any);

      const authContext = await getAuthenticatedUser();

      expect(authContext).not.toBeNull();
      expect(authContext?.user.id).toBe(mockCustomerProfile.id);
      expect(authContext?.profile.id).toBe(mockCustomerProfile.id);
      expect(authContext?.role).toBe('CUSTOMER');
    });

    it('guarantees UUID format even when profile is not yet persisted in database', async () => {
      vi.mocked(currentUser).mockResolvedValueOnce({
        id: 'user_brand_new_clerk_02',
        emailAddresses: [{ emailAddress: 'new@clerk.com' }],
        firstName: 'Brand',
        lastName: 'New'
      } as any);

      // Database returns null profile and sync insert fails (e.g. offline/pending migration)
      vi.mocked(createServerClient).mockReturnValueOnce({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null })
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
            })
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: new Error('Pending migration') })
            })
          })
        })
      } as any);

      const authContext = await getAuthenticatedUser();

      expect(authContext).not.toBeNull();
      // MUST be a valid UUID, NOT 'user_brand_new_clerk_02'
      expect(authContext?.user.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(authContext?.role).toBe('CUSTOMER');
    });

    it('rejects unauthenticated caller attempting to invoke requireAuth', async () => {
      vi.mocked(currentUser).mockResolvedValueOnce(null);
      vi.mocked(createServerClient).mockReturnValueOnce({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null })
        },
        from: vi.fn()
      } as any);

      await expect(requireAuth()).rejects.toThrow('Unauthorized: Authentication required.');
    });

    it('prevents customer from accessing another customer records via ownership checks', () => {
      const activeCustomer = {
        id: mockCustomerProfile.id,
        name: mockCustomerProfile.full_name,
        email: mockCustomerProfile.email,
        phone: mockCustomerProfile.phone,
        role: 'CUSTOMER' as const,
        barangay: mockCustomerProfile.barangay,
        streetAddress: mockCustomerProfile.street_address,
        city: mockCustomerProfile.city,
        province: mockCustomerProfile.province,
        idType: mockCustomerProfile.id_type,
        idNumber: mockCustomerProfile.id_number
      };

      const foreignCustomerId = 'd9999999-9999-9999-9999-999999999999';

      const ownResult = validateOwnershipOrAdmin(activeCustomer, activeCustomer.id, 'View Booking');
      expect(ownResult.success).toBe(true);

      const foreignResult = validateOwnershipOrAdmin(activeCustomer, foreignCustomerId, 'View Foreign Booking');
      expect(foreignResult.success).toBe(false);
      expect(foreignResult.message).toContain('Access Denied');
    });

    it('prevents Clerk customer from executing administrative actions (Server-Side 403)', async () => {
      vi.mocked(currentUser).mockResolvedValueOnce({
        id: 'user_clerk_customer_01',
        emailAddresses: [{ emailAddress: 'jennelyn@customer.ph' }]
      } as any);

      vi.mocked(createServerClient).mockReturnValueOnce({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null })
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: mockCustomerProfile, error: null })
            })
          })
        })
      } as any);

      await expect(requireAdmin()).rejects.toThrow(/Forbidden: Role 'CUSTOMER' is not authorized/);
    });
  });

  describe('4. Profile Synchronization Invariants', () => {
    it('syncCurrentClerkUser generates valid UUID primary key and enforces role = CUSTOMER', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'e5555555-5555-5555-5555-555555555555',
              clerk_id: 'user_sync_test_01',
              role: 'CUSTOMER'
            },
            error: null
          })
        })
      });

      vi.mocked(currentUser).mockResolvedValueOnce({
        id: 'user_sync_test_01',
        emailAddresses: [{ emailAddress: 'sync@test.com' }],
        firstName: 'Sync',
        lastName: 'Test',
        phoneNumbers: [{ phoneNumber: '0917-555-0199' }]
      } as any);

      vi.mocked(createServerClient).mockReturnValueOnce({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null })
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
              })
            })
          }),
          insert: mockInsert
        })
      } as any);

      const profile = await syncCurrentClerkUser();

      expect(profile).not.toBeNull();
      expect(profile?.role).toBe('CUSTOMER');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
          clerk_id: 'user_sync_test_01',
          role: 'CUSTOMER'
        })
      );
    });
  });
});
