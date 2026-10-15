-- ==============================================================================
-- IDIO Database Security Verification Test Script
-- Target: Isolated Staging / Local Supabase Database ONLY
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- SETUP: Seed Reference Fleet Camera & Roles
-- ------------------------------------------------------------------------------
INSERT INTO public.digital_cameras (
  id, serial_number, name, brand, model, category, daily_rate_php,
  security_deposit_php, status, condition, specs, description, image_url
) VALUES (
  'CAM-TEST-01', 'SN-TEST-8899', 'Sony A7 IV Fleet Test', 'Sony', 'ILCE-7M4',
  'Mirrorless', 1500.00, 5000.00, 'AVAILABLE', 'Excellent',
  '{"sensor": "Full-Frame"}'::jsonb, 'Fleet test camera', 'https://example.com/cam.jpg'
) ON CONFLICT (id) DO NOTHING;

-- Seed Customer 1 Profile
INSERT INTO public.profiles (
  id, clerk_id, role, full_name, email, phone, barangay, street_address, id_type, id_number
) VALUES (
  '11111111-1111-1111-1111-111111111111', 'user_clerk_cust_01', 'CUSTOMER',
  'Customer One', 'cust1@example.com', '0917-111-1111', 'Libertad', 'Butuan City',
  'PhilSys', 'ID-111'
) ON CONFLICT (id) DO NOTHING;

-- Seed Customer 2 Profile
INSERT INTO public.profiles (
  id, clerk_id, role, full_name, email, phone, barangay, street_address, id_type, id_number
) VALUES (
  '22222222-2222-2222-2222-222222222222', 'user_clerk_cust_02', 'CUSTOMER',
  'Customer Two', 'cust2@example.com', '0917-222-2222', 'Libertad', 'Butuan City',
  'PhilSys', 'ID-222'
) ON CONFLICT (id) DO NOTHING;

-- Seed Admin Profile
INSERT INTO public.profiles (
  id, clerk_id, role, full_name, email, phone, barangay, street_address, id_type, id_number
) VALUES (
  '99999999-9999-9999-9999-999999999999', 'user_clerk_admin_01', 'ADMIN',
  'Staff Admin', 'admin@example.com', '0917-999-9999', 'Libertad', 'Butuan City',
  'PhilSys', 'ID-999'
) ON CONFLICT (id) DO NOTHING;

COMMIT;

-- ==============================================================================
-- TEST CASE 1: Anonymous User Permissions
-- Expected: Public catalog readable; private tables return 0 rows or block inserts.
-- ==============================================================================
SET LOCAL role = 'anon';
SET LOCAL request.jwt.claim.sub = '';

-- 1.1 Public catalog read -> EXPECTED: 1 row
SELECT count(*) AS anon_camera_count FROM public.digital_cameras WHERE id = 'CAM-TEST-01';

-- 1.2 Anonymous read on reservations -> EXPECTED: 0 rows
SELECT count(*) AS anon_reservation_count FROM public.reservations;

-- 1.3 Anonymous insert attempt on reservations -> EXPECTED: ERROR 42501 (RLS violation)
DO $$
BEGIN
  INSERT INTO public.reservations (
    reference_no, customer_id, camera_id, start_date, end_date,
    total_days, daily_rate_snapshot, subtotal_php, security_deposit_php,
    total_amount_php, purpose, status
  ) VALUES (
    'REF-ANON-FAIL', '11111111-1111-1111-1111-111111111111', 'CAM-TEST-01',
    CURRENT_DATE + 1, CURRENT_DATE + 3, 2, 1500.00, 3000.00, 5000.00, 8000.00,
    'Anonymous Attack', 'PENDING_APPROVAL'
  );
  RAISE EXCEPTION 'TEST 1.3 FAILED: Anonymous user was able to insert reservation!';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'TEST 1.3 PASSED: Anonymous reservation insert blocked by RLS.';
