-- ==============================================================================
-- IDIO Database Migration: 004_set_default_cash_pickup.sql
-- Scope: Set default payment_method to CASH_PICKUP for new payments
-- Invariant: Preserves historical enum values ('GCASH', 'MAYA', 'BANK_TRANSFER')
-- Target: PostgreSQL 15+ / Supabase
-- Safety Note: DO NOT EXECUTE OR APPLY TO LIVE DATABASE UNTIL APPROVED
-- ==============================================================================

BEGIN;

-- 1. Alter default column value for public.payments_and_deposits
ALTER TABLE public.payments_and_deposits
  ALTER COLUMN payment_method SET DEFAULT 'CASH_PICKUP';

-- 2. Verification comment:
-- Note: Changing the column default alone does not enforce payment restriction
-- against explicit inserts. Full enforcement is provided by server-side validation
-- (validateReservationInput) and the proposed RLS policy (payments_customer_insert).
COMMENT ON COLUMN public.payments_and_deposits.payment_method IS 
  'Settlement method. Defaults to CASH_PICKUP. Historical records may contain GCASH, MAYA, or BANK_TRANSFER.';

COMMIT;
