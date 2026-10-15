import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signInAction, signOutAction } from '../app/actions/authActions';
import { getAuthenticatedUser, requireAdmin, requireAuth } from '../lib/auth';
import { updateSession } from '../lib/supabase/middleware';
import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

// Mock Supabase Server Client
vi.mock('../lib/supabase/server', () => {
  return {
    createClient: vi.fn()
  };
});

// Mock next/cache revalidatePath
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn()
}));

// Mock @clerk/nextjs/server
vi.mock('@clerk/nextjs/server', () => ({
  currentUser: vi.fn().mockResolvedValue(null)
}));

import { createClient } from '../lib/supabase/server';

const mockCustomerProfile = {
  id: 'c3333333-3333-3333-3333-333333333333',
  role: 'CUSTOMER',
  full_name: 'Jennelyn Photographer',
  email: 'customer@example.com',
  phone: '0919-334-8877',
  barangay: 'Ampayon',
  city: 'Butuan City',
  province: 'Agusan del Norte'
};

const mockAdminProfile = {
  id: 'a1111111-1111-1111-1111-111111111111',
  role: 'ADMIN',
  full_name: 'Dave Admin (Owner)',
  email: 'admin@idiocameras.ph',
  phone: '0917-842-1099',
  barangay: 'Libertad',
  city: 'Butuan City',
  province: 'Agusan del Norte'
};

function setupMockSupabaseAuth({
  user = null as any,
  profile = null as any,
  authError = null as any,
  profileError = null as any
}: {
  user?: any;
  profile?: any;
  authError?: any;
  profileError?: any;
} = {}) {
  const mockClient = {
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({
        data: user ? { user, session: { access_token: 'fake-token' } } : { user: null, session: null },
        error: authError
      }),
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: authError
      }),
      signOut: vi.fn().mockResolvedValue({
        error: null
      })
    },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: profile,
                error: profileError
              }),
              maybeSingle: vi.fn().mockResolvedValue({
                data: profile,
                error: profileError
              })
            }),
            or: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: profile,
                error: profileError
              })
            })
          })
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [], error: null })
      };
    })
  };

  (createClient as any).mockResolvedValue(mockClient);
  return mockClient;
}

