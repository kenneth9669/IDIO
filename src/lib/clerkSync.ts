import { currentUser } from '@clerk/nextjs/server';
import { createClient } from './supabase/server';
import { ProfileRow, UserRole } from '../types/database';

/**
 * Ensures that the currently authenticated Clerk user has a corresponding
 * profile in Supabase's `public.profiles` table.
 * Preserves RBAC (CUSTOMER / ADMIN) and Butuan City operational context.
 */
export async function syncCurrentClerkUser(): Promise<ProfileRow | null> {
  try {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return null;
    }

    const email = clerkUser.emailAddresses?.[0]?.emailAddress;
    if (!email) {
      return null;
    }

    const supabase = await createClient();

    // 1. Look for existing profile by clerk_id or email
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('*')
      .or(`clerk_id.eq.${clerkUser.id},email.eq.${email}`)
      .limit(1)
      .maybeSingle();

    if (existingProfile) {
      // If found but clerk_id not set yet, update it
      if (!existingProfile.clerk_id) {
        await supabase
          .from('profiles')
          .update({ clerk_id: clerkUser.id, updated_at: new Date().toISOString() })
          .eq('id', existingProfile.id);
      }
      return existingProfile as ProfileRow;
    }

    // 2. Derive role from Clerk public metadata (default to CUSTOMER)
    const role: UserRole = (clerkUser.publicMetadata?.role as UserRole) || 'CUSTOMER';
    const fullName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') ||
      clerkUser.username ||
      'IDIO Customer';
    const phone = clerkUser.phoneNumbers?.[0]?.phoneNumber || '0917-000-0000';

    // 3. Create a new profile record in Supabase
    const { data: newProfile, error } = await supabase
      .from('profiles')
      .insert({
        clerk_id: clerkUser.id,
        role,
        full_name: fullName,
        email,
        phone,
        barangay: 'Libertad',
        street_address: 'Butuan City',
        city: 'Butuan City',
        province: 'Agusan del Norte',
        id_type: 'Philippine National ID (PhilSys)',
        id_number: `CLK-${clerkUser.id.slice(-8).toUpperCase()}`,
        avatar_url: clerkUser.imageUrl || null
      })
      .select()
      .single();

    if (error) {
      console.warn('Could not insert profile into Supabase (database tables may not be migrated yet):', error.message);
      return null;
    }

    return newProfile as ProfileRow;
  } catch (err) {
    console.warn('Clerk to Supabase sync warning:', err);
    return null;
  }
}
