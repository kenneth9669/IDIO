-- ==============================================================================
-- IDIO Patch: Hardening profiles table against role privilege escalation
-- Target: PostgreSQL 15+ / Supabase
-- Location: Butuan City, Agusan del Norte, Philippines
-- ==============================================================================

-- 1. Create trigger function to block non-admins from mutating their own role column
--    (In PostgreSQL triggers, OLD and NEW pseudo-records are available)
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER AS $$
BEGIN
  -- If role is being changed and the actor is not an ADMIN, reject with 42501
  IF (OLD.role IS DISTINCT FROM NEW.role) AND (public.get_auth_role() != 'ADMIN') THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can modify user roles.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Attach before-update trigger to public.profiles
DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
CREATE TRIGGER trg_protect_profile_role
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_role();

-- 3. RLS Policy for Profiles Update
--    (Note: In RLS policies, candidate row columns are accessed directly without OLD/NEW)
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (
    auth.uid() = id OR public.get_auth_role() = 'ADMIN'
  )
  WITH CHECK (
    auth.uid() = id OR public.get_auth_role() = 'ADMIN'
  );
