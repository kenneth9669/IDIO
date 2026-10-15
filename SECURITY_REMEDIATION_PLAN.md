# IDIO — Comprehensive Security Remediation Plan (Clerk Identity Architecture)

**System**: IDIO Digital Camera Rental Management System  
**Authentication Authority**: **Clerk** (`@clerk/nextjs` / Clerk Accounts) — **NON-NEGOTIABLE CORE DECISION**  
**Database**: PostgreSQL 15+ hosted on Supabase (`https://qfhmlwvkgdvysemitilb.supabase.co`)  
**Operating Location**: Butuan City, Agusan del Norte, Philippines  
**Document Status**: **REMEDIATION DESIGN & PLANNING ONLY — NO APPLICATION CODE, MIGRATIONS, OR LIVE DATABASE CHANGES APPLIED YET**  
**Author**: Senior Supabase / PostgreSQL Security Engineer  
**Date**: October 11, 2026  
**Reference Audits**: [SUPABASE_SECURITY_AUDIT.md](file:///c:/Users/DAVE/Desktop/idiot/SUPABASE_SECURITY_AUDIT.md), [SUPABASE_INTEGRATION_AUDIT.md](file:///c:/Users/DAVE/Desktop/idiot/SUPABASE_INTEGRATION_AUDIT.md)  

---

## 1. Verified Facts, Assumptions, and Scope Boundaries

To prevent guesswork, the planning boundaries are explicitly established across three categories:

### 1.1 Verified Facts (Empirically Confirmed in Repository & Live Probes)
1. **Repository Authentication**: The Next.js 16 application contains active `@clerk/nextjs` imports in `layout.tsx`, `middleware.ts`, `Header.tsx`, `login/page.tsx`, `register/page.tsx`, and `auth.ts`.
2. **PostgreSQL Relational Schema**: Table `public.profiles.id` is `UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`. All relational tables (`reservations.customer_id`, `rentals.customer_id`, `rentals.checkout_admin_id`, `payments_and_deposits.settled_by_admin_id`) store `UUID` foreign keys referencing `public.profiles(id)`.
3. **Clerk Identifier Format**: Clerk User IDs are string identifiers formatted as `user_2...` (27–32 characters), which fail PostgreSQL `UUID` syntax checks.
4. **Active Live RLS**: Empirical live probing confirmed that Row Level Security is active across all 7 domain tables. Anonymous queries return 0 rows on all private tables.
5. **No Service-Role Key Exposed**: `SUPABASE_SERVICE_ROLE_KEY` is completely absent from client bundles, git history, and frontend environments. The application communicates using the publishable anonymous key.
6. **Payment Scope Invariant**: New rental reservations are strictly restricted to Cash on Counter Pickup (`CASH_PICKUP`). Historical payment records in the database (`GCASH`, `MAYA`, `BANK_TRANSFER`, `CASH_PICKUP`) must remain intact without data alterations.

### 1.2 Unresolved Assumptions (Require External Verification)
1. **Clerk Dashboard JWT Template Configuration**:
   - *Status*: **UNRESOLVED / EXTERNAL CONFIGURATION**.
   - *Detail*: PostgREST requires a verified JWT signed with the Supabase JWT secret (HS256) or Clerk's JWKS endpoint (RS256). The repository `.env.local` contains `CLERK_SECRET_KEY` and publishable keys, but does not contain `SUPABASE_JWT_SECRET`. It cannot be confirmed from the local workspace whether the Clerk Dashboard has the `supabase` JWT template configured with the live Supabase project secret.
2. **Migration 003 Application on Live Database**:
   - *Status*: **UNRESOLVED IN PRODUCTION**.
   - *Detail*: `SUPABASE_INTEGRATION_AUDIT.md` recorded migration 003 as pending manual execution in the dashboard. Without direct superuser access to `pg_trigger`, it cannot be verified whether `trg_protect_profile_role` is active on the live instance.

### 1.3 Proposed Changes (Awaiting Approval)
- Authoring migration `004_security_hardening_remediation.sql`.
- Updating `clerkSync.ts`, `auth.ts`, `middleware.ts`, `reservationService.ts`, and `reservationValidation.ts`.
- Retiring GCash from new reservation creation forms.

---

## 2. Finding-by-Finding Remediation Matrix

| Finding ID | Severity | Root Cause in Current Code | Proposed Remediation | Target Files / SQL Objects |
|---|---|---|---|---|
| **SEC-01** | **CRITICAL** | `profiles_insert_own` RLS policy checks only `auth.uid() = id`. Trigger `trg_protect_profile_role` runs strictly `BEFORE UPDATE`. Direct REST insert can supply `role: 'ADMIN'`. | 1. Trigger `trg_protect_profile_role` extended to `BEFORE INSERT OR UPDATE`. Non-admins attempting `role = 'ADMIN'` on insert are rejected with `42501`.<br>2. Policy `profiles_insert_own` explicitly checks `(role = 'CUSTOMER' OR public.get_auth_role() = 'ADMIN')`. | `supabase/migrations/004...`<br>Trigger: `trg_protect_profile_role`<br>Policy: `profiles_insert_own` |
| **SEC-02** | **HIGH** | `profiles.id` foreign key `profiles_id_fkey` requires users to exist in Supabase `auth.users`. Clerk IDs are strings. Calling built-in `auth.uid()` crashes with `22P02`. | 1. Drop dead foreign key `profiles_id_fkey`.<br>2. Add helper functions `public.current_clerk_id()` (reads `sub` text) and `public.current_profile_id()` (resolves profile `UUID`).<br>3. Server actions map Clerk ID to persistent profile UUID. | `supabase/migrations/004...`<br>Table: `public.profiles`<br>Functions: `current_clerk_id()`, `current_profile_id()`<br>`src/lib/auth.ts`, `src/lib/clerkSync.ts` |
| **SEC-03** | **HIGH** | Policy `reservations_update` omits `WITH CHECK`. PostgreSQL implicitly tests `status = 'PENDING_APPROVAL'` against the updated `'CANCELLED'` row, raising `42501` on customer cancellation. | Supply explicit `WITH CHECK`: permits customer to update row only when new status is `'CANCELLED'`, while preventing customer from modifying dates, camera ID, or pricing. | `supabase/migrations/004...`<br>Policy: `reservations_update` on `public.reservations` |
| **SEC-04** | **HIGH** | `payments_and_deposits` lacks an `INSERT` policy for customers. `reservationService.ts` ignores payment insertion failure, dropping ledger rows under RLS. | 1. Add policy `payments_customer_insert` restricted to `payment_method = 'CASH_PICKUP'`, status `'PENDING'`, and deposit `'HELD'`.<br>2. Assert payment insert result in server action. | `supabase/migrations/004...`<br>Policy: `payments_customer_insert`<br>`src/lib/reservations/reservationService.ts` |
| **SEC-05** | **MEDIUM** | Direct PostgREST callers can send `POST /rest/v1/reservations` with `status: 'APPROVED'` and forged prices (`0.01 PHP`). RLS policy did not enforce server-calculated rates. | Add database `BEFORE INSERT` trigger `trg_enforce_reservation_pricing_and_status` that fetches trusted rates directly from `digital_cameras`, calculates exact days and totals, and forces `status := 'PENDING_APPROVAL'`. | `supabase/migrations/004...`<br>Trigger: `trg_enforce_reservation_pricing_and_status`<br>Policy: `reservations_insert_customer` |
| **SEC-06** | **MEDIUM** | `audit_insert_any_authenticated` only checks `auth.uid() IS NOT NULL`, allowing callers to forge `actor_role = 'ADMIN'` or impersonate other users. | Harden policy `audit_insert_actor_bound` to enforce `actor_id = public.current_profile_id() AND actor_role = public.get_auth_role()`. | `supabase/migrations/004...`<br>Policy: `audit_insert_actor_bound` on `public.activity_audit_logs` |
| **SEC-07** | **LOW** | Migration 003 application status in production was unverified. | Migration 004 is authored to be fully re-entrant and self-healing. Preflight queries verify existing state before execution. | `supabase/migrations/004...`<br>Preflight SQL queries |

---

## 3. Detailed Technical Resolutions for the Eight Blocking Issues

### 3.1 Issue 1: Clerk JWT Integration & Verification Mechanics
- **How Supabase Verifies Clerk JWTs**:
  When a request arrives at Supabase PostgREST with `Authorization: Bearer <clerk_jwt>`:
  1. **Signature Verification**: PostgREST validates the cryptographic signature using either the shared HMAC-SHA256 secret (`PGRST_JWT_SECRET`) or Clerk's JWKS endpoint (Third-Party OIDC). If the signature is forged or invalid, PostgREST terminates the connection with `401 Unauthorized: Invalid JWT`.
  2. **Claims Validation**: PostgREST validates expiry (`exp`), not-before (`nbf`), and sets transaction parameters:
     - `request.jwt.claim.sub`: Set to the verified Clerk User ID (`user_...`).
     - `request.jwt.claim.role`: Set to `'authenticated'`.
  3. **No Header Spoofing**: Clients **cannot** inject or spoof `request.jwt.claim.sub` via HTTP request headers. PostgREST populates GUC configuration settings strictly from the cryptographically verified JWT payload.
  4. **Why `auth.uid()` Cannot Be Used**:
     ```sql
     -- Supabase built-in auth.uid() definition:
     CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
       SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
     $$ LANGUAGE sql STABLE;
     ```
     Because Clerk user IDs are strings (e.g. `user_2bF89xKL34...`), calling `auth.uid()` throws:
     `ERROR: 22P02: invalid input syntax for type uuid: "user_2bF89xKL34..."`.
  5. **Required External Prerequisite**:
     In the Clerk Dashboard (`https://dashboard.clerk.com`):
     - Navigate to **Configure** -> **JWT Templates** -> Create a template named `supabase`.
     - Claims template:
       ```json
       {
         "aud": "authenticated",
         "role": "authenticated",
         "email": "{{user.primary_email_address}}",
         "sub": "{{user.id}}"
       }
       ```
     - Sign with the Supabase JWT secret from Supabase Dashboard -> Settings -> API -> JWT Secret.

---

### 3.2 Issue 2: Review of SQL Helper Functions (Security-Definer & Recursion Audits)

The helper functions must be audited for search-path safety, infinite RLS recursion, duplicate matches, and execution privileges:

#### Function 1: `public.current_clerk_id()`
```sql
CREATE OR REPLACE FUNCTION public.current_clerk_id()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::text;
$$;
```
- **Audited Properties**:
  - *Context*: `STABLE`, non-security definer. Safe because it only reads the session GUC setting.
  - *Search Path*: Hardened to `pg_catalog, public` to eliminate search-path injection.
  - *Missing Identity*: Returns `NULL` if caller is unauthenticated or token is missing.
  - *Privileges*: `REVOKE EXECUTE ON FUNCTION public.current_clerk_id() FROM PUBLIC;`  
    `GRANT EXECUTE ON FUNCTION public.current_clerk_id() TO anon, authenticated, service_role;`

#### Function 2: `public.current_profile_id()`
```sql
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
BEGIN
  v_clerk_id := public.current_clerk_id();
  IF v_clerk_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Executes with postgres owner privileges, bypassing RLS on profiles
  -- This ELIMINATES infinite RLS recursion
  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE clerk_id = v_clerk_id;

  RETURN v_profile_id;
END;
$$;
```
- **Audited Properties**:
  - *Recursion Prevention*: Runs as `SECURITY DEFINER` (owned by `postgres`), bypassing RLS on `public.profiles`. When called from RLS policies on `reservations` or `payments`, it reads `profiles` directly without re-triggering `profiles` RLS.
  - *Duplicate Prevention*: `clerk_id` is constrained by a `UNIQUE` index on `public.profiles`. `SELECT INTO` cannot match ambiguous multiple profiles.
  - *Search Path*: Hardened to `public, pg_catalog`.
  - *Privileges*: `REVOKE EXECUTE ON FUNCTION public.current_profile_id() FROM PUBLIC;`  
    `GRANT EXECUTE ON FUNCTION public.current_profile_id() TO authenticated, service_role;`

#### Function 3: `public.get_auth_role()`
```sql
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS public.user_role
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_clerk_id text;
  v_role public.user_role;
BEGIN
  v_clerk_id := public.current_clerk_id();
  IF v_clerk_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT role INTO v_role
  FROM public.profiles
  WHERE clerk_id = v_clerk_id;

  RETURN v_role;
END;
$$;
```
- **Audited Properties**:
  - *Recursion Prevention*: `SECURITY DEFINER` allows `profiles_select_own_or_admin` to call `public.get_auth_role()` without triggering policy recursion on `profiles`.
  - *Search Path*: Hardened to `public, pg_catalog`.
  - *Privileges*: `REVOKE EXECUTE ON FUNCTION public.get_auth_role() FROM PUBLIC;`  
    `GRANT EXECUTE ON FUNCTION public.get_auth_role() TO anon, authenticated, service_role;`

---

### 3.3 Issue 3: Redesigned Role Protection & Admin Promotion Rules

To ensure users cannot assign or modify their own role:

1. **Legitimate Profile Creation**:
   - When a user signs in via Clerk, `src/lib/clerkSync.ts` queries `public.profiles WHERE clerk_id = clerkUser.id`.
   - If missing, it inserts a new row with `role: 'CUSTOMER'`.
   - In PostgreSQL, trigger `trg_protect_profile_role` runs `BEFORE INSERT`. If the creator is not an existing database `ADMIN`, any attempt to insert `NEW.role != 'CUSTOMER'` is rejected with `RAISE EXCEPTION USING ERRCODE = '42501'`.
2. **Legitimate Admin Promotion**:
   - A user can gain the `ADMIN` role **strictly** through:
     a. An existing database `ADMIN` updating the user's role via an authorized server action (`requireAdmin()`).
     b. A database superuser executing an administrative SQL command directly in the Supabase Dashboard SQL Editor (`UPDATE public.profiles SET role = 'ADMIN' WHERE email = '...';`).
3. **Attack Surfaces Completely Eliminated**:
   - *Direct REST Calls*: Trigger `trg_protect_profile_role` blocks `INSERT` and `UPDATE` of `role` for non-admins.
   - *Client Payloads*: Server actions ignore any client-supplied `role` parameter.
   - *Clerk Metadata*: User-controlled metadata (`unsafeMetadata` or client tokens) is never read by PostgreSQL. `public.get_auth_role()` reads strictly from `public.profiles.role`.

---

### 3.4 Issue 4: Prevention of Price Manipulation (Server & Database Defense)

To prevent customers from forging rental prices, durations, or deposits:

1. **Server Action Layer (`src/lib/reservations/reservationService.ts`)**:
   - `CreateReservationInput` accepts **only**: `cameraId`, `startDate`, `endDate`, `purpose`, `paymentMethod`.
   - Pricing fields (`daily_rate_snapshot`, `subtotal_php`, `security_deposit_php`, `total_amount_php`) are completely excluded from client input.
   - Server fetches trusted camera data from `public.digital_cameras WHERE id = input.cameraId`.
   - Server calculates:
     $$\text{totalDays} = \text{calculateRentalDays}(\text{startDate}, \text{endDate})$$
     $$\text{subtotal} = \text{totalDays} \times \text{camera.daily\_rate\_php}$$
     $$\text{totalAmount} = \text{subtotal} + \text{camera.security\_deposit\_php}$$
2. **Database Boundary Layer (Trigger Defense for Direct REST Attacks)**:
   If an attacker bypasses Next.js and sends a direct `POST /rest/v1/reservations` with forged arithmetic (e.g. `daily_rate = 1, subtotal = 3, total = 3`), the database `BEFORE INSERT` trigger authoritatively overwrites or recalculates the values:

```sql
CREATE OR REPLACE FUNCTION public.enforce_reservation_pricing_and_status()
RETURNS TRIGGER AS $$
DECLARE
  v_cam RECORD;
  v_days int;
  v_subtotal numeric(10, 2);
  v_total numeric(10, 2);
BEGIN
  -- 1. Fetch trusted camera rates directly from inventory
  SELECT daily_rate_php, security_deposit_php, status, condition
  INTO v_cam
  FROM public.digital_cameras
  WHERE id = NEW.camera_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid camera_id: Camera does not exist in inventory.' USING ERRCODE = '23503';
  END IF;

  -- 2. Verify camera is rentable
  IF v_cam.status IN ('MAINTENANCE', 'DAMAGED') OR v_cam.condition = 'Damaged' THEN
    RAISE EXCEPTION 'Cannot reserve: Camera is currently under maintenance or marked damaged.' USING ERRCODE = 'P0001';
  END IF;

  -- 3. Calculate inclusive days
  v_days := (NEW.end_date - NEW.start_date + 1);
  IF v_days < 1 THEN
    RAISE EXCEPTION 'Invalid dates: end_date must be greater than or equal to start_date.' USING ERRCODE = '23514';
  END IF;

  -- 4. Calculate authoritative pricing
  v_subtotal := v_days * v_cam.daily_rate_php;
  v_total := v_subtotal + v_cam.security_deposit_php;

  -- 5. Force authoritative pricing and status for non-admin callers
  IF public.get_auth_role() IS DISTINCT FROM 'ADMIN' THEN
    NEW.customer_id := public.current_profile_id();
    NEW.status := 'PENDING_APPROVAL';
    NEW.rejection_reason := NULL;
    NEW.total_days := v_days;
    NEW.daily_rate_snapshot := v_cam.daily_rate_php;
    NEW.subtotal_php := v_subtotal;
    NEW.security_deposit_php := v_cam.security_deposit_php;
    NEW.total_amount_php := v_total;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

DROP TRIGGER IF EXISTS trg_enforce_reservation_pricing_and_status ON public.reservations;
CREATE TRIGGER trg_enforce_reservation_pricing_and_status
BEFORE INSERT ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_reservation_pricing_and_status();
```

---

### 3.5 Issue 5: Strict Cash on Counter Pickup Enforcement & Scope Boundary

#### Intentional Business & Scope Decision
**Cash on Counter Pickup (`CASH_PICKUP`) is the ONLY supported payment method at this stage.**  
This is an **intentional, structured scope decision** pending formal consultation with our course instructor regarding the operational efficiency, counter logistics, and architectural feasibility of supporting electronic or gateway payment channels.

#### Requirements & Invariants
1. **Customer Interface Boundary**: The customer interface displays **strictly Cash on Counter Pickup**. All reservation modals, booking confirmations, vouchers, and claim slips must show Cash on Counter Pickup without offering GCash, Maya, or bank transfer input fields or radio buttons.
2. **Server-Side Rejection of Non-Cash Methods**: Server-side validation in `validateReservationInput()` strictly rejects any submission attempting to specify `GCASH`, `MAYA`, `BANK_TRANSFER`, or any unapproved method, returning `HTTP 400 Bad Request: Only Cash on Counter Pickup (CASH_PICKUP) is currently supported.`
3. **Database RLS Boundary Defense**:
   Policy `payments_customer_insert` strictly enforces `payment_method = 'CASH_PICKUP'` on customer insertions:
   ```sql
   DROP POLICY IF EXISTS "payments_customer_insert" ON public.payments_and_deposits;
   CREATE POLICY "payments_customer_insert" ON public.payments_and_deposits
     FOR INSERT WITH CHECK (
       payment_method = 'CASH_PICKUP' AND
       payment_status = 'PENDING' AND
       deposit_status = 'HELD' AND
       settled_by_admin_id IS NULL AND
       settled_at IS NULL AND
       COALESCE(deposit_deduction_php, 0) = 0 AND
       EXISTS (
         SELECT 1 FROM public.reservations r
         WHERE r.id = reservation_id AND r.customer_id = public.current_profile_id()
       )
     );
   ```
4. **Historical Record Preservation**:
   - All historical transaction rows (`GCASH`, `MAYA`, `BANK_TRANSFER`, `CASH_PICKUP`) and existing customer transaction history are preserved 100% intact.
   - The PostgreSQL `payment_method` enum type (`'GCASH'`, `'CASH_PICKUP'`, `'MAYA'`, `'BANK_TRANSFER'`) is **not modified or truncated**, ensuring that past database records do not violate enum constraints and can be queried for analytics.
5. **Separation of Lifecycle States**:
   Financial lifecycle states are kept strictly decoupled from reservation and rental asset states:
   - `payment_status`: `'PENDING'`, `'PAID'`, `'REFUNDED'` (independent financial lifecycle).
   - `deposit_status`: `'HELD'`, `'REFUNDED'`, `'DEDUCTED'`, `'FORFEITED'` (escrow settlement lifecycle).
   - `reservation_status`: `'PENDING_APPROVAL'`, `'APPROVED'`, `'REJECTED'`, `'CANCELLED'` (booking decision lifecycle).
   - `rental_status`: `'CHECKED_OUT'`, `'RETURNED'`, `'COMPLETED'` (physical handover & inspection lifecycle).
6. **Extensible Architecture for Future Methods**:
   The domain models, database enum, and TypeScript definitions retain the generalized structure so that additional payment methods (e.g. GCash, Maya, cards) can be evaluated, verified, and re-enabled in a future phase without requiring a disruptive database rewrite or schema redesign.
7. **No Unapproved Integrations**:
   No external payment gateways (GCash SDKs, PayMongo, Stripe, etc.) are implemented or assumed to be approved.
8. **Production Readiness Caution**:
   The system must **not** be claimed as production-ready solely because Cash Pickup is the only payment method. Operational readiness also requires completing all security remediations, establishing physical counter verification checklists, and verifying database triggers under load.

#### Inconsistencies Discovered in Existing Implementation
An empirical inspection of the current codebase revealed several discrepancies between product intent and code:
1. **Database Schema Default to GCash**: In `supabase/migrations/001_initial_schema.sql` (line 167), the column is declared as `payment_method public.payment_method NOT NULL DEFAULT 'GCASH'`. The database schema defaults to `'GCASH'` instead of `'CASH_PICKUP'`.
2. **Server Action Fallback to GCash**: In `src/lib/reservations/reservationService.ts` (line 60), the mapper falls back to `'GCASH'`: `paymentMethod: (payment?.payment_method as PaymentMethod) || 'GCASH'`.
3. **Server Validation Permitting Non-Cash Methods**: In `src/lib/reservations/reservationValidation.ts` (lines 3 & 77), `VALID_PAYMENT_METHODS` allows `['GCASH', 'CASH_PICKUP', 'MAYA', 'BANK_TRANSFER']`, permitting non-cash submissions via direct API.
4. **Residual Customer Modal GCash Checks**: In `src/components/customer/ReservationModal.tsx` (line 125), residual logic checks `if (paymentMethod === 'GCASH' && !paymentReference.trim())`, even though the UI only presents Cash on Counter Pickup.
5. **Filter Dropdowns Exposing Unused Channels**: In `src/components/admin/PaymentsManager.tsx` and `src/components/customer/CustomerPayments.tsx`, payment method filter dropdowns expose GCash, Maya, and Bank Transfer. These should be labeled as "Historical" or filtered appropriately.

---

### 3.6 Issue 6: Safe Identity Linking & Account Takeover Prevention

Matching existing profiles solely by an email string introduces an **Account Takeover Vulnerability** if an attacker signs up on Clerk using an email address belonging to an existing user (especially an Admin).

#### Safe Linking Specification
1. **Admin Accounts Are Never Auto-Linked**:
   If an existing profile in `public.profiles` has `role = 'ADMIN'`, automatic email-based linking is **STRICTLY FORBIDDEN**. Linking an Admin profile to a Clerk User ID requires manual execution by the database owner in the Supabase Dashboard SQL Editor:
   ```sql
   UPDATE public.profiles SET clerk_id = 'user_admin_clerk_id' WHERE email = 'admin@idiocameras.ph';
   ```
2. **Cryptographic Email Verification Requirement**:
   For customer profiles, auto-linking is allowed **only if** Clerk verifies that the email address is confirmed:
   ```ts
   const isVerified = clerkUser.emailAddresses.some(
     (e) => e.emailAddress.toLowerCase() === profile.email.toLowerCase() &&
            e.verification?.status === 'verified'
   );
   if (!isVerified) {
     throw new Error('Security Error: Clerk email must be verified before account linking.');
   }
   ```
3. **Foreign Key Decoupling (`profiles_id_fkey`)**:
   - Dropping `profiles_id_fkey` (`REFERENCES auth.users(id)`) is **completely non-destructive**.
   - It does not delete, update, or alter any customer profiles, reservations, or rentals.
   - It only removes the foreign key constraint that forced IDs to exist in Supabase's internal auth table, allowing Clerk users to exist in `public.profiles`.

---

### 3.7 Issue 7: Complete Audit of Every RLS Policy

Every table in PostgreSQL is audited to verify that direct REST attacks and cross-customer access attempts fail:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              POSTGRESQL RLS POLICY AUDIT                               │
├──────────────────────┬────────┬───────────────────────────┬────────────────────────────┤
│ Table                │ Action │ USING Clause              │ WITH CHECK Clause          │
├──────────────────────┼────────┼───────────────────────────┼────────────────────────────┤
│ public.profiles      │ SELECT │ clerk_id = current_...    │ N/A                        │
│                      │        │ OR get_auth_role() = ADMIN│                            │
│                      │ INSERT │ N/A                       │ (role = CUSTOMER OR        │
│                      │        │                           │  get_auth_role() = ADMIN)  │
│                      │ UPDATE │ id = current_profile_id() │ id = current_profile_id()  │
│                      │        │ OR get_auth_role() = ADMIN│ OR get_auth_role() = ADMIN │
│                      │ DELETE │ None (Default Deny)       │ N/A                        │
├──────────────────────┼────────┼───────────────────────────┼────────────────────────────┤
│ public.reservations  │ SELECT │ customer_id = current_... │ N/A                        │
│                      │        │ OR get_auth_role() = ADMIN│                            │
│                      │ INSERT │ N/A                       │ customer_id = current_...  │
│                      │        │                           │ AND status = PENDING_...   │
│                      │ UPDATE │ (customer_id = cur_prof   │ (customer_id = cur_prof    │
│                      │        │  AND status = PENDING)    │  AND status = CANCELLED)   │
│                      │        │ OR get_auth_role() = ADMIN│ OR get_auth_role() = ADMIN │
│                      │ DELETE │ None (Default Deny)       │ N/A                        │
├──────────────────────┼────────┼───────────────────────────┼────────────────────────────┤
│ public.payments_...  │ SELECT │ EXISTS (res.customer_id = │ N/A                        │
│                      │        │  current_profile_id() ...)│                            │
│                      │ INSERT │ N/A                       │ payment_method = CASH_...  │
│                      │        │                           │ AND status = PENDING ...   │
│                      │ UPDATE │ get_auth_role() = 'ADMIN' │ get_auth_role() = 'ADMIN'  │
│                      │ DELETE │ None (Default Deny)       │ N/A                        │
├──────────────────────┼────────┼───────────────────────────┼────────────────────────────┤
│ public.digital_cam.. │ SELECT │ true (Public catalog)     │ N/A                        │
│                      │ MUTATE │ get_auth_role() = 'ADMIN' │ get_auth_role() = 'ADMIN'  │
├──────────────────────┼────────┼───────────────────────────┼────────────────────────────┤
│ public.rentals       │ SELECT │ customer_id = current_... │ N/A                        │
│                      │ MUTATE │ get_auth_role() = 'ADMIN' │ get_auth_role() = 'ADMIN'  │
├──────────────────────┼────────┼───────────────────────────┼────────────────────────────┤
│ public.maintenance.. │ ALL    │ get_auth_role() = 'ADMIN' │ get_auth_role() = 'ADMIN'  │
├──────────────────────┼────────┼───────────────────────────┼────────────────────────────┤
│ public.activity_logs │ SELECT │ get_auth_role() = 'ADMIN' │ N/A                        │
│                      │ INSERT │ N/A                       │ actor_id = current_prof_id │
│                      │        │                           │ AND actor_role = auth_role │
│                      │ UPDATE │ None (Immutable log)      │ N/A                        │
│                      │ DELETE │ None (Immutable log)      │ N/A                        │
└──────────────────────┴────────┴───────────────────────────┴────────────────────────────┘
```

---

### 3.8 Issue 8: Accurate Migration Sequencing & Rollback Limitations

#### Dependencies on Prior Migrations
- **Migration 001 (`001_initial_schema.sql`)**: **Hard Dependency**. Creates core tables, enums, and the GiST exclusion constraint. Must be present.
- **Migration 002 (`002_fix_profiles_rls_and_clerk_id.sql`)**: **Tolerated Partial State**. Migration 004 uses `IF NOT EXISTS` for `clerk_id` so it executes safely whether 002 was run or skipped.
- **Migration 003 (`003_harden_profiles_role_security.sql`)**: **Overwritten & Self-Healed**. Migration 004 uses `CREATE OR REPLACE FUNCTION` and `DROP TRIGGER IF EXISTS trg_protect_profile_role` to cleanly replace partial trigger definitions.

#### Preflight Diagnostic Queries (Run Before Migration 004)
Execute in Supabase SQL Editor:
```sql
-- 1. Check for duplicate clerk_id values
SELECT clerk_id, COUNT(*) FROM public.profiles 
WHERE clerk_id IS NOT NULL GROUP BY clerk_id HAVING COUNT(*) > 1;

-- 2. Check for orphaned reservations
SELECT COUNT(*) AS orphaned_reservations FROM public.reservations r
LEFT JOIN public.profiles p ON r.customer_id = p.id WHERE p.id IS NULL;

-- 3. Confirm at least one active ADMIN profile exists
SELECT id, full_name, email, role FROM public.profiles WHERE role = 'ADMIN';
```

#### Post-Migration Assertion Queries (Run After Migration 004)
```sql
-- 1. Assert foreign key to auth.users is removed
SELECT conname FROM pg_constraint WHERE conname = 'profiles_id_fkey';
-- Expected: 0 rows

-- 2. Assert protect_profile_role trigger is active on INSERT and UPDATE
SELECT trigger_name, event_manipulation 
FROM information_schema.triggers 
WHERE event_object_table = 'profiles';
-- Expected: trg_protect_profile_role on INSERT and UPDATE

-- 3. Assert reservation pricing trigger is active
SELECT trigger_name, event_manipulation 
FROM information_schema.triggers 
WHERE event_object_table = 'reservations';
-- Expected: trg_enforce_reservation_pricing_and_status on INSERT
```

#### Critical Rollback Limitation Notice
> **[WARNING] Rollback Constraint**: If Migration 004 is applied and new customer profiles register via Clerk, those profiles will have generated UUIDs that **do not exist in Supabase `auth.users`**. A rollback script **must not re-add `profiles_id_fkey` (`REFERENCES auth.users(id)`)**, because doing so will fail with a foreign key violation against the new Clerk profiles. Rollback is strictly limited to reverting policy definitions and triggers.

---

## 4. Complete Proposed SQL: Migration `004`

> **Note**: This migration is provided for review only. It must **not** be created on disk or executed until approved.

```sql
-- ==============================================================================
-- IDIO Digital Camera Rental Management System
-- Schema Migration: 004_security_hardening_remediation.sql
-- Target: PostgreSQL 15+ / Supabase
-- Fixes: SEC-01, SEC-02, SEC-03, SEC-04, SEC-05, SEC-06, SEC-07
-- Preserves: Clerk Auth, Strictly 2 Roles (CUSTOMER & ADMIN), Existing Data
-- Enforces: Cash on Counter Pickup for New Reservations
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. EXTENSIONS & IDENTITY DECOUPLING
-- ------------------------------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop foreign key to Supabase auth.users so Clerk users can exist in public.profiles
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Ensure profiles.id generates a UUID if omitted
ALTER TABLE public.profiles
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Ensure clerk_id exists, is unique, and indexed
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'clerk_id'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN clerk_id VARCHAR(255) UNIQUE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_clerk_id ON public.profiles(clerk_id);

-- ------------------------------------------------------------------------------
-- 2. HARDENED SQL IDENTITY & ROLE RESOLVERS
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_clerk_id()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::text;
$$;

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
BEGIN
  v_clerk_id := public.current_clerk_id();
  IF v_clerk_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_profile_id
  FROM public.profiles
  WHERE clerk_id = v_clerk_id;

  RETURN v_profile_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS public.user_role
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_clerk_id text;
  v_role public.user_role;
BEGIN
  v_clerk_id := public.current_clerk_id();
  IF v_clerk_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT role INTO v_role
  FROM public.profiles
  WHERE clerk_id = v_clerk_id;

  RETURN v_role;
END;
$$;

-- Revoke default public execution; grant only to authorized API roles
REVOKE EXECUTE ON FUNCTION public.current_clerk_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_clerk_id() TO anon, authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.current_profile_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_profile_id() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_auth_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_auth_role() TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. ROLE PROTECTION TRIGGER (SEC-01 & SEC-07)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER AS $$
BEGIN
  -- On INSERT: Non-admins cannot assign themselves ADMIN role
  IF TG_OP = 'INSERT' THEN
    IF NEW.role IS DISTINCT FROM 'CUSTOMER' AND (public.get_auth_role() IS DISTINCT FROM 'ADMIN') THEN
      RAISE EXCEPTION 'Unauthorized: Newly registered profiles must have role CUSTOMER.'
        USING ERRCODE = '42501';
    END IF;
  -- On UPDATE: Non-admins cannot change their existing role
  ELSIF TG_OP = 'UPDATE' THEN
    IF (OLD.role IS DISTINCT FROM NEW.role) AND (public.get_auth_role() IS DISTINCT FROM 'ADMIN') THEN
      RAISE EXCEPTION 'Unauthorized: Only administrators can modify user roles.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
CREATE TRIGGER trg_protect_profile_role
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_role();

-- RLS: Profiles policies
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON public.profiles;
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles
  FOR SELECT USING (
    clerk_id = public.current_clerk_id() OR
    public.get_auth_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (
    (clerk_id = public.current_clerk_id() OR public.current_clerk_id() IS NOT NULL) AND
    (role = 'CUSTOMER' OR public.get_auth_role() = 'ADMIN')
  );

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE
  USING (
    id = public.current_profile_id() OR
    public.get_auth_role() = 'ADMIN'
  )
  WITH CHECK (
    id = public.current_profile_id() OR
    public.get_auth_role() = 'ADMIN'
  );

-- ------------------------------------------------------------------------------
-- 4. RESERVATIONS TRIGGER & POLICIES (SEC-03 & SEC-05)
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_reservation_pricing_and_status()
RETURNS TRIGGER AS $$
DECLARE
  v_cam RECORD;
  v_days int;
  v_subtotal numeric(10, 2);
  v_total numeric(10, 2);
BEGIN
  -- Fetch trusted camera rates directly from inventory
  SELECT daily_rate_php, security_deposit_php, status, condition
  INTO v_cam
  FROM public.digital_cameras
  WHERE id = NEW.camera_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid camera_id: Camera does not exist in inventory.' USING ERRCODE = '23503';
  END IF;

  IF v_cam.status IN ('MAINTENANCE', 'DAMAGED') OR v_cam.condition = 'Damaged' THEN
    RAISE EXCEPTION 'Cannot reserve: Camera is currently under maintenance or marked damaged.' USING ERRCODE = 'P0001';
  END IF;

  v_days := (NEW.end_date - NEW.start_date + 1);
  IF v_days < 1 THEN
    RAISE EXCEPTION 'Invalid dates: end_date must be greater than or equal to start_date.' USING ERRCODE = '23514';
  END IF;

  v_subtotal := v_days * v_cam.daily_rate_php;
  v_total := v_subtotal + v_cam.security_deposit_php;

  -- Non-admins cannot forge prices or status
  IF public.get_auth_role() IS DISTINCT FROM 'ADMIN' THEN
    NEW.customer_id := public.current_profile_id();
    NEW.status := 'PENDING_APPROVAL';
    NEW.rejection_reason := NULL;
    NEW.total_days := v_days;
    NEW.daily_rate_snapshot := v_cam.daily_rate_php;
    NEW.subtotal_php := v_subtotal;
    NEW.security_deposit_php := v_cam.security_deposit_php;
    NEW.total_amount_php := v_total;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

DROP TRIGGER IF EXISTS trg_enforce_reservation_pricing_and_status ON public.reservations;
CREATE TRIGGER trg_enforce_reservation_pricing_and_status
BEFORE INSERT ON public.reservations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_reservation_pricing_and_status();

DROP POLICY IF EXISTS "reservations_select" ON public.reservations;
CREATE POLICY "reservations_select" ON public.reservations
  FOR SELECT USING (
    customer_id = public.current_profile_id() OR
    public.get_auth_role() = 'ADMIN'
  );

DROP POLICY IF EXISTS "reservations_insert_customer" ON public.reservations;
CREATE POLICY "reservations_insert_customer" ON public.reservations
  FOR INSERT WITH CHECK (
    customer_id = public.current_profile_id() AND
    status = 'PENDING_APPROVAL' AND
    rejection_reason IS NULL
  );

DROP POLICY IF EXISTS "reservations_update" ON public.reservations;
CREATE POLICY "reservations_update" ON public.reservations
  FOR UPDATE
  USING (
    (customer_id = public.current_profile_id() AND status = 'PENDING_APPROVAL') OR
    public.get_auth_role() = 'ADMIN'
  )
  WITH CHECK (
    (customer_id = public.current_profile_id() AND status = 'CANCELLED') OR
    public.get_auth_role() = 'ADMIN'
  );

-- ------------------------------------------------------------------------------
-- 5. PAYMENTS & DEPOSITS POLICIES (SEC-04 & CASH PICKUP ONLY)
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "payments_select" ON public.payments_and_deposits;
CREATE POLICY "payments_select" ON public.payments_and_deposits
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.reservations r
      WHERE r.id = reservation_id AND (r.customer_id = public.current_profile_id() OR public.get_auth_role() = 'ADMIN')
    )
  );

