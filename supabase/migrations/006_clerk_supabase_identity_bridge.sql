-- ==============================================================================
-- IDIO Database Migration: 006_clerk_supabase_identity_bridge.sql
-- Scope: SEC-02 - Clerk-to-Supabase Identity Mapping & PostgreSQL Token Bridge
-- Invariants:
--   - Preserves public.profiles.id as UUID (preserves all existing FK relationships)
--   - Decouples profiles.id from auth.users(id) so Clerk users can possess valid profiles
--   - Bridges Clerk JWT claim.sub (text) to profile UUID and role via SECURITY DEFINER helpers
--   - Fails closed on missing, invalid, or unrecognized tokens
-- Target: PostgreSQL 15+ / Supabase
-- Safety Note: DO NOT EXECUTE OR APPLY TO LIVE DATABASE UNTIL APPROVED
-- ==============================================================================

BEGIN;

-- 1. Decouple profiles from Supabase auth.users table
-- Clerk users are authenticated via Clerk and do not exist in Supabase auth.users.
-- Preserves id as UUID PRIMARY KEY for all foreign key relationships (reservations, rentals, payments).
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.profiles ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- 2. Ensure unique index on clerk_id column for O(1) identity lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_clerk_id 
  ON public.profiles(clerk_id) 
  WHERE clerk_id IS NOT NULL;

-- 3. SQL Helper: public.current_clerk_id()
-- Reads JWT claim subject safely as text across all PostgREST formats without crashing on non-UUID strings.
-- Returns NULL when unauthenticated or token claim is absent.
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

-- 4. SQL Helper: public.current_profile_id()
-- Resolves the verified user's persistent UUID primary key from public.profiles.
-- SECURITY DEFINER bypasses RLS on public.profiles to prevent infinite policy recursion.
-- Dual-auth fallback: supports native Supabase Auth sessions (auth.uid()) and Clerk SSO.
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

-- 5. SQL Helper: public.get_auth_role() (Upgraded for Clerk Identity)
-- Resolves authenticated role strictly from public.profiles using resolved profile ID.
-- SECURITY DEFINER ensures reliable evaluation in triggers and RLS policies.
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS public.user_role
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_profile_id uuid;
  v_role public.user_role;
BEGIN
  v_profile_id := public.current_profile_id();
  IF v_profile_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = v_profile_id;

  RETURN v_role;
END;
$$;

