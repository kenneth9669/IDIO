import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserRole, ProfileRow } from '../types/database';
import { requireAuth, requireRole, requireAdmin, requireCustomer, getAuthenticatedUser, AuthenticatedContext } from '../lib/auth';
import { validateRole, validateOwnershipOrAdmin } from '../lib/domainService';
import { signUpCustomerAction, updateCustomerProfileAction, updateUserRoleAction } from '../app/actions/authActions';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn()
}));

vi.mock('@clerk/nextjs/server', () => ({
  currentUser: vi.fn()
}));

import { currentUser } from '@clerk/nextjs/server';

// Mock user profiles
const mockAdminProfile: ProfileRow = {
  id: 'a1111111-1111-1111-1111-111111111111',
  role: 'ADMIN',
  full_name: 'Dave Admin (Owner)',
  email: 'admin@idiocameras.ph',
  phone: '0917-842-1099',
  avatar_url: null,
  barangay: 'Libertad',
  street_address: 'Purok 3, J.C. Aquino Highway',
  city: 'Butuan City',
  province: 'Agusan del Norte',
  id_type: "Driver's License",
  id_number: 'K02-18-094123',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

const mockCustomerProfile: ProfileRow = {
  id: 'c3333333-3333-3333-3333-333333333333',
  role: 'CUSTOMER',
  full_name: 'Jennelyn Photographer',
  email: 'jennelyn.creates@gmail.com',
  phone: '0919-334-8877',
  avatar_url: null,
  barangay: 'Ampayon',
  street_address: 'Purok 5, Near Caraga State University',
  city: 'Butuan City',
  province: 'Agusan del Norte',
  id_type: 'UMID',
  id_number: 'CRN-0111-9876543-2',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

// Mock Supabase Server Client
vi.mock('../lib/supabase/server', () => {
  return {
    createClient: vi.fn()
  };
});

import { createClient } from '../lib/supabase/server';

describe('Phase 3: Supabase Authentication & Server-Side RBAC Infrastructure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Unauthenticated Access Protection', () => {
    it('denies access when no Supabase session / user is present', async () => {
      vi.mocked(createClient).mockResolvedValueOnce({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null })
        },
        from: vi.fn()
      } as any);

      await expect(requireAuth()).rejects.toThrow('Unauthorized: Authentication required.');
    });

    it('denies access when auth token is expired or invalid', async () => {
      vi.mocked(createClient).mockResolvedValueOnce({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error('JWT expired') })
        },
        from: vi.fn()
      } as any);

      await expect(requireAuth()).rejects.toThrow('Unauthorized: Authentication required.');
    });
  });

  describe('2. CUSTOMER Authentication & Authorization', () => {
    beforeEach(() => {
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: mockCustomerProfile.id, email: mockCustomerProfile.email } },
            error: null
          })
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockCustomerProfile, error: null })
            })
          })
        })
      } as any);
    });

    it('successfully authenticates CUSTOMER and retrieves database profile', async () => {
      const authContext = await requireAuth();
      expect(authContext.user.id).toBe(mockCustomerProfile.id);
      expect(authContext.role).toBe('CUSTOMER');
      expect(authContext.profile.full_name).toBe('Jennelyn Photographer');
    });

    it('allows CUSTOMER to access customer-scoped functionality', async () => {
      const authContext = await requireCustomer();
      expect(authContext.role).toBe('CUSTOMER');
    });

    it('STRICTLY PREVENTS CUSTOMER from accessing ADMIN functionality (Server-Side 403)', async () => {
      await expect(requireAdmin()).rejects.toThrow(
        "Forbidden: Role 'CUSTOMER' is not authorized to access this resource. Required: ADMIN."
      );
    });
  });

  describe('3. ADMIN Authentication & Authorization', () => {
    beforeEach(() => {
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: mockAdminProfile.id, email: mockAdminProfile.email } },
            error: null
          })
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockAdminProfile, error: null })
            })
          })
        })
      } as any);
    });

    it('successfully authenticates ADMIN with verified database profile', async () => {
      const authContext = await requireAuth();
      expect(authContext.user.id).toBe(mockAdminProfile.id);
      expect(authContext.role).toBe('ADMIN');
      expect(authContext.profile.email).toBe('admin@idiocameras.ph');
    });

    it('allows ADMIN to access admin-scoped operations', async () => {
      const authContext = await requireAdmin();
      expect(authContext.role).toBe('ADMIN');
    });
  });

  describe('4. Protection Against Client-Side Role Tampering', () => {
    it('rejects client attempting to forge role as ADMIN when database profile is CUSTOMER', async () => {
      // Simulate client forging local state to say 'ADMIN' while Supabase auth/DB says 'CUSTOMER'
      vi.mocked(createClient).mockResolvedValueOnce({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: mockCustomerProfile.id, email: mockCustomerProfile.email } },
            error: null
          })
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { ...mockCustomerProfile, role: 'CUSTOMER' },
                error: null
              })
            })
          })
        })
      } as any);

      // Even if client claims to be ADMIN, requireAdmin verifies from DB and throws Forbidden
      await expect(requireAdmin()).rejects.toThrow(/Forbidden: Role 'CUSTOMER' is not authorized/);
    });

    it('rejects unexpected / invalid / non-existent user roles (e.g. legacy STAFF or forged roles)', async () => {
      vi.mocked(createClient).mockResolvedValueOnce({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'unknown-id', email: 'forged@hack.test' } },
            error: null
          })
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { ...mockCustomerProfile, role: 'STAFF' }, // Disallowed role
                error: null
              })
            })
          })
        })
      } as any);

      await expect(requireAuth()).rejects.toThrow('Unauthorized: Authentication required.');
    });
  });

  describe('5. RLS Policy Compatibility & Ownership Checks', () => {
    const customerUser = {
      id: mockCustomerProfile.id,
      name: mockCustomerProfile.full_name,
      email: mockCustomerProfile.email,
      phone: mockCustomerProfile.phone,
      role: 'CUSTOMER' as UserRole,
      barangay: mockCustomerProfile.barangay,
      streetAddress: mockCustomerProfile.street_address,
      city: mockCustomerProfile.city,
      province: mockCustomerProfile.province,
      idType: mockCustomerProfile.id_type,
      idNumber: mockCustomerProfile.id_number
    };

    const adminUser = {
      id: mockAdminProfile.id,
      name: mockAdminProfile.full_name,
      email: mockAdminProfile.email,
      phone: mockAdminProfile.phone,
      role: 'ADMIN' as UserRole,
      barangay: mockAdminProfile.barangay,
      streetAddress: mockAdminProfile.street_address,
      city: mockAdminProfile.city,
      province: mockAdminProfile.province,
      idType: mockAdminProfile.id_type,
      idNumber: mockAdminProfile.id_number
    };

    it('permits Customer to access their own resource and denies access to others', () => {
      // Own resource
      const ownCheck = validateOwnershipOrAdmin(customerUser, customerUser.id, 'View My Bookings');
      expect(ownCheck.success).toBe(true);

      // Foreign resource
      const foreignCheck = validateOwnershipOrAdmin(customerUser, 'c4444444-4444-4444-4444-444444444444', 'Modify Foreign Booking');
      expect(foreignCheck.success).toBe(false);
      expect(foreignCheck.message).toContain('Access Denied');
    });

    it('permits Admin to access any resource by elevated administrative privilege', () => {
      const adminOverride = validateOwnershipOrAdmin(adminUser, customerUser.id, 'Inspect Rental Handover');
      expect(adminOverride.success).toBe(true);
      expect(adminOverride.message).toContain('Authorized (Elevated Role)');
    });
  });

  describe('6. SEC-01 Profile Role Escalation Protections (Unit & Workflow Tests)', () => {
    // Note: These unit tests exercise the Node.js server actions, server RBAC guards, and fail-closed logic.
    // Live database triggers (trg_protect_profile_role) and PostgreSQL RLS policies operate at the PostgreSQL engine level
    // and require live database execution with superuser permissions, which is verified via SQL static analysis.

    it('permits legitimate customer registration and assigns strictly CUSTOMER role', async () => {
      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          signUp: vi.fn().mockResolvedValue({
            data: { user: { id: 'new-user-123', email: 'customer.new@gmail.com' } },
            error: null
          })
        },
        from: vi.fn().mockReturnValue({
          insert: mockInsert
        })
      } as any);

      const result = await signUpCustomerAction({
        email: 'customer.new@gmail.com',
        password: 'securepassword123',
        fullName: 'New Customer',
        phone: '0917-123-4567',
        barangay: 'Libertad',
        streetAddress: 'Purok 1',
        idType: 'PhilSys ID',
        idNumber: '1234-5678-9012'
      });

      expect(result.success).toBe(true);
      expect(result.role).toBe('CUSTOMER');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'CUSTOMER',
          email: 'customer.new@gmail.com'
        })
      );
    });

    it('rejects customer attempting to create an ADMIN profile during registration', async () => {
      const maliciousPayload = {
        email: 'attacker@gmail.com',
        password: 'password123',
        fullName: 'Attacker Attempting Escalation',
        phone: '0917-000-0000',
        barangay: 'Libertad',
        streetAddress: 'Street 1',
        idType: 'Driver License',
        idNumber: 'D123',
        role: 'ADMIN'
      } as any;
      const result = await signUpCustomerAction(maliciousPayload);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Unauthorized');
    });

    it('rejects customer attempting to change their own role from CUSTOMER to ADMIN via profile update', async () => {
      // Mock authenticated session as CUSTOMER
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: mockCustomerProfile.id, email: mockCustomerProfile.email } },
            error: null
          })
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockCustomerProfile, error: null })
            })
          })
        })
      } as any);

      const updateResult = await updateCustomerProfileAction({
        fullName: 'Jennelyn Updated',
        role: 'ADMIN' // Malicious attempt to escalate role
      });

      expect(updateResult.success).toBe(false);
      expect(updateResult.message).toContain('Unauthorized: Role cannot be modified through profile update.');
    });

    it('allows customer to update non-privileged profile information without mutating role', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null })
      });

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: mockCustomerProfile.id, email: mockCustomerProfile.email } },
            error: null
          })
        },
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'profiles') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockCustomerProfile, error: null })
                })
              }),
              update: mockUpdate
            };
          }
          return {} as any;
        })
      } as any);

      const updateResult = await updateCustomerProfileAction({
        phone: '0919-999-8888',
        barangay: 'San Vicente'
      });

      expect(updateResult.success).toBe(true);
      expect(updateResult.role).toBe('CUSTOMER');
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.not.objectContaining({ role: expect.anything() })
      );
    });

    it('strictly forbids a customer from updating another user role via administrative action', async () => {
      // Authenticated as CUSTOMER
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: mockCustomerProfile.id, email: mockCustomerProfile.email } },
            error: null
          })
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockCustomerProfile, error: null })
            })
          })
        })
      } as any);

      // Customer attempts to call administrative role update
      await expect(
        updateUserRoleAction(mockCustomerProfile.id, 'ADMIN')
      ).rejects.toThrow(/Forbidden: Role 'CUSTOMER' is not authorized/);
    });

    it('forbids unauthenticated caller from executing role management', async () => {
      // Unauthenticated
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null })
        },
        from: vi.fn()
      } as any);
      vi.mocked(currentUser).mockResolvedValue(null);

      await expect(
        updateUserRoleAction('any-user-id', 'ADMIN')
      ).rejects.toThrow('Unauthorized: Authentication required.');
    });

    it('allows verified administrator to update a customer role through authorized workflow', async () => {
      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null })
      });

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: mockAdminProfile.id, email: mockAdminProfile.email } },
            error: null
          })
        },
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'profiles') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockAdminProfile, error: null })
                })
              }),
              update: mockUpdate
            };
          }
          return {} as any;
        })
      } as any);

      const result = await updateUserRoleAction(mockCustomerProfile.id, 'ADMIN');

      expect(result.success).toBe(true);
      expect(result.role).toBe('ADMIN');
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'ADMIN' })
      );
    });

    it('prevents an active administrator from accidentally demoting their own account', async () => {
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: mockAdminProfile.id, email: mockAdminProfile.email } },
            error: null
          })
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockAdminProfile, error: null })
            })
          })
        })
      } as any);

      const result = await updateUserRoleAction(mockAdminProfile.id, 'CUSTOMER');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Cannot demote the currently authenticated active administrator');
    });

    it('rejects assigning invalid/disallowed roles (such as legacy STAFF)', async () => {
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: mockAdminProfile.id, email: mockAdminProfile.email } },
            error: null
          })
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockAdminProfile, error: null })
            })
          })
        })
      } as any);

      const result = await updateUserRoleAction(mockCustomerProfile.id, 'STAFF' as any);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Permitted roles are strictly CUSTOMER or ADMIN.');
    });

    it('fails closed when a Clerk session matches an ADMIN profile email but has mismatched clerk_id', async () => {
      // Supabase auth returns null so Clerk session is used
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null })
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  ...mockAdminProfile,
                  clerk_id: 'clerk_legit_admin_id'
                }
              })
            })
          })
        })
      } as any);

      // Incoming Clerk user presenting admin's email from an unlinked account
      vi.mocked(currentUser).mockResolvedValue({
        id: 'clerk_attacker_id_999',
        emailAddresses: [{ emailAddress: mockAdminProfile.email }],
        firstName: 'Attacker',
        lastName: 'Clerk'
      } as any);

      const authContext = await getAuthenticatedUser();

      expect(authContext).not.toBeNull();
      // MUST NOT be elevated to ADMIN
      expect(authContext?.role).toBe('CUSTOMER');
    });

    it('allows Clerk session with explicitly matched clerk_id to receive ADMIN role', async () => {
      const verifiedClerkId = 'clerk_legit_admin_123';

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null })
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            or: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  ...mockAdminProfile,
                  clerk_id: verifiedClerkId
                }
              })
            })
          })
        })
      } as any);

      vi.mocked(currentUser).mockResolvedValue({
        id: verifiedClerkId,
        emailAddresses: [{ emailAddress: mockAdminProfile.email }],
        firstName: 'Dave',
        lastName: 'Admin'
      } as any);

      const authContext = await getAuthenticatedUser();

      expect(authContext).not.toBeNull();
      expect(authContext?.role).toBe('ADMIN');
    });
  });
});
