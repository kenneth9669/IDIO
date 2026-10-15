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
        // Security Guard (SEC-01 / Account Takeover Prevention):
        // An existing ADMIN profile must NEVER be automatically linked to an incoming Clerk user by email alone.
        // Linking an admin requires manual database owner configuration in Supabase.
        if (existingProfile.role === 'ADMIN') {
          console.warn(`[Security] Blocked auto-linking of ADMIN profile (${existingProfile.email}) to Clerk user (${clerkUser.id}). Manual linking required.`);
          return null;
        }

        await supabase
          .from('profiles')
          .update({ clerk_id: clerkUser.id, updated_at: new Date().toISOString() })
          .eq('id', existingProfile.id);
      }
      return existingProfile as ProfileRow;
    }

    // 2. Role Invariant: New profiles created from public Clerk logins are strictly CUSTOMER.
    // Untrusted clerkUser.publicMetadata must NEVER assign or elevate to ADMIN.
    const role: UserRole = 'CUSTOMER';
    const fullName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') ||
      clerkUser.username ||
      'IDIO Customer';
    const phone = clerkUser.phoneNumbers?.[0]?.phoneNumber || '0917-000-0000';
    const profileId = crypto.randomUUID();

    // 3. Create a new profile record in Supabase with valid UUID primary key
    const { data: newProfile, error } = await supabase
      .from('profiles')
      .insert({
        id: profileId,
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
      // Fallback: return valid in-memory profile with deterministic UUID
      return {
        id: deriveDeterministicUuid(clerkUser.id),
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
        avatar_url: clerkUser.imageUrl || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }

    return newProfile as ProfileRow;
  } catch (err) {
    console.warn('Clerk to Supabase sync warning:', err);
    return null;
  }
}

/**
 * Deterministically maps a Clerk string ID (e.g. 'user_2bF...') to a valid UUID syntax string.
 * Used as a fallback identifier when a database profile has not yet been persisted,
 * ensuring relational queries expecting UUID syntax never crash with PostgreSQL 22P02.
 */
export function deriveDeterministicUuid(clerkId: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57, h3 = 0x7b3a9e14, h4 = 0x9e3779b9;
  for (let i = 0; i < clerkId.length; i++) {
    const ch = clerkId.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
    h3 = Math.imul(h3 ^ ch, 2246822519);
    h4 = Math.imul(h4 ^ ch, 3266489917);
  }
  const toHex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  const hex = toHex(h1) + toHex(h2) + toHex(h3) + toHex(h4);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
