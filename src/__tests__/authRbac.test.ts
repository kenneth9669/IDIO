import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserRole, ProfileRow } from '../types/database';
import { requireAuth, requireRole, requireAdmin, requireCustomer, AuthenticatedContext } from '../lib/auth';
import { validateRole, validateOwnershipOrAdmin } from '../lib/domainService';

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
});
