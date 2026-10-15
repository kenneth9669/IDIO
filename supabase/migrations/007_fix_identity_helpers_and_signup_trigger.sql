-- ==============================================================================
-- IDIO Database Migration: 007_fix_identity_helpers_and_signup_trigger.sql
-- Scope: Fix RLS profile insertion for native Supabase users and auto-provision profiles via trigger
-- Target: PostgreSQL 15+ / Supabase
--
-- Background:
--   Migration 006 introduced current_clerk_id() and current_profile_id() using
--   current_setting('request.jwt.claim.sub', true). In PostgREST / Supabase,
--   claims are provided in request.jwt.claims (JSONB), causing these functions
--   to return NULL for authenticated Supabase users and failing RLS on profile creation.
--
-- Resolutions:
--   1. Upgrade public.current_clerk_id() to safely extract 'sub' from request.jwt.claims JSON,
--      auth.jwt(), or request.jwt.claim.sub without throwing.
--   2. Upgrade public.current_profile_id() to support native auth.uid(), Clerk clerk_id lookup,
--      and UUID fallback.
--   3. Ensure public.profiles RLS insert policy allows authenticated users to insert their own profile.
--   4. Author public.handle_new_user() SECURITY DEFINER trigger on auth.users to automatically
--      and atomically provision customer profiles from user metadata upon registration.
-- ==============================================================================

BEGIN;

-- 1. Upgrade public.current_clerk_id() to read JWT claims safely from all PostgREST formats
CREATE OR REPLACE FUNCTION public.current_clerk_id()
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_sub text;
BEGIN
  -- Attempt 1: Read 'sub' from standard PostgREST request.jwt.claims JSON string
  BEGIN
    v_sub := nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub';
    IF v_sub IS NOT NULL AND v_sub <> '' THEN
      RETURN v_sub;
    END IF;
  EXCEPTION WHEN others THEN
  END;

  -- Attempt 2: Read 'sub' from Supabase built-in auth.jwt() function
  BEGIN
    v_sub := auth.jwt() ->> 'sub';
    IF v_sub IS NOT NULL AND v_sub <> '' THEN
      RETURN v_sub;
    END IF;
  EXCEPTION WHEN others THEN
  END;

  -- Attempt 3: Read from individual setting request.jwt.claim.sub if populated
  BEGIN
    v_sub := nullif(current_setting('request.jwt.claim.sub', true), '');
    IF v_sub IS NOT NULL AND v_sub <> '' THEN
      RETURN v_sub;
    END IF;
  EXCEPTION WHEN others THEN
  END;

  RETURN NULL;
END;
$$;

-- 2. Upgrade public.current_profile_id() with robust dual-auth support
CREATE OR REPLACE FUNCTION public.current_profile_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_clerk_id text;
  v_profile_id uuid;
  v_uid uuid;
BEGIN
  -- Dual-auth Check 1: Native Supabase Auth session via auth.uid()
  BEGIN
    v_uid := auth.uid();
    IF v_uid IS NOT NULL THEN
      RETURN v_uid;
    END IF;
  EXCEPTION WHEN others THEN
  END;

  -- Dual-auth Check 2: Clerk user ID or token subject string
  v_clerk_id := public.current_clerk_id();
  IF v_clerk_id IS NOT NULL THEN
    -- Check if token subject matches a verified clerk_id in profiles
    SELECT id INTO v_profile_id
    FROM public.profiles
    WHERE clerk_id = v_clerk_id;

    IF v_profile_id IS NOT NULL THEN
      RETURN v_profile_id;
    END IF;

    -- Dual-auth Check 3: If subject itself is a valid UUID string
    BEGIN
      RETURN v_clerk_id::uuid;
    EXCEPTION WHEN others THEN
      RETURN NULL;
    END;
  END IF;

  RETURN NULL;
END;
$$;

-- 3. Grants for upgraded identity helpers
REVOKE EXECUTE ON FUNCTION public.current_clerk_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_clerk_id() TO anon, authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.current_profile_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_profile_id() TO anon, authenticated, service_role;

-- 4. Ensure public.profiles INSERT RLS policy enforces security without false rejections
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (
    (
      (clerk_id IS NOT NULL AND clerk_id = public.current_clerk_id()) OR 
      (public.current_profile_id() IS NOT NULL AND id = public.current_profile_id())
    ) AND (
      role = 'CUSTOMER' OR (public.get_auth_role() IS NOT NULL AND public.get_auth_role() = 'ADMIN')
    )
  );

-- 5. Auto-provision profile trigger function on auth.users
-- Automatically provisions the public.profiles record with CUSTOMER role upon auth.users insertion.
-- Executes under SECURITY DEFINER with postgres privileges, immune to client session race conditions.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    role,
    full_name,
    email,
    phone,
    barangay,
    street_address,
    city,
    province,
    id_type,
    id_number
  ) VALUES (
    NEW.id,
    'CUSTOMER',
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Customer'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'phone', 'N/A'),
    COALESCE(NEW.raw_user_meta_data->>'barangay', 'Doongan'),
    COALESCE(NEW.raw_user_meta_data->>'street_address', 'N/A'),
    'Butuan City',
    'Agusan del Norte',
    COALESCE(NEW.raw_user_meta_data->>'id_type', 'Philippine National ID (PhilSys)'),
    COALESCE(NEW.raw_user_meta_data->>'id_number', 'N/A')
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    barangay = EXCLUDED.barangay,
    street_address = EXCLUDED.street_address,
    id_type = EXCLUDED.id_type,
    id_number = EXCLUDED.id_number;

  RETURN NEW;
END;
$$;

-- 6. Attach trigger to auth.users table
DROP TRIGGER IF EXISTS trg_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMIT;
