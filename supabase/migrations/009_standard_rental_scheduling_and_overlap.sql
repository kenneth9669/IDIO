-- ==============================================================================
-- IDIO Database Migration: 009_standard_rental_scheduling_and_overlap.sql
-- Scope:
--   1. Restore Standard Rental Scheduling (Exact Half-Open DATERANGE Overlap Prevention)
--   2. Drop Artificial Multi-Day Scheduling Buffer from GIST Exclusion Constraint
--   3. Ensure Concurrent Conflicting Bookings are Blocked at Database Storage Engine Level
-- Target: PostgreSQL 15+ / Supabase
--
-- CRITICAL SAFETY DIRECTIVE:
--   DO NOT APPLY THIS MIGRATION TO THE LIVE DATABASE.
--   This file is prepared locally for audit, staging verification, and version control.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. STANDARD NON-CONFLICTING RENTAL SCHEDULING (GIST EXCLUSION CONSTRAINT)
-- ------------------------------------------------------------------------------
--
-- Mathematical Model:
-- In PostgreSQL half-open date intervals [start, end), a rental covering
-- start_date through end_date is represented as daterange(start_date, end_date + 1, '[)').
--
-- Example (As requested):
--   Customer A rents Camera A from Oct 20–22:
--     Range: [2026-10-20, 2026-10-23) -> contains Oct 20, Oct 21, Oct 22.
--   Customer B requests Camera A from Oct 23–25:
--     Range: [2026-10-23, 2026-10-26) -> contains Oct 23, Oct 24, Oct 25.
--     Intersection: [2026-10-20, 2026-10-23) && [2026-10-23, 2026-10-26) = FALSE!
--     Customer B may proceed seamlessly without conflict.
--   Customer C requests Camera A from Oct 21–23:
--     Range: [2026-10-21, 2026-10-24) -> overlaps Customer A on Oct 21 and 22.
--     Intersection: [2026-10-20, 2026-10-23) && [2026-10-21, 2026-10-24) = TRUE!
--     PostgreSQL GIST exclusion constraint prevents Customer C reservation.

-- 1. Ensure rental_period generated column exists with standard interval [start_date, end_date + 1)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'reservations' 
      AND column_name = 'rental_period'
  ) THEN
    ALTER TABLE public.reservations
      ADD COLUMN rental_period DATERANGE 
      GENERATED ALWAYS AS (daterange(start_date, end_date + 1, '[)')) STORED;
  END IF;
END $$;

-- 2. Drop the buffer-based constraint from migration 008
ALTER TABLE public.reservations
  DROP CONSTRAINT IF EXISTS prevent_camera_reservation_overlap;

-- 3. Re-establish pure non-overlapping constraint using rental_period
ALTER TABLE public.reservations
  ADD CONSTRAINT prevent_camera_reservation_overlap
  EXCLUDE USING gist (
    camera_id WITH =,
    rental_period WITH &&
  )
  WHERE (status IN ('PENDING_APPROVAL', 'APPROVED'));

-- 4. Mark legacy blocked_period column as deprecated or drop if no longer referenced
ALTER TABLE public.reservations
  DROP COLUMN IF EXISTS blocked_period;

COMMIT;

-- ==============================================================================
-- VERIFICATION QUERIES (RUN IN STAGING TO VALIDATE CORRECTNESS)
-- ==============================================================================
-- 1. Check generated rental_period calculation:
--    SELECT id, reference_no, start_date, end_date, rental_period FROM public.reservations LIMIT 5;
--
-- 2. Verify adjacent non-conflicting booking is permitted:
--    -- Customer A (Oct 20-22):
--    INSERT INTO public.reservations (reference_no, customer_id, camera_id, start_date, end_date, total_days, daily_rate_snapshot, subtotal_php, security_deposit_php, total_amount_php, purpose, status)
--    VALUES ('TEST-A', '<cust-uuid>', 'CAM-SONY-A7IV', '2026-10-20', '2026-10-22', 3, 1500, 4500, 3000, 7500, 'Test', 'PENDING_APPROVAL');
--    -- Customer B (Oct 23-25): Must SUCCEED:
--    INSERT INTO public.reservations (reference_no, customer_id, camera_id, start_date, end_date, total_days, daily_rate_snapshot, subtotal_php, security_deposit_php, total_amount_php, purpose, status)
--    VALUES ('TEST-B', '<cust-uuid>', 'CAM-SONY-A7IV', '2026-10-23', '2026-10-25', 3, 1500, 4500, 3000, 7500, 'Test', 'PENDING_APPROVAL');
--
-- 3. Verify overlapping booking is rejected:
--    -- Customer C (Oct 21-23): Must FAIL with exclusion violation:
--    INSERT INTO public.reservations (reference_no, customer_id, camera_id, start_date, end_date, total_days, daily_rate_snapshot, subtotal_php, security_deposit_php, total_amount_php, purpose, status)
--    VALUES ('TEST-C', '<cust-uuid>', 'CAM-SONY-A7IV', '2026-10-21', '2026-10-23', 3, 1500, 4500, 3000, 7500, 'Test', 'PENDING_APPROVAL');
