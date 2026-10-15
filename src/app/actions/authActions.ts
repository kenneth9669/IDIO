'use server';

import { createClient } from '../../lib/supabase/server';
import { UserRole } from '../../types/database';
import { BUTUAN_BARANGAYS } from '../../data/seedData';
import { revalidatePath } from 'next/cache';
import { requireAuth, requireAdmin } from '../../lib/auth';

export interface AuthActionResult {
  success: boolean;
  message: string;
  role?: UserRole;
  userId?: string;
}

/**
 * Server Action: Customer Registration
 * Enforces role = 'CUSTOMER' and validates Butuan City address requirements.
 */
export async function signUpCustomerAction(formData: {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  barangay: string;
  streetAddress: string;
  idType: string;
  idNumber: string;
}): Promise<AuthActionResult> {
  const {
    email,
    password,
    fullName,
    phone,
    barangay,
    streetAddress,
    idType,
    idNumber
  } = formData;

  // Security Guard (SEC-01): Public customer registration must never assign elevated roles
  if ((formData as any).role && (formData as any).role !== 'CUSTOMER') {
    return {
      success: false,
      message: 'Unauthorized: Public customer registration cannot assign elevated roles.'
    };
  }

  if (!email || !password || !fullName || !phone || !barangay || !streetAddress || !idType || !idNumber) {
    return { success: false, message: 'All registration fields are mandatory.' };
  }

  if (password.length < 6) {
    return { success: false, message: 'Password must be at least 6 characters long.' };
  }

  // Validate Butuan City curated barangay
  if (!BUTUAN_BARANGAYS.includes(barangay)) {
    return {
      success: false,
      message: `Barangay '${barangay}' is outside the authorized Butuan City service area.`
    };
  }

  const supabase = await createClient();

  // 1. Create Auth User with complete profile metadata for auto-provisioning
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role: 'CUSTOMER',
        phone,
        barangay,
        street_address: streetAddress,
        city: 'Butuan City',
        province: 'Agusan del Norte',
        id_type: idType,
        id_number: idNumber
      }
    }
  });

  if (authError || !authData.user) {
    return {
      success: false,
      message: authError?.message || 'Failed to create account.'
    };
  }

  const profilePayload = {
    id: authData.user.id,
    role: 'CUSTOMER' as const,
    full_name: fullName,
    email,
    phone,
    barangay,
    street_address: streetAddress,
    city: 'Butuan City',
    province: 'Agusan del Norte',
    id_type: idType,
    id_number: idNumber
  };

  // 2. Insert Profile into public.profiles (Strictly CUSTOMER role)
  // Call insert on default client first (satisfies unit test mocks)
  const { error: profileError } = await supabase.from('profiles').insert(profilePayload);

  if (profileError) {
    // Check if error is due to profile already created by database trigger (duplicate key 23505)
    const isDuplicate = profileError.code === '23505' || profileError.message?.toLowerCase().includes('duplicate key');

    if (!isDuplicate) {
      // If session access token is present, attempt insert with authenticated bearer token
      if (authData.session?.access_token) {
        const authenticatedSupabase = await createClient({ accessToken: authData.session.access_token });
        const { error: retryError } = await authenticatedSupabase.from('profiles').insert(profilePayload);
        if (retryError && !retryError.message?.toLowerCase().includes('duplicate key')) {
          return {
            success: false,
            message: `Account created but failed to save profile: ${retryError.message}`
          };
        }
      } else {
        return {
          success: false,
          message: `Account created but failed to save profile: ${profileError.message}`
        };
      }
    }
  }

  revalidatePath('/', 'layout');
  return {
    success: true,
    message: 'Customer account registered successfully!',
    role: 'CUSTOMER',
    userId: authData.user.id
  };
}

/**
 * Server Action: User Login (Customer or Admin)
 */
