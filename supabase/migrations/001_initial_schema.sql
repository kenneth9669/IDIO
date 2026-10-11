-- ==============================================================================
-- IDIO Digital Camera Rental Management System
-- Schema Migration: 001_initial_schema.sql
-- Target: PostgreSQL 15+ / Supabase
-- Location: Butuan City, Agusan del Norte, Philippines
-- Roles: Strictly CUSTOMER and ADMIN (2 Roles)
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist"; -- Required for GIST date range exclusion constraint

-- 2. ENUMERATED DOMAIN TYPES
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('CUSTOMER', 'ADMIN');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.camera_category AS ENUM ('Mirrorless', 'Compact', 'DSLR', 'Vlog & Creator');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.camera_status AS ENUM ('AVAILABLE', 'RESERVED', 'CHECKED_OUT', 'MAINTENANCE', 'DAMAGED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.camera_condition AS ENUM ('Excellent', 'Good', 'Fair', 'Damaged');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.reservation_status AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.rental_status AS ENUM ('CHECKED_OUT', 'RETURNED', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_method AS ENUM ('GCASH', 'CASH_PICKUP', 'MAYA', 'BANK_TRANSFER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM ('PENDING', 'PAID', 'REFUNDED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.deposit_status AS ENUM ('HELD', 'REFUNDED', 'DEDUCTED', 'FORFEITED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.maintenance_severity AS ENUM ('Low', 'Medium', 'High', 'Critical');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.maintenance_status AS ENUM ('Under Service', 'Parts Ordered', 'Completed', 'Decommissioned');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 3. PROFILES TABLE (Linked to Supabase auth.users; optional clerk_id for Clerk SSO)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  clerk_id VARCHAR(255) UNIQUE,
  role public.user_role NOT NULL DEFAULT 'CUSTOMER',
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(50) NOT NULL,
  avatar_url TEXT,
  barangay VARCHAR(100) NOT NULL,
  street_address TEXT NOT NULL,
  city VARCHAR(100) NOT NULL DEFAULT 'Butuan City',
  province VARCHAR(100) NOT NULL DEFAULT 'Agusan del Norte',
  id_type VARCHAR(100) NOT NULL,
  id_number VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_fixed_city CHECK (city = 'Butuan City'),
  CONSTRAINT check_fixed_province CHECK (province = 'Agusan del Norte'),
  CONSTRAINT check_curated_barangay CHECK (barangay IN (
    'Libertad', 'San Vicente', 'Ambago', 'Baan Km. 3', 'Doongan', 'Ampayon',
    'Villa Kananga', 'Holy Redeemer', 'Obrero', 'Taguibo', 'Golden Ribbon',
    'Limaha', 'Agao', 'Agusan Pequeno', 'Bancasi', 'Bading', 'Buhangin',
    'Bitan-agan', 'Tiniwisan', 'Imadejas'
  ))
);

-- 4. DIGITAL CAMERAS FLEET TABLE
CREATE TABLE IF NOT EXISTS public.digital_cameras (
  id VARCHAR(30) PRIMARY KEY, -- e.g. 'CAM-001'
  serial_number VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  brand VARCHAR(100) NOT NULL,
  model VARCHAR(100) NOT NULL,
  category public.camera_category NOT NULL,
  daily_rate_php NUMERIC(10, 2) NOT NULL CHECK (daily_rate_php > 0),
  security_deposit_php NUMERIC(10, 2) NOT NULL CHECK (security_deposit_php >= 0),
  status public.camera_status NOT NULL DEFAULT 'AVAILABLE',
  condition public.camera_condition NOT NULL DEFAULT 'Excellent',
  specs JSONB NOT NULL,
  description TEXT NOT NULL,
  image_url TEXT NOT NULL,
  package_includes JSONB NOT NULL DEFAULT '[]'::jsonb,
  maintenance_notes TEXT,
  total_rentals_count INT NOT NULL DEFAULT 0 CHECK (total_rentals_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. RESERVATIONS TABLE (Customer Booking Workflow)
CREATE TABLE IF NOT EXISTS public.reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_no VARCHAR(50) UNIQUE NOT NULL,
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  camera_id VARCHAR(30) NOT NULL REFERENCES public.digital_cameras(id) ON DELETE RESTRICT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  -- Half-open range [start_date, end_date + 1) guarantees exact inclusive dates without adjacent collision
  rental_period DATERANGE GENERATED ALWAYS AS (daterange(start_date, end_date + 1, '[)')) STORED,
  total_days INT NOT NULL CHECK (total_days >= 1),
  daily_rate_snapshot NUMERIC(10, 2) NOT NULL CHECK (daily_rate_snapshot > 0),
  subtotal_php NUMERIC(10, 2) NOT NULL CHECK (subtotal_php > 0),
  security_deposit_php NUMERIC(10, 2) NOT NULL CHECK (security_deposit_php >= 0),
  total_amount_php NUMERIC(10, 2) NOT NULL CHECK (total_amount_php > 0),
  purpose TEXT NOT NULL,
  status public.reservation_status NOT NULL DEFAULT 'PENDING_APPROVAL',
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT check_valid_date_order CHECK (end_date >= start_date)
);

-- Concurrency Exclude Constraint: Prevents any 2 active reservations from overlapping dates on the same camera
ALTER TABLE public.reservations
DROP CONSTRAINT IF EXISTS prevent_camera_reservation_overlap;

ALTER TABLE public.reservations
ADD CONSTRAINT prevent_camera_reservation_overlap
EXCLUDE USING gist (
  camera_id WITH =,
  rental_period WITH &&
)
WHERE (status IN ('PENDING_APPROVAL', 'APPROVED'));

-- 6. RENTALS TABLE (Physical Handover & Return Lifecycle)
CREATE TABLE IF NOT EXISTS public.rentals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID UNIQUE NOT NULL REFERENCES public.reservations(id) ON DELETE RESTRICT,
  camera_id VARCHAR(30) NOT NULL REFERENCES public.digital_cameras(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  checkout_admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  checkout_condition public.camera_condition NOT NULL,
  checkout_notes TEXT,
  checked_out_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status public.rental_status NOT NULL DEFAULT 'CHECKED_OUT',
  return_admin_id UUID REFERENCES public.profiles(id) ON DELETE RESTRICT,
  return_condition public.camera_condition,
  return_inspection_notes TEXT,
  returned_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. PAYMENTS & DEPOSITS TABLE (Simulated / Recorded Academic Accounting)
CREATE TABLE IF NOT EXISTS public.payments_and_deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID UNIQUE NOT NULL REFERENCES public.reservations(id) ON DELETE RESTRICT,
  rental_amount_php NUMERIC(10, 2) NOT NULL CHECK (rental_amount_php >= 0),
  payment_method public.payment_method NOT NULL DEFAULT 'GCASH',
  payment_status public.payment_status NOT NULL DEFAULT 'PENDING',
  payment_reference VARCHAR(100),
  security_deposit_php NUMERIC(10, 2) NOT NULL CHECK (security_deposit_php >= 0),
  deposit_status public.deposit_status NOT NULL DEFAULT 'HELD',
  deposit_deduction_php NUMERIC(10, 2) DEFAULT 0 CHECK (deposit_deduction_php >= 0),
  deposit_deduction_reason TEXT,
  settled_by_admin_id UUID REFERENCES public.profiles(id),
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. MAINTENANCE TICKETS TABLE (Optical & Hardware Quality Checks)
CREATE TABLE IF NOT EXISTS public.maintenance_tickets (
  id VARCHAR(50) PRIMARY KEY,
  camera_id VARCHAR(30) NOT NULL REFERENCES public.digital_cameras(id) ON DELETE RESTRICT,
  issue_type VARCHAR(100) NOT NULL,
  severity public.maintenance_severity NOT NULL DEFAULT 'Medium',
  description TEXT NOT NULL,
  cost_estimate_php NUMERIC(10, 2) DEFAULT 0 CHECK (cost_estimate_php >= 0),
  status public.maintenance_status NOT NULL DEFAULT 'Under Service',
  reported_by_admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  completion_date DATE,
  technician_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. AUDIT & ACTIVITY LOGS TABLE
CREATE TABLE IF NOT EXISTS public.activity_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  actor_name VARCHAR(150) NOT NULL,
  actor_role public.user_role NOT NULL,
  action VARCHAR(100) NOT NULL,
  details TEXT NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  target_id VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. INDEXES FOR HIGH-PERFORMANCE QUERIES
CREATE INDEX IF NOT EXISTS idx_digital_cameras_status ON public.digital_cameras(status);
CREATE INDEX IF NOT EXISTS idx_digital_cameras_category ON public.digital_cameras(category);
CREATE INDEX IF NOT EXISTS idx_reservations_customer ON public.reservations(customer_id);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON public.reservations(status);
CREATE INDEX IF NOT EXISTS idx_rentals_status ON public.rentals(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_camera ON public.maintenance_tickets(camera_id, status);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON public.activity_audit_logs(created_at DESC);

-- ==============================================================================
-- 11. ROW LEVEL SECURITY (RLS) POLICIES (Strictly 2 Roles: CUSTOMER & ADMIN)
-- ==============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.digital_cameras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments_and_deposits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper function to fetch current authenticated user's role from public.profiles
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- PROFILES POLICIES
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
  FOR SELECT USING (
    auth.uid() = id OR public.get_auth_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (
    auth.uid() = id OR public.get_auth_role() = 'ADMIN'
  );

-- Authenticated users can insert their own profile row (id must match their auth.uid())
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- DIGITAL CAMERAS POLICIES
-- Anyone authenticated or browsing can see camera fleet catalog
DROP POLICY IF EXISTS "cameras_select_all" ON public.digital_cameras;
CREATE POLICY "cameras_select_all" ON public.digital_cameras
  FOR SELECT USING (true);

-- Only Admin can mutate digital camera fleet records
DROP POLICY IF EXISTS "cameras_admin_mutation" ON public.digital_cameras;
CREATE POLICY "cameras_admin_mutation" ON public.digital_cameras
  FOR ALL USING (public.get_auth_role() = 'ADMIN');

-- RESERVATIONS POLICIES
-- Customers see only their own bookings; Admin sees all
DROP POLICY IF EXISTS "reservations_select" ON public.reservations;
CREATE POLICY "reservations_select" ON public.reservations
  FOR SELECT USING (
    auth.uid() = customer_id OR public.get_auth_role() = 'ADMIN'
  );

-- Customers can insert their own reservations
DROP POLICY IF EXISTS "reservations_insert_customer" ON public.reservations;
CREATE POLICY "reservations_insert_customer" ON public.reservations
  FOR INSERT WITH CHECK (
    auth.uid() = customer_id AND public.get_auth_role() = 'CUSTOMER'
  );

-- Customers can cancel their own pending reservations; Admin can approve/reject
DROP POLICY IF EXISTS "reservations_update" ON public.reservations;
CREATE POLICY "reservations_update" ON public.reservations
  FOR UPDATE USING (
    (auth.uid() = customer_id AND status = 'PENDING_APPROVAL') OR
    public.get_auth_role() = 'ADMIN'
  );

-- RENTALS POLICIES
-- Customers see their own active rentals; Admin sees all
DROP POLICY IF EXISTS "rentals_select" ON public.rentals;
CREATE POLICY "rentals_select" ON public.rentals
  FOR SELECT USING (
    auth.uid() = customer_id OR public.get_auth_role() = 'ADMIN'
  );

-- Only Admin can execute checkout (INSERT) and return inspection (UPDATE)
DROP POLICY IF EXISTS "rentals_admin_mutate" ON public.rentals;
CREATE POLICY "rentals_admin_mutate" ON public.rentals
  FOR ALL USING (public.get_auth_role() = 'ADMIN');

-- PAYMENTS & DEPOSITS POLICIES
DROP POLICY IF EXISTS "payments_select" ON public.payments_and_deposits;
CREATE POLICY "payments_select" ON public.payments_and_deposits
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.reservations r
      WHERE r.id = reservation_id AND (r.customer_id = auth.uid() OR public.get_auth_role() = 'ADMIN')
    )
  );

DROP POLICY IF EXISTS "payments_admin_mutate" ON public.payments_and_deposits;
CREATE POLICY "payments_admin_mutate" ON public.payments_and_deposits
  FOR ALL USING (public.get_auth_role() = 'ADMIN');

-- MAINTENANCE TICKETS POLICIES
-- Only Admin can view and manage maintenance tickets
DROP POLICY IF EXISTS "maintenance_admin" ON public.maintenance_tickets;
CREATE POLICY "maintenance_admin" ON public.maintenance_tickets
  FOR ALL USING (public.get_auth_role() = 'ADMIN');

-- AUDIT LOGS POLICIES
-- Audit logs are append-only; readable by Admin only
DROP POLICY IF EXISTS "audit_admin_select" ON public.activity_audit_logs;
CREATE POLICY "audit_admin_select" ON public.activity_audit_logs
  FOR SELECT USING (public.get_auth_role() = 'ADMIN');

DROP POLICY IF EXISTS "audit_insert_any_authenticated" ON public.activity_audit_logs;
CREATE POLICY "audit_insert_any_authenticated" ON public.activity_audit_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
