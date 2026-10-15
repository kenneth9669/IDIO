# IDIO — Supabase Security and Migration Audit (Read-Only)

**System**: IDIO Digital Camera Rental Management System  
**Target Database**: PostgreSQL 15+ / Supabase (`https://qfhmlwvkgdvysemitilb.supabase.co`)  
**Operating Location**: Butuan City, Agusan del Norte, Philippines  
**Audit Type**: Static Code Review, PostgreSQL Schema/RLS Policy Analysis, and Read-Only Live API Probing  
**Auditor Role**: Senior Supabase / PostgreSQL Security Engineer  
**Date**: October 11, 2026  

---

## 1. Executive Summary

A comprehensive, read-only security audit of the IDIO database migrations, Row Level Security (RLS) policies, authentication architecture, and live Supabase endpoints was conducted.

The system demonstrates several strong security foundations:
- Row Level Security (RLS) is enabled across all 7 domain tables in PostgreSQL.
- Unauthenticated access to private tables (`profiles`, `reservations`, `rentals`, `payments_and_deposits`, `maintenance_tickets`, `activity_audit_logs`) is blocked at the database layer (verified empirically via live PostgREST probe returning 0 rows).
- Service-role secrets (`SUPABASE_SERVICE_ROLE_KEY`) are strictly isolated and completely absent from client bundles and frontend environments.
- PostgreSQL GiST exclusion constraints (`prevent_camera_reservation_overlap`) actively enforce concurrency invariants at the database engine level.
- Server Actions enforce server-side RBAC guards (`requireAdmin()`, `requireRole()`).

However, **critical security vulnerabilities and architectural defects** were uncovered in the database RLS policies and authentication integration that must be remediated before production rollout:
1. **Critical Privilege Escalation**: Authenticated users can self-assign `role = 'ADMIN'` during profile `INSERT` because the RLS `WITH CHECK` and trigger protections only target `UPDATE`.
2. **Dual-Auth Mismatch & RLS Bypass**: Clerk identities (`user_xxx` strings) cannot satisfy PostgreSQL schema UUID constraints (`id UUID REFERENCES auth.users(id)`) or Supabase RLS sessions (`auth.uid() = NULL`), breaking database authorization for Clerk users.
3. **Broken Customer Cancellation**: The `reservations_update` RLS policy lacks a `WITH CHECK` clause, causing PostgreSQL to evaluate the `USING` clause (`status = 'PENDING_APPROVAL'`) on the updated row (`status = 'CANCELLED'`), rejecting all customer cancellations with RLS violations.
4. **Missing Customer Payment Insertion**: `payments_and_deposits` lacks an `INSERT` policy for customers, blocking payment record creation during reservation submissions under RLS.
5. **Unconstrained Reservation Inserts**: Direct REST queries allow customers to insert reservations with pre-approved statuses and falsified price fields.
6. **Spoofable Audit Logs**: Any authenticated user can insert arbitrary audit rows impersonating administrators.

---

## 2. Verification Checklist & Status Matrix

