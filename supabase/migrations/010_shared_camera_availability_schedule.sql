-- ==============================================================================
-- IDIO — Migration 010: Shared Camera Availability Schedule & Realtime Support
-- ==============================================================================
-- Description:
--   1. Provides a high-performance, privacy-preserving PostgreSQL function
--      `get_camera_availability_schedule(p_camera_id TEXT)` that returns only
--      booked date intervals and their operational status ('RESERVED' or 'RENTED').
--   2. Strict Zero-PII Guarantee: Exposes NO customer IDs, names, emails,
--      payment details, or financial totals to other customers.
--   3. Uses SECURITY DEFINER to allow anonymous catalog visitors and authenticated
--      customers to view accurate camera schedules without weakening RLS policies
--      on `public.reservations` or `public.rentals`.
--   4. Configures publication for Supabase Realtime updates.
-- ==============================================================================

-- 1. Create or replace the availability schedule RPC function
CREATE OR REPLACE FUNCTION public.get_camera_availability_schedule(p_camera_id TEXT)
RETURNS TABLE (
  start_date DATE,
  end_date DATE,
  schedule_status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Active checked-out rentals (currently in renter possession)
  RETURN QUERY
  SELECT
    r.start_date,
    r.end_date,
    'RENTED'::TEXT AS schedule_status
  FROM public.rentals rent
  JOIN public.reservations r ON rent.reservation_id = r.id
  WHERE rent.camera_id = p_camera_id
    AND rent.status = 'CHECKED_OUT';

  -- 2. Active confirmed or pending reservations awaiting pickup
  RETURN QUERY
  SELECT
    r.start_date,
    r.end_date,
    'RESERVED'::TEXT AS schedule_status
  FROM public.reservations r
  WHERE r.camera_id = p_camera_id
    AND r.status IN ('PENDING_APPROVAL', 'APPROVED')
    AND NOT EXISTS (
      SELECT 1 FROM public.rentals rent
      WHERE rent.reservation_id = r.id
        AND rent.status = 'CHECKED_OUT'
    );
END;
$$;

-- Grant execution to all clients (anonymous browsers and authenticated customers)
GRANT EXECUTE ON FUNCTION public.get_camera_availability_schedule(TEXT) TO anon, authenticated, service_role;

-- 2. Add composite index for high-performance camera date range lookups
CREATE INDEX IF NOT EXISTS idx_reservations_camera_active_dates
  ON public.reservations (camera_id, start_date, end_date)
  WHERE status IN ('PENDING_APPROVAL', 'APPROVED');

CREATE INDEX IF NOT EXISTS idx_rentals_camera_checked_out
  ON public.rentals (camera_id, status)
  WHERE status = 'CHECKED_OUT';

-- 3. Enable Realtime Replication for instant multi-user synchronization
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.reservations;
    EXCEPTION WHEN duplicate_object THEN
      -- Table already in publication, ignore
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.rentals;
    EXCEPTION WHEN duplicate_object THEN
      -- Table already in publication, ignore
    END;
  END IF;
END $$;