END $$;

-- ==============================================================================
-- TEST CASE 2: Customer Identity Resolution & Cross-Customer Isolation
-- Expected: Customer 1 can view only their own records; Customer 2's data is invisible.
-- ==============================================================================
SET LOCAL role = 'authenticated';
SET LOCAL request.jwt.claim.sub = 'user_clerk_cust_01';

-- 2.1 Verify Helper Function Evaluation
DO $$
DECLARE
  v_clerk text;
  v_prof uuid;
  v_role public.user_role;
BEGIN
  v_clerk := public.current_clerk_id();
  v_prof := public.current_profile_id();
  v_role := public.get_auth_role();

  IF v_clerk != 'user_clerk_cust_01' THEN
    RAISE EXCEPTION 'TEST 2.1 FAILED: current_clerk_id mismatch: %', v_clerk;
  END IF;
  IF v_prof != '11111111-1111-1111-1111-111111111111'::uuid THEN
    RAISE EXCEPTION 'TEST 2.1 FAILED: current_profile_id mismatch: %', v_prof;
  END IF;
  IF v_role != 'CUSTOMER' THEN
    RAISE EXCEPTION 'TEST 2.1 FAILED: get_auth_role mismatch: %', v_role;
  END IF;
  RAISE NOTICE 'TEST 2.1 PASSED: Identity helpers resolved Customer 1 correctly.';
END $$;

-- 2.2 Customer 1 cannot view Customer 2's profile -> EXPECTED: 0 rows
SELECT count(*) AS cust2_profiles_visible 
FROM public.profiles 
WHERE clerk_id = 'user_clerk_cust_02';

-- 2.3 Customer 1 creates a legitimate pending reservation -> EXPECTED: SUCCESS
INSERT INTO public.reservations (
  id, reference_no, customer_id, camera_id, start_date, end_date,
  total_days, daily_rate_snapshot, subtotal_php, security_deposit_php,
  total_amount_php, purpose, status
) VALUES (
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'REF-TEST-001',
  '11111111-1111-1111-1111-111111111111', 'CAM-TEST-01',
  CURRENT_DATE + 10, CURRENT_DATE + 12, 2, 1500.00, 3000.00, 5000.00, 8000.00,
  'Wedding Shoot in Libertad', 'PENDING_APPROVAL'
) ON CONFLICT (id) DO NOTHING;

-- 2.4 Customer 1 creates pending CASH_PICKUP payment -> EXPECTED: SUCCESS
INSERT INTO public.payments_and_deposits (
  id, reservation_id, rental_amount_php, payment_method, payment_status,
  security_deposit_php, deposit_status
) VALUES (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  3000.00, 'CASH_PICKUP', 'PENDING', 5000.00, 'HELD'
) ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- TEST CASE 3: Customer Cross-Tenant Tampering Attack
-- Expected: Customer 2 cannot see, update, or cancel Customer 1's reservation.
-- ==============================================================================
SET LOCAL role = 'authenticated';
SET LOCAL request.jwt.claim.sub = 'user_clerk_cust_02';

-- 3.1 Customer 2 queries Customer 1's reservation -> EXPECTED: 0 rows
SELECT count(*) AS cust1_reservations_seen_by_cust2 
FROM public.reservations 
WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- 3.2 Customer 2 attempts to cancel Customer 1's reservation -> EXPECTED: 0 rows updated
UPDATE public.reservations 
SET status = 'CANCELLED' 
WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- ==============================================================================
-- TEST CASE 4: Customer Protected Field Tampering During Cancellation
-- Expected: Cancellation succeeds; price tampering raises 42501.
-- ==============================================================================
SET LOCAL role = 'authenticated';
SET LOCAL request.jwt.claim.sub = 'user_clerk_cust_01';

