-- ==============================================================================
-- IDIO Database Migration: 005_harden_profile_insert_role.sql
-- Scope: SEC-01 Fix - Prevent customer privilege escalation to ADMIN on INSERT & UPDATE
-- Target: PostgreSQL 15+ / Supabase
-- Safety Note: DO NOT EXECUTE OR APPLY TO LIVE DATABASE UNTIL APPROVED
-- ==============================================================================

BEGIN;

-- 1. Upgrade trigger function to protect role on BOTH INSERT and UPDATE
-- Strictly fail-closed: handles NULL actor role safely without nullable comparison bypass
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER AS $$
DECLARE
  v_actor_role public.user_role;
BEGIN
  v_actor_role := public.get_auth_role();

  -- On INSERT: Disallow non-admins from creating a profile with role = 'ADMIN'
  IF TG_OP = 'INSERT' THEN
    IF NEW.role = 'ADMIN' THEN
      -- If actor is unauthenticated, NULL, or not an ADMIN, fail closed
      IF v_actor_role IS NULL OR v_actor_role != 'ADMIN' THEN
        RAISE EXCEPTION 'Unauthorized: Cannot create account with ADMIN role.'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  -- On UPDATE: Role changes require an existing, authenticated administrator
  IF TG_OP = 'UPDATE' THEN
    IF OLD.role IS DISTINCT FROM NEW.role THEN
      -- If actor is unauthenticated, NULL, or not an ADMIN, fail closed
      IF v_actor_role IS NULL OR v_actor_role != 'ADMIN' THEN
        RAISE EXCEPTION 'Unauthorized: Only administrators can modify user roles.'
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Bind trigger to BEFORE INSERT OR UPDATE
DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
CREATE TRIGGER trg_protect_profile_role
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_role();

-- 3. Harden RLS insert policy for public.profiles
-- Ensures row check directly in policy as defense-in-depth
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (
    auth.uid() = id AND (
      role = 'CUSTOMER' OR (public.get_auth_role() IS NOT NULL AND public.get_auth_role() = 'ADMIN')
    )
  );

-- 4. Harden RLS update policy for public.profiles
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (
    auth.uid() = id OR (public.get_auth_role() IS NOT NULL AND public.get_auth_role() = 'ADMIN')
  )
  WITH CHECK (
    auth.uid() = id OR (public.get_auth_role() IS NOT NULL AND public.get_auth_role() = 'ADMIN')
  );

COMMENT ON FUNCTION public.protect_profile_role() IS
  'Trigger function enforcing that only authenticated administrators can assign or alter the ADMIN role. Fails closed on NULL actor role.';

COMMIT;
