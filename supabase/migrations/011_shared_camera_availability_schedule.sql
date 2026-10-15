-- ==============================================================================
-- IDIO — Migration 011: Authoritative Shared Camera Availability Schedule
-- ==============================================================================
-- Description:
--   1. Provides the single source of truth for camera availability across all
--      customer sessions and anonymous visitors.
--   2. Strict Zero-PII Guarantee: Exposes only date intervals and operational status
--      ('RENTED', 'RESERVED', or 'UNAVAILABLE'). Exposes NO customer IDs, names,
--      emails, contact information, or payment amounts.
--   3. Uses SECURITY DEFINER to bypass table-level RLS policies that isolate
--      customer reservations, ensuring Customer A and Customer B receive the
--      exact same availability schedule for the same camera and dates.
--   4. Incorporates:
--      - Active checked-out rentals ('RENTED')
--      - Confirmed or pending reservations ('RESERVED')
--      - Active maintenance ticket intervals ('UNAVAILABLE')
--   5. Realtime publication ensures instant multi-user synchronization.
-- ==============================================================================

-- 1. Create or replace the authoritative availability schedule RPC function
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
  -- 1. Active checked-out rentals (camera physically in customer possession)
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

  -- 3. Maintenance intervals from active maintenance tickets
  RETURN QUERY
  SELECT
    mt.start_date::DATE,
    COALESCE(mt.completion_date, mt.start_date + INTERVAL '2 days')::DATE,
    'UNAVAILABLE'::TEXT AS schedule_status
  FROM public.maintenance_tickets mt
  WHERE mt.camera_id = p_camera_id
    AND mt.status IN ('Scheduled', 'In Progress');
END;
$$;

-- Grant execution to all clients (anonymous browsers and authenticated customers)
GRANT EXECUTE ON FUNCTION public.get_camera_availability_schedule(TEXT) TO anon, authenticated, service_role;

-- 2. Composite indexes for high-performance date range filtering
CREATE INDEX IF NOT EXISTS idx_reservations_camera_active_dates
  ON public.reservations (camera_id, start_date, end_date)
  WHERE status IN ('PENDING_APPROVAL', 'APPROVED');

CREATE INDEX IF NOT EXISTS idx_rentals_camera_checked_out
  ON public.rentals (camera_id, status)
  WHERE status = 'CHECKED_OUT';

CREATE INDEX IF NOT EXISTS idx_maintenance_camera_active
  ON public.maintenance_tickets (camera_id, status)
  WHERE status IN ('Scheduled', 'In Progress');

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
