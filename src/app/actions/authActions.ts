'use server';

import { createClient } from '../../lib/supabase/server';
import { UserRole } from '../../types/database';
import { BUTUAN_BARANGAYS } from '../../data/seedData';
import { revalidatePath } from 'next/cache';

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

  // 1. Create Auth User
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        role: 'CUSTOMER'
      }
    }
  });

  if (authError || !authData.user) {
    return {
      success: false,
      message: authError?.message || 'Failed to create account.'
    };
  }

  // 2. Insert Profile into public.profiles (Strictly CUSTOMER role)
  const { error: profileError } = await supabase.from('profiles').insert({
    id: authData.user.id,
    role: 'CUSTOMER',
    full_name: fullName,
    email,
    phone,
    barangay,
    street_address: streetAddress,
    city: 'Butuan City',
    province: 'Agusan del Norte',
    id_type: idType,
    id_number: idNumber
  });

  if (profileError) {
    return {
      success: false,
      message: `Account created but failed to save profile: ${profileError.message}`
    };
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

  revalidatePath('/', 'layout');
  return {
    success: true,
    message: 'Signed in successfully.',
    role: profile.role as UserRole,
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
