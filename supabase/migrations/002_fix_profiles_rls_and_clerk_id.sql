-- ==============================================================================
-- IDIO Patch: Fix profiles table for Clerk + Supabase coexistence
-- Run this in your Supabase SQL Editor → New Query → Run
-- ==============================================================================

-- 1. Add clerk_id column if it doesn't exist yet
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'clerk_id'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN clerk_id VARCHAR(255) UNIQUE;
  END IF;
END $$;

-- 2. Add missing INSERT policy so registered users can create their own profile row
--    (Without this, RLS blocks all INSERT operations on profiles)
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 3. Verify the policies are now in place
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;