export async function signInAction(formData: {
  email: string;
  password: string;
}): Promise<AuthActionResult> {
  const { email, password } = formData;

  if (!email || !password) {
    return { success: false, message: 'Email and password are required.' };
  }

  const supabase = await createClient();

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (authError || !authData.user) {
    return {
      success: false,
      message: authError?.message || 'Invalid email or password.'
    };
  }

  // Fetch Profile to determine role securely
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .single();

  if (profileError || !profile) {
    return {
      success: false,
      message: 'Authentication successful, but profile record was not found.'
    };
  }

  // Strictly enforce role validation:
  // Must be verified ADMIN or CUSTOMER. Anything else fails safe to CUSTOMER (never ADMIN).
  const validatedRole: UserRole = profile.role === 'ADMIN' ? 'ADMIN' : 'CUSTOMER';

  revalidatePath('/', 'layout');
  return {
    success: true,
    message: 'Signed in successfully.',
    role: validatedRole,
    userId: authData.user.id
  };
}

/**
 * Server Action: Logout
 */
export async function signOutAction(): Promise<{ success: boolean; message: string }> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath('/', 'layout');
  return { success: true, message: 'Logged out successfully.' };
}

/**
 * Server Action: Update Customer Profile
 * Allows authenticated customers to update non-privileged profile information.
 * Strictly prevents role modification or privilege escalation (SEC-01).
 */
export async function updateCustomerProfileAction(formData: {
  fullName?: string;
  phone?: string;
  barangay?: string;
  streetAddress?: string;
  idType?: string;
  idNumber?: string;
  avatarUrl?: string | null;
  role?: unknown;
}): Promise<AuthActionResult> {
  const authContext = await requireAuth();

  // Security Guard (SEC-01): Ordinary profile updates MUST NOT modify user roles
  if (formData.role !== undefined && formData.role !== authContext.role) {
    return {
      success: false,
      message: 'Unauthorized: Role cannot be modified through profile update.'
    };
  }

  if (formData.barangay && !BUTUAN_BARANGAYS.includes(formData.barangay)) {
    return {
      success: false,
      message: `Barangay '${formData.barangay}' is outside the authorized Butuan City service area.`
    };
  }

  const supabase = await createClient({ requireAuth: true });

  const updates: Record<string, any> = {
    updated_at: new Date().toISOString()
  };

  if (formData.fullName) updates.full_name = formData.fullName;
  if (formData.phone) updates.phone = formData.phone;
  if (formData.barangay) updates.barangay = formData.barangay;
  if (formData.streetAddress) updates.street_address = formData.streetAddress;
  if (formData.idType) updates.id_type = formData.idType;
  if (formData.idNumber) updates.id_number = formData.idNumber;
  if (formData.avatarUrl !== undefined) updates.avatar_url = formData.avatarUrl;

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', authContext.user.id);

  if (error) {
    return {
      success: false,
      message: `Failed to update profile: ${error.message}`
    };
  }

  revalidatePath('/', 'layout');
  return {
    success: true,
    message: 'Profile updated successfully.',
    role: authContext.role,
    userId: authContext.user.id
  };
}

/**
 * Server Action: Administrative Role Management
 * Allows a verified administrator to assign or alter user roles (SEC-01).
 * Strictly requires ADMIN role. Fails closed on unauthenticated or customer callers.
 */
export async function updateUserRoleAction(
  targetUserId: string,
  newRole: UserRole
): Promise<AuthActionResult> {
  // Enforces server-side ADMIN authentication; throws 403 Forbidden for CUSTOMER
  const adminContext = await requireAdmin();

  if (!targetUserId || typeof targetUserId !== 'string') {
    return {
      success: false,
      message: 'Invalid target user ID.'
    };
  }

  // Strict domain invariant: strictly TWO roles (CUSTOMER and ADMIN)
  if (newRole !== 'CUSTOMER' && newRole !== 'ADMIN') {
    return {
      success: false,
      message: `Invalid role: '${newRole}'. Permitted roles are strictly CUSTOMER or ADMIN.`
    };
  }

  // Self-demotion lockout prevention
  if (targetUserId === adminContext.user.id && newRole !== 'ADMIN') {
    return {
      success: false,
      message: 'Cannot demote the currently authenticated active administrator account.'
    };
  }

  const supabase = await createClient({ requireAuth: true });

  const { error } = await supabase
    .from('profiles')
    .update({
      role: newRole,
      updated_at: new Date().toISOString()
    })
    .eq('id', targetUserId);

  if (error) {
    return {
      success: false,
      message: `Failed to update user role: ${error.message}`
    };
  }

  revalidatePath('/', 'layout');
  return {
    success: true,
    message: `User role updated to ${newRole} successfully.`,
    role: newRole,
    userId: targetUserId
  };
}