DROP POLICY IF EXISTS "payments_customer_insert" ON public.payments_and_deposits;
CREATE POLICY "payments_customer_insert" ON public.payments_and_deposits
  FOR INSERT WITH CHECK (
    payment_method = 'CASH_PICKUP' AND
    payment_status = 'PENDING' AND
    deposit_status = 'HELD' AND
    settled_by_admin_id IS NULL AND
    settled_at IS NULL AND
    COALESCE(deposit_deduction_php, 0) = 0 AND
    EXISTS (
      SELECT 1 FROM public.reservations r
      WHERE r.id = reservation_id AND r.customer_id = public.current_profile_id()
    )
  );

DROP POLICY IF EXISTS "payments_admin_mutate" ON public.payments_and_deposits;
CREATE POLICY "payments_admin_mutate" ON public.payments_and_deposits
  FOR ALL USING (public.get_auth_role() = 'ADMIN');

-- ------------------------------------------------------------------------------
-- 6. AUDIT LOGS BINDING (SEC-06)
-- ------------------------------------------------------------------------------

DROP POLICY IF EXISTS "audit_insert_any_authenticated" ON public.activity_audit_logs;
DROP POLICY IF EXISTS "audit_insert_actor_bound" ON public.activity_audit_logs;
CREATE POLICY "audit_insert_actor_bound" ON public.activity_audit_logs
  FOR INSERT WITH CHECK (
    actor_id = public.current_profile_id() AND
    actor_role = public.get_auth_role()
  );