-- 6. Upgraded RLS Policies on public.profiles
-- Supports both Clerk JWT identities and legacy Supabase sessions
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
  FOR SELECT USING (
    id = public.current_profile_id() OR
    clerk_id = public.current_clerk_id() OR
    public.get_auth_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (
    id = public.current_profile_id() OR public.get_auth_role() = 'ADMIN'
  )
  WITH CHECK (
    id = public.current_profile_id() OR public.get_auth_role() = 'ADMIN'
  );

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

-- 7. Function Execution Grants
REVOKE EXECUTE ON FUNCTION public.current_clerk_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_clerk_id() TO anon, authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.current_profile_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_profile_id() TO anon, authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_auth_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_auth_role() TO anon, authenticated, service_role;

-- 8. Upgraded RLS Policies for Reservations (SEC-02 & SEC-03)
DROP POLICY IF EXISTS "reservations_select" ON public.reservations;
CREATE POLICY "reservations_select" ON public.reservations
  FOR SELECT USING (
    customer_id = public.current_profile_id() OR public.get_auth_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS "reservations_insert_customer" ON public.reservations;
CREATE POLICY "reservations_insert_customer" ON public.reservations
  FOR INSERT WITH CHECK (
    customer_id = public.current_profile_id() AND (
      public.get_auth_role() = 'CUSTOMER' OR public.get_auth_role() = 'ADMIN'
    )
  );

-- Fix for broken customer cancellation: includes explicit WITH CHECK allowing transition to CANCELLED
DROP POLICY IF EXISTS "reservations_update" ON public.reservations;
CREATE POLICY "reservations_update" ON public.reservations
  FOR UPDATE USING (
    (customer_id = public.current_profile_id() AND status = 'PENDING_APPROVAL') OR
    public.get_auth_role() = 'ADMIN'
  )
  WITH CHECK (
    (
      customer_id = public.current_profile_id() AND 
      status = 'CANCELLED'
    ) OR
    public.get_auth_role() = 'ADMIN'
  );

-- 9. Mutation Protection Trigger on Reservations (SEC-03)
-- Enforces:
-- 1. Customers can ONLY transition from PENDING_APPROVAL to CANCELLED.
-- 2. Immutable fields (camera_id, customer_id, dates, pricing) cannot be tampered with.
-- 3. Fails closed with 42501 on unauthorized attempts.
CREATE OR REPLACE FUNCTION public.protect_reservation_mutation()
RETURNS TRIGGER AS $$
DECLARE
  v_role public.user_role;
BEGIN
  v_role := public.get_auth_role();

  -- Legitimate ADMIN updates
  IF v_role = 'ADMIN' THEN
    -- Admin cannot alter immutable relational links once created
    IF (OLD.camera_id IS DISTINCT FROM NEW.camera_id) OR 
       (OLD.customer_id IS DISTINCT FROM NEW.customer_id) THEN
      RAISE EXCEPTION 'Cannot alter camera_id or customer_id on an existing reservation.'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- Customer updates:
  -- Status can strictly transition from PENDING_APPROVAL to CANCELLED
  IF (OLD.status != 'PENDING_APPROVAL') OR (NEW.status != 'CANCELLED') THEN
    RAISE EXCEPTION 'Unauthorized reservation transition: Customers can only cancel pending reservations.'
      USING ERRCODE = '42501';
  END IF;

  -- Protected immutable fields cannot be modified during cancellation
  IF (OLD.camera_id IS DISTINCT FROM NEW.camera_id) OR
     (OLD.customer_id IS DISTINCT FROM NEW.customer_id) OR
     (OLD.start_date IS DISTINCT FROM NEW.start_date) OR
     (OLD.end_date IS DISTINCT FROM NEW.end_date) OR
     (OLD.total_days IS DISTINCT FROM NEW.total_days) OR
     (OLD.daily_rate_snapshot IS DISTINCT FROM NEW.daily_rate_snapshot) OR
     (OLD.subtotal_php IS DISTINCT FROM NEW.subtotal_php) OR
     (OLD.security_deposit_php IS DISTINCT FROM NEW.security_deposit_php) OR
     (OLD.total_amount_php IS DISTINCT FROM NEW.total_amount_php) OR
     (OLD.reference_no IS DISTINCT FROM NEW.reference_no) THEN
    RAISE EXCEPTION 'Unauthorized: Protected reservation fields cannot be modified.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

DROP TRIGGER IF EXISTS trg_protect_reservation_mutation ON public.reservations;
CREATE TRIGGER trg_protect_reservation_mutation
BEFORE UPDATE ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.protect_reservation_mutation();

-- 10. Upgraded RLS Policies for Rentals
DROP POLICY IF EXISTS "rentals_select" ON public.rentals;
CREATE POLICY "rentals_select" ON public.rentals
  FOR SELECT USING (
    customer_id = public.current_profile_id() OR public.get_auth_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS "rentals_admin_mutate" ON public.rentals;
CREATE POLICY "rentals_admin_mutate" ON public.rentals
  FOR ALL USING (public.get_auth_role() = 'ADMIN');

-- 11. Upgraded RLS Policies for Payments and Deposits
DROP POLICY IF EXISTS "payments_select" ON public.payments_and_deposits;
CREATE POLICY "payments_select" ON public.payments_and_deposits
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.reservations r
      WHERE r.id = reservation_id AND (
        r.customer_id = public.current_profile_id() OR public.get_auth_role() = 'ADMIN'
      )
    )
  );

-- Customer can create pending payment record strictly for CASH_PICKUP on their own reservation
DROP POLICY IF EXISTS "payments_customer_insert" ON public.payments_and_deposits;
CREATE POLICY "payments_customer_insert" ON public.payments_and_deposits
  FOR INSERT WITH CHECK (
    payment_method = 'CASH_PICKUP' AND
    payment_status = 'PENDING' AND
    deposit_status = 'HELD' AND
    EXISTS (
      SELECT 1 FROM public.reservations r
      WHERE r.id = reservation_id AND r.customer_id = public.current_profile_id()
    )
  );

DROP POLICY IF EXISTS "payments_admin_mutate" ON public.payments_and_deposits;
CREATE POLICY "payments_admin_mutate" ON public.payments_and_deposits
  FOR ALL USING (public.get_auth_role() = 'ADMIN');

-- 12. Upgraded RLS Policies for Activity Audit Logs
DROP POLICY IF EXISTS "audit_admin_select" ON public.activity_audit_logs;
CREATE POLICY "audit_admin_select" ON public.activity_audit_logs
  FOR SELECT USING (public.get_auth_role() = 'ADMIN');

DROP POLICY IF EXISTS "audit_insert_any_authenticated" ON public.activity_audit_logs;
DROP POLICY IF EXISTS "audit_insert_actor_bound" ON public.activity_audit_logs;
CREATE POLICY "audit_insert_actor_bound" ON public.activity_audit_logs
  FOR INSERT WITH CHECK (
    actor_id = public.current_profile_id() AND
    actor_role = public.get_auth_role()
  );

COMMENT ON FUNCTION public.current_clerk_id() IS 
  'Extracts verified Clerk User ID (string) from JWT claim.sub. Fails closed to NULL.';

COMMENT ON FUNCTION public.current_profile_id() IS 
  'Resolves verified Clerk user string ID to internal public.profiles UUID primary key.';

COMMENT ON FUNCTION public.get_auth_role() IS 
  'Derives authenticated user role (CUSTOMER/ADMIN) from public.profiles via current_profile_id().';

COMMENT ON FUNCTION public.protect_reservation_mutation() IS 
  'Enforces that customers can only transition pending reservations to cancelled without mutating protected fields.';

COMMIT;