| Verification Item | Status | Evidence / Location | Notes |
|---|---|---|---|
| **RLS enabled on private customer tables** | **PASS** | [001_initial_schema.sql](file:///c:/Users/DAVE/Desktop/idiot/supabase/migrations/001_initial_schema.sql#L223-L230) | Live PostgREST probe verified 0 rows returned for anonymous queries on all private tables. |
| **Customers access only authorized records** | **PASS (Read) / FAIL (Mutate)** | [001_initial_schema.sql](file:///c:/Users/DAVE/Desktop/idiot/supabase/migrations/001_initial_schema.sql#L274-L278) | Reads correctly filter by `auth.uid() = customer_id`. However, cancellation mutations fail due to policy flaw. |
| **Customers cannot assign/modify ADMIN role** | **FAIL** | [001_initial_schema.sql](file:///c:/Users/DAVE/Desktop/idiot/supabase/migrations/001_initial_schema.sql#L257-L259), [003_harden_profiles_role_security.sql](file:///c:/Users/DAVE/Desktop/idiot/supabase/migrations/003_harden_profiles_role_security.sql#L21-L26) | `BEFORE UPDATE` trigger protects modification, but `INSERT` has no check; customers can supply `role: 'ADMIN'` on creation. |
| **Admin authorization enforced server-side** | **PASS** | [src/lib/auth.ts](file:///c:/Users/DAVE/Desktop/idiot/src/lib/auth.ts#L119-L136), [src/app/actions/cameraActions.ts](file:///c:/Users/DAVE/Desktop/idiot/src/app/actions/cameraActions.ts) | Server Actions enforce `requireAdmin()` and verify role against database `public.profiles`. |
| **Clerk identity mapping matches schema & RLS** | **FAIL** | [src/lib/auth.ts](file:///c:/Users/DAVE/Desktop/idiot/src/lib/auth.ts#L67-L95), [src/lib/clerkSync.ts](file:///c:/Users/DAVE/Desktop/idiot/src/lib/clerkSync.ts#L51-L69) | Clerk string IDs (`user_...`) violate UUID foreign keys; Clerk users have `auth.uid() = NULL` in Supabase RLS. |
| **SQL syntax & role protection valid** | **PARTIAL** | [003_harden_profiles_role_security.sql](file:///c:/Users/DAVE/Desktop/idiot/supabase/migrations/003_harden_profiles_role_security.sql#L9-L19) | Syntax is valid PostgreSQL PL/pgSQL, but RLS `WITH CHECK` omission on `reservations_update` causes runtime failure. |
| **Migration files match actual DB state** | **PARTIAL / UNVERIFIED** | Live DB probe & [SUPABASE_INTEGRATION_AUDIT.md](file:///c:/Users/DAVE/Desktop/idiot/SUPABASE_INTEGRATION_AUDIT.md#L19) | Migrations 001 and 002 (e.g. `clerk_id`) are applied; Migration 003 application state is unverified in production. |
| **Service-role secrets isolated from client** | **PASS** | [src/lib/supabase/client.ts](file:///c:/Users/DAVE/Desktop/idiot/src/lib/supabase/client.ts), [src/lib/supabase/server.ts](file:///c:/Users/DAVE/Desktop/idiot/src/lib/supabase/server.ts), [.env.local](file:///c:/Users/DAVE/Desktop/idiot/.env.local) | Zero service-role keys exposed in client bundles, git tracking, or environment variables. |

---

## 3. Migration Application Status (Live vs. Local)

Because direct superuser access (`psql` connection or Supabase Management API) is unavailable, inspection was performed via the Supabase REST/PostgREST endpoint using the project's publishable API key:

| Migration File | Expected Schema Changes | Live Verification Status | Evidence |
|---|---|---|---|
| **`001_initial_schema.sql`** | Core tables (`profiles`, `digital_cameras`, `reservations`, `rentals`, `payments_and_deposits`, `maintenance_tickets`, `activity_audit_logs`), Enums, GiST constraint, RLS policies. | **APPLIED** | Live probe verified: 9 cameras active in `digital_cameras` (HTTP 206), all 7 tables exist, `get_auth_role()` RPC returns null, GiST constraint returns `23P01` on booking overlap. |
| **`002_fix_profiles_rls_and_clerk_id.sql`** | Adds `clerk_id VARCHAR(255) UNIQUE` to `public.profiles`; re-creates `profiles_insert_own`. | **APPLIED** | Live query `GET /rest/v1/profiles?select=clerk_id` succeeded with HTTP 200 (proves column `clerk_id` exists in live PostgreSQL table). |
| **`003_harden_profiles_role_security.sql`** | Adds `protect_profile_role()` function, trigger `trg_protect_profile_role BEFORE UPDATE`, updates `profiles_update_own` RLS policy. | **UNVERIFIED (PROBABLE PENDING)** | PostgREST does not expose trigger functions as callable RPCs (HTTP 404). [SUPABASE_INTEGRATION_AUDIT.md](file:///c:/Users/DAVE/Desktop/idiot/SUPABASE_INTEGRATION_AUDIT.md#L19) recorded this migration as pending manual execution in the Supabase Dashboard SQL Editor. Without administrative DDL inspection (`pg_trigger`), cannot verify if trigger is installed. |

---

## 4. Security Findings Ranked by Severity

```
CRITICAL : 1 finding  (Privilege escalation via profile creation)
HIGH     : 3 findings (Clerk/RLS mismatch, Reservation cancellation lock, Payment insert failure)
MEDIUM   : 2 findings (Unvalidated reservation insert fields, Audit log spoofing)
LOW      : 1 finding  (Live migration verification visibility)
```

---

### [CRITICAL] SEC-01: Privilege Escalation via Self-Assigned ADMIN Role on Profile INSERT

- **File Path**: 
  - [supabase/migrations/001_initial_schema.sql](file:///c:/Users/DAVE/Desktop/idiot/supabase/migrations/001_initial_schema.sql#L257-L260)
  - [supabase/migrations/002_fix_profiles_rls_and_clerk_id.sql](file:///c:/Users/DAVE/Desktop/idiot/supabase/migrations/002_fix_profiles_rls_and_clerk_id.sql#L21-L24)
  - [supabase/migrations/003_harden_profiles_role_security.sql](file:///c:/Users/DAVE/Desktop/idiot/supabase/migrations/003_harden_profiles_role_security.sql#L9-L26)
- **Supporting Policy/Trigger**:
  - Policy: `profiles_insert_own` on `public.profiles`
  - Trigger: `trg_protect_profile_role` / function `public.protect_profile_role()`
- **Vulnerability Mechanism**:
  1. The RLS policy governing profile insertion is defined as:
     ```sql
     CREATE POLICY "profiles_insert_own" ON public.profiles
       FOR INSERT WITH CHECK (auth.uid() = id);
     ```
     The `WITH CHECK` expression validates only that the caller's authenticated UID matches the primary key `id`. It **does not restrict the `role` column**.
  2. While Migration 003 introduced the `protect_profile_role()` trigger, the trigger was registered **strictly on `BEFORE UPDATE`**:
     ```sql
     CREATE TRIGGER trg_protect_profile_role
     BEFORE UPDATE ON public.profiles
     FOR EACH ROW
     EXECUTE FUNCTION public.protect_profile_role();
     ```
     There is **NO trigger on `BEFORE INSERT`**.
  3. Consequently, any authenticated customer using their Supabase JWT can send a direct REST request to `/rest/v1/profiles`:
     ```json
     POST /rest/v1/profiles
     {
       "id": "<user-own-uid>",
       "role": "ADMIN",
       "full_name": "Attacker",
       "email": "attacker@test.com",
       "phone": "0917-000-0000",
       "barangay": "Libertad",
       "street_address": "Purok 1",
       "id_type": "PhilSys",
       "id_number": "1234-5678"
     }
     ```
  4. The record is inserted with `role = 'ADMIN'`. Immediately thereafter, `public.get_auth_role()` evaluates to `'ADMIN'`, granting the attacker unrestricted administrative privileges across the entire database, including editing cameras, approving arbitrary rentals, and modifying payments.
- **Impact**: Full administrative takeover of the database and application.

---

### [HIGH] SEC-02: Clerk Authentication Architectural Breakdown & RLS Session Loss

- **File Path**:
  - [src/lib/auth.ts](file:///c:/Users/DAVE/Desktop/idiot/src/lib/auth.ts#L52-L96)
  - [src/lib/clerkSync.ts](file:///c:/Users/DAVE/Desktop/idiot/src/lib/clerkSync.ts#L10-L75)
  - [supabase/migrations/001_initial_schema.sql](file:///c:/Users/DAVE/Desktop/idiot/supabase/migrations/001_initial_schema.sql#L59-L83)
- **Supporting Functions/Components**:
  - `getAuthenticatedUser()` in `src/lib/auth.ts`
  - `syncCurrentClerkUser()` in `src/lib/clerkSync.ts`
  - Table constraint: `profiles.id UUID PRIMARY KEY REFERENCES auth.users(id)`
- **Vulnerability Mechanism**:
  1. **UUID Constraint Incompatibility**:
     `public.profiles.id` is a `UUID` foreign key referencing `auth.users(id)`. Clerk user identifiers are alphanumeric strings (e.g., `user_2tABC123...`), not valid UUIDs. In `auth.ts` (lines 68, 90), when Clerk authentication succeeds, the application resolves `user.id` as `clerkUser.id`. Any subsequent database operation passing this value into `reservations.customer_id` (a `UUID` column referencing `profiles(id)`) fails with PostgreSQL error `22P02: invalid input syntax for type uuid`.
  2. **RLS Context Loss (`auth.uid() = NULL`)**:
     Supabase RLS relies entirely on the Supabase JWT cookie passed to `createServerClient`. When a user authenticates through Clerk, no Supabase Auth session token is set. The server client connects to Supabase as an unauthenticated anon caller. In PostgreSQL RLS, `auth.uid()` evaluates to `NULL`.
     - `profiles_insert_own` (`auth.uid() = id`) rejects profile creation.
     - `reservations_select` (`auth.uid() = customer_id`) returns 0 rows.
     - `reservations_insert_customer` (`auth.uid() = customer_id`) rejects reservation creation.
  3. **Silent Failure in Sync**:
     `clerkSync.ts` attempts to insert profiles without an `id` column (`insert({ clerk_id: clerkUser.id, role, ... })`), which violates the `NOT NULL` constraint on `id UUID`. The error is caught and logged as a warning (`Could not insert profile into Supabase (database tables may not be migrated yet)`), leaving the user completely unbacked by the database.
- **Impact**: Total authorization failure and data inconsistency for any user signing in through Clerk.

---

### [HIGH] SEC-03: Broken Customer Reservation Cancellation Due to Omitted `WITH CHECK` Clause

- **File Path**:
  - [supabase/migrations/001_initial_schema.sql](file:///c:/Users/DAVE/Desktop/idiot/supabase/migrations/001_initial_schema.sql#L288-L294)
  - [src/lib/reservations/reservationService.ts](file:///c:/Users/DAVE/Desktop/idiot/src/lib/reservations/reservationService.ts#L588-L600)
- **Supporting Policy**: Policy `reservations_update` on `public.reservations`
- **Vulnerability Mechanism**:
  1. In `001_initial_schema.sql`, the policy is declared as:
     ```sql
     CREATE POLICY "reservations_update" ON public.reservations
       FOR UPDATE USING (
         (auth.uid() = customer_id AND status = 'PENDING_APPROVAL') OR
         public.get_auth_role() = 'ADMIN'
       );
     ```
  2. In PostgreSQL Row Level Security, when an `UPDATE` policy omits the `WITH CHECK` clause, PostgreSQL **implicitly defaults `WITH CHECK` to the expression specified in `USING`**.
  3. When an authenticated customer attempts to cancel their reservation via `cancelReservation()`:
     - The target row currently has `status = 'PENDING_APPROVAL'`. The `USING` clause passes.
     - The mutation updates the row to `status = 'CANCELLED'`.
     - PostgreSQL evaluates the implicit `WITH CHECK` expression on the **new row**:
       `(auth.uid() = customer_id AND status = 'PENDING_APPROVAL')`.
     - Because `NEW.status` is `'CANCELLED'`, the condition evaluates to **FALSE**.
  4. PostgreSQL immediately rejects the transaction with error `42501: new row violates row-level security policy for table "reservations"`.
- **Impact**: Legitimate customers are locked out of cancelling their own reservations in production whenever RLS is active.

---

### [HIGH] SEC-04: Missing Customer INSERT Policy on `payments_and_deposits`

- **File Path**:
  - [supabase/migrations/001_initial_schema.sql](file:///c:/Users/DAVE/Desktop/idiot/supabase/migrations/001_initial_schema.sql#L318-L321)
  - [src/lib/reservations/reservationService.ts](file:///c:/Users/DAVE/Desktop/idiot/src/lib/reservations/reservationService.ts#L368-L378)
- **Supporting Policy**: Policy `payments_admin_mutate` on `public.payments_and_deposits`
- **Vulnerability Mechanism**:
  1. The schema defines only two policies on `payments_and_deposits`:
     - `payments_select`: Allows customer to view payments for their reservations, or Admin to view all.
     - `payments_admin_mutate`: `FOR ALL USING (public.get_auth_role() = 'ADMIN')`.
  2. There is **no policy permitting customer INSERT**.
  3. In `reservationService.ts` (line 378), when a customer books a reservation, the client executes:
     ```ts
     await supabase.from('payments_and_deposits').insert(paymentRow);
     ```
     Because the caller has `public.get_auth_role() = 'CUSTOMER'`, RLS rejects the insert.
  4. Furthermore, `reservationService.ts` does not check the error on `insert(paymentRow)`. The reservation succeeds, but the payment/deposit record is dropped silently.
- **Impact**: Database orphaned state: reservations exist with no corresponding payment/deposit record.

---

### [MEDIUM] SEC-05: Direct PostgREST Reservation Tampering (Unconstrained Status & Pricing)

- **File Path**:
  - [supabase/migrations/001_initial_schema.sql](file:///c:/Users/DAVE/Desktop/idiot/supabase/migrations/001_initial_schema.sql#L281-L286)
- **Supporting Policy**: Policy `reservations_insert_customer` on `public.reservations`
- **Vulnerability Mechanism**:
  1. The policy states:
     ```sql
     CREATE POLICY "reservations_insert_customer" ON public.reservations
       FOR INSERT WITH CHECK (
         auth.uid() = customer_id AND public.get_auth_role() = 'CUSTOMER'
       );
     ```
  2. While the Next.js Server Action (`createReservationAction`) calculates prices and forces `status = 'PENDING_APPROVAL'`, the **Supabase PostgREST API is exposed publicly** to anyone holding the anon key and an authenticated session.
  3. A malicious customer bypassing the Next.js UI can issue a direct REST `POST` to `/rest/v1/reservations` supplying:
     - `"status": "APPROVED"`
     - `"daily_rate_snapshot": 1.00`
     - `"subtotal_php": 1.00`
     - `"security_deposit_php": 0.00`
     - `"total_amount_php": 1.00`
  4. Because the RLS `WITH CHECK` clause does not enforce `status = 'PENDING_APPROVAL'`, the database accepts the manipulated booking as pre-approved with fraudulent pricing.
- **Impact**: Potential bypass of business approvals and pricing controls via direct API access.

---

### [MEDIUM] SEC-06: Spoofable and Unrestricted Audit Log Insertion

- **File Path**:
  - [supabase/migrations/001_initial_schema.sql](file:///c:/Users/DAVE/Desktop/idiot/supabase/migrations/001_initial_schema.sql#L334-L336)
- **Supporting Policy**: Policy `audit_insert_any_authenticated` on `public.activity_audit_logs`
- **Vulnerability Mechanism**:
  1. The insertion policy is defined as:
     ```sql
     CREATE POLICY "audit_insert_any_authenticated" ON public.activity_audit_logs
       FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
     ```
  2. Any authenticated user can insert arbitrary rows into `activity_audit_logs`.
  3. There is no check verifying that `actor_id = auth.uid()` or that `actor_role = public.get_auth_role()`.
  4. An attacker can inject fraudulent audit records claiming an administrator performed actions (e.g., settling a deposit or decommissioning a camera), contaminating academic defense audit trails and compliance records.
- **Impact**: Loss of audit log integrity and non-repudiation.

---

### [LOW] SEC-07: Migration 003 Production Application State Unverified

- **File Path**:
  - [supabase/migrations/003_harden_profiles_role_security.sql](file:///c:/Users/DAVE/Desktop/idiot/supabase/migrations/003_harden_profiles_role_security.sql)
  - [SUPABASE_INTEGRATION_AUDIT.md](file:///c:/Users/DAVE/Desktop/idiot/SUPABASE_INTEGRATION_AUDIT.md#L19)
- **Vulnerability Mechanism**:
  Migration 003 exists in the repository, but without direct superuser access or running a live mutation test, it cannot be confirmed whether `trg_protect_profile_role` is active on the live database. If Migration 003 was never run in the Supabase Dashboard SQL Editor, non-admins can also update their own `role` column via `PATCH /rest/v1/profiles`.
- **Impact**: Risk of unmitigated profile role mutation if the SQL patch was omitted during deployment.

---

## 5. Recommended Fixes in Priority Order

> **Note**: As per audit rules, these fixes are documented for planning and review. No files or database objects have been modified during this audit.

### Priority 1: Remediate Profile Role Privilege Escalation (Fix SEC-01 & SEC-07)
Create a new migration (e.g., `004_fix_profiles_role_insert_security.sql`) to enforce:
1. Extend `protect_profile_role()` to trigger **`BEFORE INSERT OR UPDATE`**.
2. On `INSERT`, enforce that non-admins cannot supply `NEW.role != 'CUSTOMER'`:
   ```sql
   CREATE OR REPLACE FUNCTION public.protect_profile_role()
   RETURNS TRIGGER AS $$
   BEGIN
     IF TG_OP = 'INSERT' THEN
       IF NEW.role IS DISTINCT FROM 'CUSTOMER' AND (public.get_auth_role() IS DISTINCT FROM 'ADMIN') THEN
         RAISE EXCEPTION 'Unauthorized: New users must be assigned CUSTOMER role.' USING ERRCODE = '42501';
       END IF;
     ELSIF TG_OP = 'UPDATE' THEN
       IF (OLD.role IS DISTINCT FROM NEW.role) AND (public.get_auth_role() IS DISTINCT FROM 'ADMIN') THEN
         RAISE EXCEPTION 'Unauthorized: Only administrators can modify user roles.' USING ERRCODE = '42501';
       END IF;
     END IF;
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

   DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
   CREATE TRIGGER trg_protect_profile_role
   BEFORE INSERT OR UPDATE ON public.profiles
   FOR EACH ROW
   EXECUTE FUNCTION public.protect_profile_role();
   ```
3. Update `profiles_insert_own` RLS policy to explicitly check `role = 'CUSTOMER'`:
   ```sql
   DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
   CREATE POLICY "profiles_insert_own" ON public.profiles
     FOR INSERT WITH CHECK (
       auth.uid() = id AND (role = 'CUSTOMER' OR public.get_auth_role() = 'ADMIN')
     );
   ```

---

### Priority 2: Fix `reservations_update` RLS Policy for Customer Cancellation (Fix SEC-03)
Split or provide an explicit `WITH CHECK` expression on `reservations_update`:
```sql
DROP POLICY IF EXISTS "reservations_update" ON public.reservations;
CREATE POLICY "reservations_update" ON public.reservations
  FOR UPDATE
  USING (
    (auth.uid() = customer_id AND status = 'PENDING_APPROVAL') OR
    public.get_auth_role() = 'ADMIN'
  )
  WITH CHECK (
    (auth.uid() = customer_id AND status = 'CANCELLED') OR
    public.get_auth_role() = 'ADMIN'
  );
```

---

### Priority 3: Add Customer INSERT Policy on `payments_and_deposits` (Fix SEC-04)
Allow customers to create the initial `PENDING` payment record associated with their new reservation:
```sql
DROP POLICY IF EXISTS "payments_customer_insert" ON public.payments_and_deposits;
CREATE POLICY "payments_customer_insert" ON public.payments_and_deposits
  FOR INSERT WITH CHECK (
    payment_status = 'PENDING' AND
    deposit_status = 'HELD' AND
    settled_by_admin_id IS NULL AND
    EXISTS (
      SELECT 1 FROM public.reservations r
      WHERE r.id = reservation_id AND r.customer_id = auth.uid()
    )
  );
```

---

### Priority 4: Harden `reservations_insert_customer` RLS Policy (Fix SEC-05)
Enforce that customers inserting via PostgREST cannot forge status or bypass approval:
```sql
DROP POLICY IF EXISTS "reservations_insert_customer" ON public.reservations;
CREATE POLICY "reservations_insert_customer" ON public.reservations
  FOR INSERT WITH CHECK (
    auth.uid() = customer_id AND
    public.get_auth_role() = 'CUSTOMER' AND
    status = 'PENDING_APPROVAL' AND
    rejection_reason IS NULL
  );
```

---

### Priority 5: Decide on Single Source of Identity (Clerk vs. Supabase Auth) (Fix SEC-02)
Resolve the architectural split:
- **Option A (Recommended for Supabase RLS)**: Use native Supabase Auth exclusively (`@supabase/ssr`). Decommission Clerk dependencies, components, and middleware. This aligns 100% with `auth.uid()`, PostgreSQL UUID primary keys, and RLS policies.
- **Option B (If Clerk is mandatory)**: Configure Clerk's Supabase JWT integration (Clerk JWT templates signing with Supabase JWT Secret). Set up Supabase to accept Clerk JWTs, or maintain a privileged server-side sync service that translates Clerk string IDs into valid PostgreSQL UUID records using `SUPABASE_SERVICE_ROLE_KEY` strictly on the backend.

---

### Priority 6: Harden Audit Log Integrity (Fix SEC-06)
Constrain `activity_audit_logs` inserts so actors cannot spoof identity:
```sql
DROP POLICY IF EXISTS "audit_insert_any_authenticated" ON public.activity_audit_logs;
CREATE POLICY "audit_insert_any_authenticated" ON public.activity_audit_logs
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    actor_id = auth.uid() AND
    actor_role = public.get_auth_role()
  );
```

---

## 6. Audit Verdict & Next Steps

### Verdict
**DO NOT PROCEED TO FEATURE EXPANSION UNTIL SECURITY REMEDIATION IS COMPLETED.**

The system cannot safely accept untrusted customer registrations or bookings in production in its current state due to:
1. The **CRITICAL** vulnerability permitting self-assignment of the `ADMIN` role on profile insertion.
2. The **HIGH** defect preventing customer booking cancellation under PostgreSQL RLS.
3. The **HIGH** defect dropping payment records due to missing RLS insertion policies.
4. The **HIGH** architectural mismatch between Clerk and Supabase RLS.

### Required Actions Before Proceeding:
1. Confirm the decision regarding authentication provider (Supabase Auth native vs. Clerk JWT template integration).
2. Author and review migration `004` containing the Priority 1, 2, 3, 4, and 6 SQL fixes.
3. Apply migration `004` to the Supabase instance via Dashboard SQL Editor or Supabase CLI.
4. Run integration tests verifying that customer role escalation on `INSERT` is rejected by PostgreSQL with code `42501`.