COMMIT;
```

---

## 5. Verification & Testing Matrix

The test suite combines **Direct API/RLS attack tests** with **business workflow tests**:

### 5.1 Direct API & RLS Security Negative Tests

| Test ID | Test Method | Attack Vector | Expected Defense Outcome |
|---|---|---|---|
| **API-SEC-01** | Direct `POST /rest/v1/profiles` | Customer attempts to insert row with `role: 'ADMIN'` | **HTTP 400 / 42501**: Trigger raises `Unauthorized: Newly registered profiles must have role CUSTOMER`. |
| **API-SEC-02** | Direct `PATCH /rest/v1/profiles` | Customer attempts to update own row to `role: 'ADMIN'` | **HTTP 400 / 42501**: Trigger raises `Unauthorized: Only administrators can modify user roles`. |
| **API-SEC-03** | Direct `GET /rest/v1/reservations` | Customer Beta attempts to query Customer Alpha's bookings | **HTTP 200 / 0 rows**: RLS returns empty dataset; no cross-tenant exposure. |
| **API-SEC-04** | Direct `POST /rest/v1/reservations` | Customer attempts to insert with `status: 'APPROVED'` | **Trigger Overwrite / Rejection**: Status forced to `'PENDING_APPROVAL'` or rejected. |
| **API-SEC-05** | Direct `POST /rest/v1/reservations` | Customer attempts to insert with `total_amount_php: 1.00` | **Trigger Overwrite**: Trigger recalculates exact rates from `digital_cameras`. |
| **API-SEC-06** | Direct `PATCH /rest/v1/reservations` | Customer attempts to approve own reservation | **HTTP 400 / 42501**: RLS `WITH CHECK` rejects update; only `'CANCELLED'` allowed. |
| **API-SEC-07** | Direct `POST /rest/v1/payments_...` | Customer attempts to insert with `payment_method: 'GCASH'` | **HTTP 400 / 42501**: RLS rejects insert; only `CASH_PICKUP` allowed. |
| **API-SEC-08** | Direct `POST /rest/v1/payments_...` | Customer attempts to insert with `payment_status: 'PAID'` | **HTTP 400 / 42501**: RLS rejects insert; only `'PENDING'` allowed. |
| **API-SEC-09** | Direct `PATCH /rest/v1/payments_...` | Customer attempts to settle deposit as `'REFUNDED'` | **HTTP 400 / 42501**: RLS rejects update; only Admin can mutate payments. |
| **API-SEC-10** | Direct `POST /rest/v1/activity_...` | Customer attempts to insert audit log with `actor_role: 'ADMIN'` | **HTTP 400 / 42501**: Policy rejects insert; `actor_role` must match `public.get_auth_role()`. |

### 5.2 Legitimate Business Workflow Acceptance Tests

| Test ID | Business Scenario | Workflow / Actions Tested | Expected Result |
|---|---|---|---|
| **BIZ-VAL-01** | Customer Onboarding | Clerk sign-up + Butuan City PhilSys ID submission | Profile created with `role = 'CUSTOMER'` and mapped UUID. |
| **BIZ-VAL-02** | Camera Booking | Customer books camera for 3 days with Cash on Counter Pickup | Reservation created in `PENDING_APPROVAL`; payment created in `PENDING` with `CASH_PICKUP`. |
| **BIZ-VAL-03** | Customer Cancellation | Customer cancels own pending reservation via UI | Reservation cleanly transitions to `'CANCELLED'` under RLS. |
| **BIZ-VAL-04** | Admin Decisioning | Admin reviews and approves reservation | Reservation transitions to `'APPROVED'`. |
| **BIZ-VAL-05** | Counter Handover | Admin verifies ID, condition (Grade A), checks out camera | Rental record created; camera status marked `CHECKED_OUT`. |
| **BIZ-VAL-06** | Counter Payment | Admin confirms Cash Pickup payment at counter | Payment transitions to `'PAID'`; audit entry recorded. |
| **BIZ-VAL-07** | Return & Deposit | Admin inspects return condition and executes full deposit refund | Camera restored to `AVAILABLE`; deposit marked `'REFUNDED'`. |
| **BIZ-VAL-08** | Ledger Integrity | Admin views historical financial ledger | All past GCash, Maya, Bank Transfer, and Cash Pickup records display correctly. |

---

## 6. Implementation Sequence & Rollback Plan

### 6.1 Implementation Sequence (Upon Approval)
1. **Preflight Verification**: Run pre-migration diagnostic queries in the Supabase Dashboard SQL Editor.
2. **Database Migration**: Execute `supabase/migrations/004_security_hardening_remediation.sql` in the Supabase SQL Editor.
3. **Clerk JWT Verification**: Confirm template `supabase` in Clerk Dashboard.
4. **Application Code Updates**:
   - `src/lib/clerkSync.ts`: Include deterministic UUID in insert payload.
   - `src/lib/auth.ts`: Return database profile UUID as `authContext.user.id`.
   - `src/lib/reservations/reservationValidation.ts`: Restrict new bookings strictly to `CASH_PICKUP`.
   - `src/lib/reservations/reservationService.ts`: Assert payment insertion success.
   - `src/middleware.ts`: Verify `sessionClaims` metadata for `/admin` route guard.
5. **Regression Verification**: Execute Vitest and Playwright test suites (API-SEC-01..10 and BIZ-VAL-01..08).

### 6.2 Rollback Plan
If an unexpected issue occurs, execute the following SQL script in the Supabase SQL Editor to restore previous policies without re-adding the broken `profiles_id_fkey`:

```sql
BEGIN;

-- Restore profiles trigger to update-only
DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.role IS DISTINCT FROM NEW.role) AND (public.get_auth_role() != 'ADMIN') THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can modify user roles.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_protect_profile_role
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role();

DROP TRIGGER IF EXISTS trg_enforce_reservation_pricing_and_status ON public.reservations;

-- Restore previous policies
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "reservations_update" ON public.reservations;
CREATE POLICY "reservations_update" ON public.reservations FOR UPDATE USING (true);

DROP POLICY IF EXISTS "payments_customer_insert" ON public.payments_and_deposits;

COMMIT;
```

---

*This document is ready for stakeholder review. No application source files, migrations, or database objects were modified.*