describe('Unified Login & Automatic Role Detection Test Suite (10 Scenarios)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Scenario 1: Customer logs in through unified login and role is detected as CUSTOMER
  it('Scenario 1: Customer logs in through unified login and automatically receives CUSTOMER role', async () => {
    setupMockSupabaseAuth({
      user: { id: mockCustomerProfile.id, email: mockCustomerProfile.email },
      profile: mockCustomerProfile
    });

    const result = await signInAction({
      email: 'customer@example.com',
      password: 'validpassword123'
    });

    expect(result.success).toBe(true);
    expect(result.role).toBe('CUSTOMER');
    expect(result.userId).toBe(mockCustomerProfile.id);
  });

  // Scenario 2: Admin logs in through the same unified action and receives ADMIN role
  it('Scenario 2: Admin logs in through the unified login and automatically receives ADMIN role', async () => {
    setupMockSupabaseAuth({
      user: { id: mockAdminProfile.id, email: mockAdminProfile.email },
      profile: mockAdminProfile
    });

    const result = await signInAction({
      email: 'admin@idiocameras.ph',
      password: 'adminpassword123'
    });

    expect(result.success).toBe(true);
    expect(result.role).toBe('ADMIN');
    expect(result.userId).toBe(mockAdminProfile.id);
  });

  // Scenario 3: Neither user sees or needs a separate login option in login/page.tsx
  it('Scenario 3: Unified login page source has no separate customer/admin tabs or selection buttons', () => {
    const loginPagePath = path.join(process.cwd(), 'src/app/login/page.tsx');
    const loginPageContent = fs.readFileSync(loginPagePath, 'utf8');

    // Confirm tabs or selection screens are completely removed
    expect(loginPageContent).not.toContain("activeTab === 'ADMIN'");
    expect(loginPageContent).not.toContain("activeTab === 'CUSTOMER'");
    expect(loginPageContent).not.toContain('Customer Portal');
    expect(loginPageContent).not.toContain('Admin Desk');
    expect(loginPageContent).not.toContain('Sign in as Administrator');
    expect(loginPageContent).not.toContain('Sign in as Customer');

    // Confirm single unified sign-in submit button
    expect(loginPageContent).toContain('Sign In');
  });

  // Scenario 4: A customer manually attempts to access an admin route and is denied
  it('Scenario 4: Customer manually attempting to access admin route or action is denied server-side', async () => {
    setupMockSupabaseAuth({
      user: { id: mockCustomerProfile.id, email: mockCustomerProfile.email },
      profile: mockCustomerProfile
    });

    // Server-side requireAdmin check must throw Forbidden
    await expect(requireAdmin()).rejects.toThrow(/Forbidden: Role 'CUSTOMER' is not authorized/);
  });

  // Scenario 5: An unauthenticated user attempts to access a protected route
  it('Scenario 5: Unauthenticated user attempting to access protected route is rejected', async () => {
    setupMockSupabaseAuth({
      user: null,
      profile: null
    });

    await expect(requireAuth()).rejects.toThrow(/Unauthorized: Authentication required/);
    await expect(requireAdmin()).rejects.toThrow(/Unauthorized: Authentication required/);
  });

  // Scenario 6: Role lookup fails or returns invalid or missing data
  it('Scenario 6: Role lookup failing or returning corrupt role fails closed to CUSTOMER or error', async () => {
    // 6A: Missing profile record fails login cleanly
    setupMockSupabaseAuth({
      user: { id: 'unknown-id', email: 'ghost@example.com' },
      profile: null,
      profileError: { message: 'Profile not found' }
    });

    const resultMissing = await signInAction({
      email: 'ghost@example.com',
      password: 'password123'
    });
    expect(resultMissing.success).toBe(false);
    expect(resultMissing.message).toContain('profile record was not found');

    // 6B: Corrupt role in profile fails closed to CUSTOMER (never ADMIN)
    setupMockSupabaseAuth({
      user: { id: 'corrupt-id', email: 'corrupt@example.com' },
      profile: { id: 'corrupt-id', role: 'SUPERUSER_INVALID', email: 'corrupt@example.com' }
    });

    const resultCorrupt = await signInAction({
      email: 'corrupt@example.com',
      password: 'password123'
    });
    expect(resultCorrupt.success).toBe(true);
    expect(resultCorrupt.role).toBe('CUSTOMER');
  });

  // Scenario 7: Login errors display correctly for invalid credentials
  it('Scenario 7: Login errors display correctly on invalid credentials', async () => {
    setupMockSupabaseAuth({
      user: null,
      authError: { message: 'Invalid login credentials' }
    });

    const result = await signInAction({
      email: 'wrong@example.com',
      password: 'badpassword'
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('Invalid login credentials');
  });

  // Scenario 8: Successful login redirects correctly without loops
  it('Scenario 8: Role-based redirect logic routes ADMIN to /admin and CUSTOMER to / without loops', () => {
    const loginPagePath = path.join(process.cwd(), 'src/app/login/page.tsx');
    const content = fs.readFileSync(loginPagePath, 'utf8');

    // Inspect routing logic in handleSubmit
    expect(content).toContain("userRole === 'ADMIN'");
    expect(content).toContain("router.push(adminDestination)");
    expect(content).toContain("router.push(custDestination)");

    // Confirms customer trying to hit /admin redirect is sanitized to '/'
    expect(content).toContain("!redirectPath.startsWith('/admin')");
  });

  // Scenario 9: Existing logout behavior remains functional
  it('Scenario 9: Logout action signs out and clears server session cleanly', async () => {
    const mockClient = setupMockSupabaseAuth({
      user: { id: mockAdminProfile.id, email: mockAdminProfile.email },
      profile: mockAdminProfile
    });

    const result = await signOutAction();
    expect(result.success).toBe(true);
    expect(result.message).toContain('Logged out successfully');
    expect(mockClient.auth.signOut).toHaveBeenCalled();
  });

  // Scenario 10: Existing floating feedback behavior and duration remain unchanged
  it('Scenario 10: Floating feedback configuration and duration tokens remain strictly preserved', () => {
    const feedbackContextPath = path.join(process.cwd(), 'src/context/FeedbackContext.tsx');
    const feedbackContent = fs.readFileSync(feedbackContextPath, 'utf8');

    // Confirm duration remains 1.5s (1500ms)
    expect(feedbackContent).toContain('1500');
    expect(feedbackContent).toContain('bg-white');
    expect(feedbackContent).toContain('useFeedback');
  });
});