-- 4.1 Malicious update: Customer attempts to lower subtotal while cancelling
DO $$
BEGIN
  UPDATE public.reservations
  SET status = 'CANCELLED', subtotal_php = 1.00
  WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  RAISE EXCEPTION 'TEST 4.1 FAILED: Price tampering was not blocked!';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'TEST 4.1 PASSED: Trigger protect_reservation_mutation blocked price tampering.';
END $$;

-- 4.2 Legitimate cancellation: Customer cancels without mutating fields -> EXPECTED: SUCCESS
UPDATE public.reservations
SET status = 'CANCELLED'
WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- ==============================================================================
-- TEST CASE 5: Concurrency Overlap Protection (GIST Exclusion Constraint)
-- Expected: Two active bookings overlapping on the same camera raise 23P01.
-- ==============================================================================
SET LOCAL role = 'authenticated';
SET LOCAL request.jwt.claim.sub = 'user_clerk_cust_01';

-- Booking A: Nov 1 to Nov 5
INSERT INTO public.reservations (
  id, reference_no, customer_id, camera_id, start_date, end_date,
  total_days, daily_rate_snapshot, subtotal_php, security_deposit_php,
  total_amount_php, purpose, status
) VALUES (
  'c1111111-1111-1111-1111-111111111111', 'REF-OVERLAP-A',
  '11111111-1111-1111-1111-111111111111', 'CAM-TEST-01',
  '2026-11-01', '2026-11-05', 4, 1500.00, 6000.00, 5000.00, 11000.00,
  'Booking A', 'PENDING_APPROVAL'
);

-- Booking B: Nov 3 to Nov 7 (Overlaps Nov 3-5) -> EXPECTED: ERROR 23P01
DO $$
BEGIN
  INSERT INTO public.reservations (
    id, reference_no, customer_id, camera_id, start_date, end_date,
    total_days, daily_rate_snapshot, subtotal_php, security_deposit_php,
    total_amount_php, purpose, status
  ) VALUES (
    'c2222222-2222-2222-2222-222222222222', 'REF-OVERLAP-B',
    '11111111-1111-1111-1111-111111111111', 'CAM-TEST-01',
    '2026-11-03', '2026-11-07', 4, 1500.00, 6000.00, 5000.00, 11000.00,
    'Booking B (Conflict)', 'PENDING_APPROVAL'
  );
  RAISE EXCEPTION 'TEST 5 FAILED: GIST exclusion constraint permitted overlapping bookings!';
EXCEPTION WHEN exclusion_violation THEN
  RAISE NOTICE 'TEST 5 PASSED: GIST constraint prevent_camera_reservation_overlap blocked conflict.';
END $$;

-- ==============================================================================
-- TEST CASE 6: Profile Privilege Escalation Attack
-- Expected: Non-admin inserting or updating role = 'ADMIN' raises 42501.
-- ==============================================================================
SET LOCAL role = 'authenticated';
SET LOCAL request.jwt.claim.sub = 'user_clerk_cust_01';

DO $$
BEGIN
  UPDATE public.profiles
  SET role = 'ADMIN'
  WHERE id = '11111111-1111-1111-1111-111111111111';
  RAISE EXCEPTION 'TEST 6 FAILED: Customer escalated own profile to ADMIN!';
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'TEST 6 PASSED: Trigger protect_profile_role blocked privilege escalation.';
END $$;

-- ==============================================================================
-- TEST CASE 7: Malformed Clerk Identities (22P02 Guardrail)
-- Expected: Non-UUID text subjects resolve safely without PostgreSQL crash.
-- ==============================================================================
SET LOCAL role = 'authenticated';
SET LOCAL request.jwt.claim.sub = 'user_clerk_evil_malformed_!@#$%^&*()';

SELECT public.current_clerk_id(); -- Expected: 'user_clerk_evil_malformed_!@#$%^&*()'
SELECT public.current_profile_id(); -- Expected: NULL (safe trap, zero 22P02 exception)
SELECT public.get_auth_role(); -- Expected: NULL
