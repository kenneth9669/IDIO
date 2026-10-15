import { createClient } from './supabase/server';
import { ProfileRow, UserRole } from '../types/database';
import { currentUser } from '@clerk/nextjs/server';
import { syncCurrentClerkUser, deriveDeterministicUuid } from './clerkSync';

export interface AuthenticatedContext {
  user: {
    id: string;
    email: string;
  };
  profile: ProfileRow;
  role: UserRole;
}

/**
 * Server-side helper to retrieve the authenticated user and their database profile.
 * Supports both Supabase Auth sessions and Clerk authentication.
 * NEVER trusts client-submitted user ID, role, or localStorage state.
 * Always queries `public.profiles` for authoritative role & profile information.
 */
export async function getAuthenticatedUser(): Promise<AuthenticatedContext | null> {
  const supabase = await createClient();

  // 1. Check Supabase Auth session first
  try {
    const {
      data: { user },
      error: authError
    } = await supabase.auth.getUser();

    if (!authError && user && user.id) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!profileError && profile && (profile.role === 'CUSTOMER' || profile.role === 'ADMIN')) {
        return {
          user: {
            id: user.id,
            email: user.email || profile.email
          },
          profile: profile as ProfileRow,
          role: profile.role as UserRole
        };
      }
    }
  } catch {
    // Continue to Clerk fallback
  }

  // 2. Check Clerk Auth session
  try {
    const clerkUser = await currentUser();
    if (clerkUser) {
      const email = clerkUser.emailAddresses?.[0]?.emailAddress || '';
      let { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .or(`clerk_id.eq.${clerkUser.id},email.eq.${email}`)
        .maybeSingle();

      // If still no profile in database, attempt to sync/create customer profile
      if (!profile) {
        profile = await syncCurrentClerkUser();
      }

      // Security Invariant (SEC-01/02): Role MUST come strictly from verified database profile.
      // Missing, unlinked, or uncreated profiles fail closed to 'CUSTOMER'.
      // An incoming Clerk user is NEVER elevated to ADMIN based on Clerk metadata or unlinked email matching.
      let role: UserRole = 'CUSTOMER';
      if (profile && profile.role === 'ADMIN') {
        if (profile.clerk_id === clerkUser.id) {
          role = 'ADMIN';
        } else {
          console.warn(
            `[Security Alert: SEC-01/02] Clerk user (${clerkUser.id}) attempted to access ADMIN profile (${email}) without verified clerk_id binding. Failing closed to CUSTOMER.`
          );
          role = 'CUSTOMER';
        }
      } else if (profile && profile.role === 'CUSTOMER') {
        role = 'CUSTOMER';
      } else {
        role = 'CUSTOMER';
      }

      // Invariant (SEC-02): Resolved profile id MUST ALWAYS be a valid UUID format
      // to maintain foreign key integrity across all relational tables.
      const resolvedProfileId = profile?.id || deriveDeterministicUuid(clerkUser.id);

      const resolvedProfile: ProfileRow = (profile as ProfileRow) || {
        id: resolvedProfileId,
        clerk_id: clerkUser.id,
        role,
        full_name:
          [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') ||
          clerkUser.username ||
          'IDIO User',
        email,
        phone: clerkUser.phoneNumbers?.[0]?.phoneNumber || '0917-000-0000',
        avatar_url: clerkUser.imageUrl || null,
        barangay: 'Libertad',
        street_address: 'Butuan City',
        city: 'Butuan City',
        province: 'Agusan del Norte',
        id_type: 'Clerk Verified',
        id_number: `CLK-${clerkUser.id.slice(-8).toUpperCase()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      return {
        user: {
          id: resolvedProfile.id,
          email
        },
        profile: resolvedProfile,
        role
      };
    }
  } catch {
    // Clerk not active or errored
  }

  return null;
}

/**
 * Requires an authenticated user. Throws an error if unauthenticated.
 */
export async function requireAuth(): Promise<AuthenticatedContext> {
  const context = await getAuthenticatedUser();
  if (!context) {
    throw new Error('Unauthorized: Authentication required.');
  }
  return context;
}

/**
 * Server-side RBAC Guard: Requires the user to have one of the allowed roles.
 * Verifies role directly against database record, preventing client-side privilege escalation.
 */
export async function requireRole(allowedRoles: UserRole[]): Promise<AuthenticatedContext> {
  const context = await requireAuth();

  if (!allowedRoles.includes(context.role)) {
    throw new Error(
      `Forbidden: Role '${context.role}' is not authorized to access this resource. Required: ${allowedRoles.join(', ')}.`
    );
  }

  return context;
}

/**
 * Convenience helper for ADMIN-only operations
 */
export async function requireAdmin(): Promise<AuthenticatedContext> {
  return await requireRole(['ADMIN']);
}

/**
 * Convenience helper for CUSTOMER operations
 */
export async function requireCustomer(): Promise<AuthenticatedContext> {
  return await requireRole(['CUSTOMER']);
}
