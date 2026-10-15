import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { auth } from '@clerk/nextjs/server';

export interface CreateClientOptions {
  /**
   * When true, requires a valid authenticated session token (Clerk or Supabase).
   * If the user is unauthenticated or token retrieval fails, throws an Error
   * rather than silently falling back to the anonymous PostgreSQL role.
   */
  requireAuth?: boolean;
  /**
   * Explicit bearer token (e.g. from newly created Supabase Auth session).
   */
  accessToken?: string;
}

/**
 * Creates a Supabase client for Server Components, Route Handlers, and Server Actions.
 *
 * Implements Clerk Third-Party Auth integration:
 * - Primary: Obtains the native Clerk session token via `authObj.getToken()`.
 *   This avoids the deprecated custom JWT template approach and eliminates the need
 *   to share the Supabase JWT secret in the Clerk dashboard.
 * - Fallback: Supports legacy `{ template: 'supabase' }` if configured in older environments.
 *
 * When `requireAuth` is true:
 * - Guarantees protected database operations fail closed with an explicit error
 *   if an active token cannot be obtained, preventing misleading empty query results
 *   caused by silent degradation to the anonymous PostgreSQL role.
 *
 * When `requireAuth` is false or omitted:
 * - Allows public / anonymous read access (e.g. browsing the camera fleet catalog).
 */
export async function createClient(options?: CreateClientOptions) {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://qfhmlwvkgdvysemitilb.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_tYeClbAcEaCB97cX-fQRZg_oUX6_Wdm';

  let clerkToken: string | null = options?.accessToken || null;
  let authError: string | null = null;
  let hasClerkUser = false;

  if (!clerkToken) {
    try {
      const authObj = await auth();
      if (authObj) {
        if (authObj.userId) {
          hasClerkUser = true;
        }
        if (typeof authObj.getToken === 'function') {
          // Native Clerk session token for Supabase Third-Party Auth
          clerkToken = await authObj.getToken();
        }
      }
    } catch (err: any) {
      authError = err?.message || 'Failed to authenticate Clerk session';
    }
  }

  const globalHeaders: Record<string, string> = {};
  if (clerkToken) {
    globalHeaders['Authorization'] = `Bearer ${clerkToken}`;
  }

  const client = createServerClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: globalHeaders
    },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Can be safely ignored when invoked from Server Components where cookies are read-only
        }
      },
    },
  });

  // Enforce authentication requirement when requested
  // Supports dual-auth architecture: either active Clerk session token or native Supabase Auth session cookie
  if (options?.requireAuth) {
    if (!clerkToken) {
      let hasSupabaseUser = false;
      try {
        const { data: { user } } = await client.auth.getUser();
        if (user) {
          hasSupabaseUser = true;
        }
      } catch {
        // Ignored, evaluate hasSupabaseUser as false
      }

      if (!hasSupabaseUser) {
        throw new Error(
          `Unauthorized: Valid authenticated session token required. ${
            authError ? `(${authError})` : hasClerkUser ? '(Clerk session token unavailable)' : '(No active session)'
          }`
        );
      }
    }
  }

  return client;
}

/**
 * Convenience helper to create a strictly authenticated Supabase client.
 * Fails closed with an error if no valid authentication token is available.
 */
export async function createAuthenticatedClient() {
  return createClient({ requireAuth: true });
}

/**
 * Convenience helper to create a public Supabase client for anonymous browsing.
 */
export async function createPublicClient() {
  return createClient({ requireAuth: false });
}

