-- ==============================================================================
-- IDIO Database Migration: 008_rental_buffer_and_agreement.sql
-- Scope:
--   1. Automatic Two-Calendar-Day Rental Buffer Enforcement (Database GIST exclusion)
--   2. Customer Rental Agreement with Versioned Acceptance Records (Table & RLS)
-- Target: PostgreSQL 15+ / Supabase
--
-- CRITICAL SAFETY DIRECTIVE:
--   DO NOT APPLY THIS MIGRATION TO THE LIVE DATABASE.
--   This file is prepared locally for audit, staging verification, and version control.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. TWO-CALENDAR-DAY RENTAL BUFFER (GIST EXCLUSION CONSTRAINT)
-- ------------------------------------------------------------------------------

-- In PostgreSQL half-open date intervals [start, end), a rental covering
-- start_date through end_date plus 2 buffer days is mathematically represented
-- as daterange(start_date, end_date + 3, '[)').
--
-- Example:
--   Pickup: Oct 20, Return: Oct 22 (Rental days: Oct 20, 21, 22).
--   Buffer days: Oct 23, Oct 24.
--   Blocked interval: [2026-10-20, 2026-10-25) -> contains 20, 21, 22, 23, 24.
--   Next allowed booking start: Oct 25 ([2026-10-25, ...) does NOT overlap).

-- Add generated blocked_period column to public.reservations
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS blocked_period DATERANGE 
  GENERATED ALWAYS AS (daterange(start_date, end_date + 3, '[)')) STORED;

-- Add agreement_version column to public.reservations for quick reference
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS agreement_version VARCHAR(20) DEFAULT 'v1.0';

-- Drop legacy non-buffered constraint if present
ALTER TABLE public.reservations
  DROP CONSTRAINT IF EXISTS prevent_camera_reservation_overlap;

-- Enforce the buffer at the PostgreSQL storage engine level via btree_gist
ALTER TABLE public.reservations
  ADD CONSTRAINT prevent_camera_reservation_overlap
  EXCLUDE USING gist (
    camera_id WITH =,
    blocked_period WITH &&
  )
  WHERE (status IN ('PENDING_APPROVAL', 'APPROVED'));

-- ------------------------------------------------------------------------------
-- 2. CUSTOMER RENTAL AGREEMENT ACCEPTANCES TABLE
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.rental_agreement_acceptances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  agreement_id VARCHAR(100) NOT NULL,
  agreement_version VARCHAR(20) NOT NULL,
  agreement_text_snapshot TEXT NOT NULL,
  agreement_hash VARCHAR(64) NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_reservation_agreement_acceptance UNIQUE (reservation_id)
);

-- Indexes for audit, customer dashboard, and version tracking lookups
CREATE INDEX IF NOT EXISTS idx_rental_agreement_customer 
  ON public.rental_agreement_acceptances(customer_id);

CREATE INDEX IF NOT EXISTS idx_rental_agreement_reservation 
  ON public.rental_agreement_acceptances(reservation_id);

CREATE INDEX IF NOT EXISTS idx_rental_agreement_version 
  ON public.rental_agreement_acceptances(agreement_version);

-- ------------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY (RLS) FOR AGREEMENT ACCEPTANCES
-- ------------------------------------------------------------------------------

ALTER TABLE public.rental_agreement_acceptances ENABLE ROW LEVEL SECURITY;

-- Select Policy: Customers can read only their own agreements; Admins can read all
DROP POLICY IF EXISTS "rental_agreement_select_policy" ON public.rental_agreement_acceptances;
CREATE POLICY "rental_agreement_select_policy" ON public.rental_agreement_acceptances
  FOR SELECT USING (
    customer_id = public.current_profile_id() OR
    public.get_auth_role() = 'ADMIN'
  );

-- Insert Policy: Authenticated customers can record acceptance for their own profile
DROP POLICY IF EXISTS "rental_agreement_insert_policy" ON public.rental_agreement_acceptances;
CREATE POLICY "rental_agreement_insert_policy" ON public.rental_agreement_acceptances
  FOR INSERT WITH CHECK (
    customer_id = public.current_profile_id() OR
    public.get_auth_role() = 'ADMIN'
  );

-- Immutability Protection:
-- Historical acceptance records must NEVER be updated or deleted by normal users or admins.
-- Revoke UPDATE and DELETE permissions from authenticated and anonymous roles.
REVOKE UPDATE, DELETE ON public.rental_agreement_acceptances FROM authenticated, anon, public;

COMMIT;

-- ==============================================================================
-- VERIFICATION QUERIES (RUN IN STAGING TO VALIDATE CORRECTNESS)
-- ==============================================================================
-- 1. Check generated blocked_period calculation:
--    SELECT id, reference_no, start_date, end_date, blocked_period FROM public.reservations LIMIT 5;
--
-- 2. Verify overlap constraint rejects adjacent buffer collisions:
--    -- Should fail with exclusion violation:
--    INSERT INTO public.reservations (reference_no, customer_id, camera_id, start_date, end_date, total_days, daily_rate_snapshot, subtotal_php, security_deposit_php, total_amount_php, purpose, status)
--    VALUES ('TEST-CONFLICT-1', '<cust-uuid>', 'CAM-SONY-A7IV', '2026-10-20', '2026-10-22', 3, 1500, 4500, 3000, 7500, 'Test', 'PENDING_APPROVAL');
--    -- Next attempt starting on buffer day (Oct 23):
--    INSERT INTO public.reservations (reference_no, customer_id, camera_id, start_date, end_date, total_days, daily_rate_snapshot, subtotal_php, security_deposit_php, total_amount_php, purpose, status)
--    VALUES ('TEST-CONFLICT-2', '<cust-uuid>', 'CAM-SONY-A7IV', '2026-10-23', '2026-10-24', 2, 1500, 3000, 3000, 6000, 'Test', 'PENDING_APPROVAL');
--
-- 3. Verify acceptance records RLS and immutability:
--    SELECT * FROM public.rental_agreement_acceptances WHERE customer_id = public.current_profile_id();
-- ==============================================================================

-- ==============================================================================
-- ROLLBACK SCRIPT (IF REVERSAL IS REQUIRED IN STAGING)
-- ==============================================================================
/*
BEGIN;
DROP TABLE IF EXISTS public.rental_agreement_acceptances CASCADE;
ALTER TABLE public.reservations DROP CONSTRAINT IF EXISTS prevent_camera_reservation_overlap;
ALTER TABLE public.reservations DROP COLUMN IF EXISTS blocked_period;
ALTER TABLE public.reservations DROP COLUMN IF EXISTS agreement_version;

-- Restore legacy non-buffered constraint
ALTER TABLE public.reservations
ADD CONSTRAINT prevent_camera_reservation_overlap
EXCLUDE USING gist (
  camera_id WITH =,
  rental_period WITH &&
)
WHERE (status IN ('PENDING_APPROVAL', 'APPROVED'));
COMMIT;
*/
