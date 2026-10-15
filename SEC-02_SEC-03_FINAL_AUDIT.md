# IDIO — Final SEC-02 & SEC-03 Security Audit (Read-Only)

**System:** IDIO Digital Camera Rental Management System  
**Repository:** `kenneth9669/IDIO`  
**Workspace:** `C:\Users\DAVE\Desktop\idiot`  
**Audit Type:** Independent Static Code, Architecture & RLS Review  
**Execution Mode:** READ-ONLY (No migrations applied to live DB; zero destructive modifications)  
**Date:** October 12, 2026  
**Final Status:** **NOT READY FOR LIVE PRODUCTION** | **CONDITIONALLY READY FOR ISOLATED STAGING**

---

## 1. Executive Summary

This independent audit conducts an exhaustive, read-only security inspection of the IDIO Camera Rental codebase, focusing on:
1. **SEC-02 Remediation:** Clerk authentication integration, Supabase JWT forwarding, identity synchronization, UUID preservation, and SQL identity bridge helpers.
2. **SEC-03 Preparation:** Reservation ownership, state-transition lifecycle enforcement, mutation invariants, payment boundary validation, and Row-Level Security (RLS) policies.

### Core Verdict
- **Production Status:** **NOT READY.** Real PostgreSQL RLS enforcement and trigger execution have not been demonstrated in an active database instance; tests pass exclusively in an in-memory mocked environment. Furthermore, Clerk has deprecated legacy custom JWT templates in favor of native Supabase Third-Party Auth.
- **Staging Status:** **CONDITIONALLY READY.** Migration `006_clerk_supabase_identity_bridge.sql` is architecturally sound and safe to apply to an **isolated development or staging database**, subject to resolving a latent `22P02` cast risk in the `profiles_insert_own` policy.

---

## 2. Inventory of Inspected Files & Database Artifacts

### Application & Library Code
- `src/lib/supabase/server.ts` — Server-side Supabase client initialization, cookie management, and Clerk token extraction.
- `src/lib/auth.ts` — Server-side RBAC guards (`getAuthenticatedUser`, `requireAuth`, `requireRole`, `requireAdmin`, `requireCustomer`).
- `src/lib/clerkSync.ts` — Clerk-to-Supabase profile auto-provisioning, deterministic UUID derivation, and account takeover guards.
- `src/app/actions/authActions.ts` — Server actions for registration, sign-in, profile updates, and role modification.
- `src/lib/reservations/reservationService.ts` — Reservation query and mutation workflows (`createReservation`, `approveReservation`, `rejectReservation`, `cancelReservation`).
- `src/lib/reservations/reservationValidation.ts` — Server-side reservation validation, date checking, and status-transition matrix.
- `src/lib/payments/paymentService.ts` — Financial ledger operations (`confirmPayment`, `refundPayment`, `settleSecurityDeposit`).
- `src/lib/payments/paymentValidation.ts` — Payment reference, method, and deposit deduction validators.
- `src/app/auth/callback/route.ts` — Legacy Supabase OAuth callback route.

### Database Migrations & Schemas
- `supabase/migrations/001_initial_schema.sql` — Base schema (enums, 7 domain tables, initial RLS policies, GIST exclusion constraint).
- `supabase/migrations/002_fix_profiles_rls_and_clerk_id.sql` — Addition of `clerk_id` column and initial insert policy.
- `supabase/migrations/003_harden_profiles_role_security.sql` — Initial before-update trigger on `profiles.role`.
- `supabase/migrations/004_set_default_cash_pickup.sql` — Default payment method migration to `CASH_PICKUP`.
- `supabase/migrations/005_harden_profile_insert_role.sql` — Enhanced `protect_profile_role()` trigger (BEFORE INSERT OR UPDATE).
- `supabase/migrations/006_clerk_supabase_identity_bridge.sql` — Identity bridge helpers (`current_clerk_id`, `current_profile_id`, `get_auth_role`), RLS overhauls across 5 tables, and `protect_reservation_mutation()` trigger.

---

## 3. Findings Ranked by Severity

```
+---------------------------------------------------------------------------------------+
| SEVERITY LEVEL | COUNT | SUMMARY                                                      |
+---------------------------------------------------------------------------------------+
| CRITICAL       |   0   | No unauthenticated RLS bypass or remote privilege escalation |
| HIGH           |   3   | Clerk JWT Deprecation, Silent Anon Fallback, RLS 22P02 Risk  |
| MEDIUM         |   2   | Missing Clerk Webhook Sync, GCash UI vs RLS Divergence       |
| LOW            |   2   | Legacy OAuth Callback Route, Client-side Search Filtering    |
+---------------------------------------------------------------------------------------+
```

---

### Finding ID: SEC-AUD-01 (HIGH)
**Title:** Deprecation of Clerk `{ template: 'supabase' }` in Favor of Supabase Third-Party Auth  
**Category:** Authentication Architecture / External Vendor Integration  
**Affected File:** [src/lib/supabase/server.ts](file:///c:/Users/DAVE/Desktop/idiot/src/lib/supabase/server.ts#L18)  
**Evidence:**
```typescript
// src/lib/supabase/server.ts, line 18
const authObj = await auth();
if (authObj && typeof authObj.getToken === 'function') {
  clerkToken = await authObj.getToken({ template: 'supabase' });
}
```
**Analysis:**
As of April 1, 2025, Clerk has officially **deprecated** custom JWT templates for Supabase in favor of Supabase's native **Third-Party Auth** (JWKS verification). While legacy projects with pre-existing templates and shared JWT signing secrets continue to function, newer Supabase instances do not provide access to the raw JWT secret and require configuring the Clerk Issuer Domain in the Supabase Dashboard (`Authentication -> Third-Party Auth`). Calling `getToken({ template: 'supabase' })` without a pre-configured template in Clerk returns `null`.  
**Impact:** If deployed to a modern Supabase project that uses Third-Party Auth, token forwarding fails completely, degrading all database calls to anonymous access.  
**Resolution Required Before Production:**
1. In Clerk Dashboard: Check if legacy Supabase template exists or configure native Supabase Third-Party Auth.
2. In Supabase Dashboard: Add Clerk under Third-Party Auth with the Clerk Domain.
3. In `server.ts`: Update token retrieval to use standard session token `await authObj.getToken()` once Third-Party Auth is enabled.

---

### Finding ID: SEC-AUD-02 (HIGH)
**Title:** Silent Degradation to PostgreSQL `anon` Role on Missing or Expired Token  
**Category:** Resilience & Error Handling  
**Affected File:** [src/lib/supabase/server.ts](file:///c:/Users/DAVE/Desktop/idiot/src/lib/supabase/server.ts#L15-L27)  
**Evidence:**
```typescript
// src/lib/supabase/server.ts, lines 15-27
try {
  const authObj = await auth();
  if (authObj && typeof authObj.getToken === 'function') {
    clerkToken = await authObj.getToken({ template: 'supabase' });
  }
} catch {
  // Outside of request context, unauthenticated, or Clerk template not configured
}

const globalHeaders: Record<string, string> = {};
if (clerkToken) {
  globalHeaders['Authorization'] = `Bearer ${clerkToken}`;
}
```
**Analysis:**
If a user is authenticated in Clerk (`currentUser()` succeeds), but `authObj.getToken({ template: 'supabase' })` throws or yields `null` (e.g. token expired or template misconfigured), `createClient()` silently returns a client with no `Authorization` header. Requests are executed using `NEXT_PUBLIC_SUPABASE_ANON_KEY`, assuming the PostgreSQL role `anon`.  
**Impact:**
- Mutations correctly fail closed because `current_profile_id()` returns `NULL`, but they produce confusing `42501` RLS errors rather than descriptive `401 Unauthorized` responses.
- Queries like `getReservations()` return empty datasets (`[]`) rather than failing, leading the UI to display "No reservations found" instead of prompting the user to refresh their session.  
**Resolution:** Explicitly verify that authenticated operations have a non-null token, or log a warning when `authObj` is present but `clerkToken` is absent.

---

### Finding ID: SEC-AUD-03 (HIGH)
**Title:** Latent `22P02: invalid input syntax for type uuid` Risk in `profiles_insert_own`  
**Category:** PostgreSQL RLS Expression Evaluation  
**Affected File:** [supabase/migrations/006_clerk_supabase_identity_bridge.sql](file:///c:/Users/DAVE/Desktop/idiot/supabase/migrations/006_clerk_supabase_identity_bridge.sql#L123-L125)  
**Evidence:**
```sql
-- supabase/migrations/006_clerk_supabase_identity_bridge.sql, lines 122-128
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (
    (
      clerk_id = public.current_clerk_id() OR 
      (auth.uid() IS NOT NULL AND auth.uid() = id)
    ) AND (
      role = 'CUSTOMER' OR (public.get_auth_role() IS NOT NULL AND public.get_auth_role() = 'ADMIN')
    )
  );
```
**Analysis:**
Supabase's built-in `auth.uid()` function is defined as:
```sql
SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
```
PostgreSQL's SQL query planner does **not guarantee short-circuit evaluation** of boolean `OR` expressions. In certain plan nodes or execution contexts, PostgreSQL may evaluate `auth.uid() IS NOT NULL` even when `clerk_id = public.current_clerk_id()` is true. When a Clerk JWT is present (`sub` is `'user_2...'`), the cast `::uuid` inside `auth.uid()` throws:
`ERROR: 22P02: invalid input syntax for type uuid: "user_2xxxx"`  
(Note: Migration 006 safely guarded this inside `public.current_profile_id()` using a PL/pgSQL `BEGIN ... EXCEPTION WHEN others ...` block, but line 124 calls `auth.uid()` directly in an SQL policy).  
**Impact:** Customer profile insertion during registration or first login could crash with a fatal `22P02` database exception in PostgreSQL.  
**Resolution Required Before Staging:**
Replace line 124 in `006_clerk_supabase_identity_bridge.sql` with:
```sql
clerk_id = public.current_clerk_id() OR (public.current_profile_id() IS NOT NULL AND public.current_profile_id() = id)
```
This routes all identity resolution through the safe PL/pgSQL wrapper and avoids direct calls to `auth.uid()`.

---

### Finding ID: SEC-AUD-04 (MEDIUM)
**Title:** Absence of Clerk Webhook Synchronization for User Deletion / Lifecycle  
**Category:** Account Lifecycle & Data Hygiene  
**Affected Files:** Repository-wide (`src/app/api/`)  
**Evidence:** No route handlers match `/api/webhooks/clerk` or listen for Clerk event webhooks (`user.created`, `user.updated`, `user.deleted`).  
**Analysis:**
Profile creation relies entirely on on-demand lazy synchronization via `syncCurrentClerkUser()` in `src/lib/clerkSync.ts`. If a user is deleted or disabled in Clerk, their database profile row in `public.profiles` remains untouched.  
**Impact:**
- Because child foreign keys (`reservations.customer_id`, `rentals.customer_id`) specify `ON DELETE RESTRICT`, historical accounting records are safely preserved from accidental deletion.
- However, orphaned profiles remain indefinitely in `public.profiles` without synchronization of status changes or suspensions initiated in the Clerk dashboard.  
**Resolution:** Implement an official Clerk webhook handler verifying Svix signatures to synchronize account state changes.

---

### Finding ID: SEC-AUD-05 (MEDIUM)
**Title:** Discrepancy Between UI Payment Options and Strictest Cash-Only RLS Policy  
**Category:** Business Logic vs Database Enforcement  
**Affected Files:**
- [src/lib/reservations/reservationValidation.ts](file:///c:/Users/DAVE/Desktop/idiot/src/lib/reservations/reservationValidation.ts#L4)
- [supabase/migrations/006_clerk_supabase_identity_bridge.sql](file:///c:/Users/DAVE/Desktop/idiot/supabase/migrations/006_clerk_supabase_identity_bridge.sql#L251-L255)  
**Evidence:**
- In `reservationValidation.ts`:
  `ALLOWED_NEW_PAYMENT_METHODS: PaymentMethod[] = ['CASH_PICKUP'];`
- In `006_clerk_supabase_identity_bridge.sql`:
  `CREATE POLICY "payments_customer_insert" ... WITH CHECK (payment_method = 'CASH_PICKUP' AND ...)`
- In database enum (`001_initial_schema.sql`):
  `CREATE TYPE public.payment_method AS ENUM ('GCASH', 'CASH_PICKUP', 'MAYA', 'BANK_TRANSFER');`
**Analysis:**
The database enum allows `'GCASH'`, `'MAYA'`, and `'BANK_TRANSFER'`. If future development enables GCash in the reservation UI without updating `payments_customer_insert`, customer inserts will fail with RLS errors because the policy strictly requires `'CASH_PICKUP'`.  
**Impact:** None currently (the application enforces Cash on Counter Pickup). If online payments are re-introduced in a future phase, the RLS policy must be updated concurrently.

---

### Finding ID: SEC-AUD-06 (LOW)
**Title:** Redundant Legacy Supabase OAuth Callback Route  
**Category:** Code Hygiene  
**Affected File:** [src/app/auth/callback/route.ts](file:///c:/Users/DAVE/Desktop/idiot/src/app/auth/callback/route.ts)  
**Evidence:** Route handler exchanges Supabase auth code (`supabase.auth.exchangeCodeForSession(code)`).  
**Analysis:** Clerk is the designated authentication provider. The Supabase auth callback route is obsolete.  
**Impact:** Dead code; no direct vulnerability, but may cause confusion during maintenance.

---

### Finding ID: SEC-AUD-07 (LOW)
**Title:** Client-Side Filter Application in Service Queries  
**Category:** Performance & Query Architecture  
**Affected File:** [src/lib/reservations/reservationService.ts](file:///c:/Users/DAVE/Desktop/idiot/src/lib/reservations/reservationService.ts#L128-L139)  
**Evidence:** Text search across reference numbers, customer names, and camera models is performed in JavaScript on the fetched dataset rather than via PostgreSQL `ILIKE` or full-text search.  
**Analysis:** While safe for academic demonstration datasets (< 500 records), large production fleets will experience latency and memory overhead.

---

## 4. Policy-by-Policy RLS Security Matrix

The table below details every policy across the schema and evaluates whether it is fully protected against forged claims, privilege escalation, and cross-customer data leakage.

| Table | Operation | Policy Name | Status | Evaluation & Security Guarantee |
|---|---|---|---|---|
| `public.profiles` | `SELECT` | `profiles_select_own_or_admin` | **SECURE** | Uses `current_profile_id()` and `current_clerk_id()`. Customer can view only their own record; admin can view all. Fails closed on unauthenticated. |
| `public.profiles` | `INSERT` | `profiles_insert_own` | **NEEDS PATCH** | Enforces `role = 'CUSTOMER'` and Clerk ID match. Contains latent `auth.uid()` cast risk (Finding SEC-AUD-03). |
| `public.profiles` | `UPDATE` | `profiles_update_own` | **SECURE** | Restricted to own ID or ADMIN. Trigger `protect_profile_role` prevents non-admins from altering `role`. |
| `public.profiles` | `DELETE` | *(None)* | **SECURE** | Default deny. Profiles cannot be deleted via API. |
| `public.digital_cameras` | `SELECT` | `cameras_select_all` | **SECURE** | Public read allowed for catalog browsing. |
| `public.digital_cameras` | `ALL (Writes)`| `cameras_admin_mutation` | **SECURE** | Strictly requires `get_auth_role() = 'ADMIN'`. Customers and anonymous callers cannot alter inventory. |
| `public.reservations` | `SELECT` | `reservations_select` | **SECURE** | Strictly `customer_id = current_profile_id() OR get_auth_role() = 'ADMIN'`. Zero cross-customer record leakage. |
| `public.reservations` | `INSERT` | `reservations_insert_customer` | **SECURE** | Binds `customer_id` strictly to caller's `current_profile_id()`. Customer cannot create reservation for another ID. |
| `public.reservations` | `UPDATE` | `reservations_update` | **SECURE** | `USING (status = 'PENDING_APPROVAL') WITH CHECK (status = 'CANCELLED')` for customer. Trigger `protect_reservation_mutation` blocks field tampering. |
| `public.reservations` | `DELETE` | *(None)* | **SECURE** | Default deny. Reservations cannot be deleted via API. |
| `public.rentals` | `SELECT` | `rentals_select` | **SECURE** | Customer sees only rentals where `customer_id = current_profile_id()`. Admin sees all. |
| `public.rentals` | `ALL (Writes)`| `rentals_admin_mutate` | **SECURE** | Restricted strictly to `get_auth_role() = 'ADMIN'`. Customer cannot create or modify rental handovers. |
| `public.payments_and_deposits` | `SELECT` | `payments_select` | **SECURE** | Joins to `reservations` checking caller ownership or admin role. |
| `public.payments_and_deposits` | `INSERT` | `payments_customer_insert` | **SECURE** | Strictly requires `CASH_PICKUP`, `PENDING`, `HELD`, and verifies ownership of parent reservation. |
| `public.payments_and_deposits` | `ALL (Writes)`| `payments_admin_mutate` | **SECURE** | Confirming payments, processing refunds, and settling deposits are strictly admin-only. |
| `public.maintenance_tickets` | `ALL` | `maintenance_admin` | **SECURE** | Admin-only read and write. Customers have zero access. |
| `public.activity_audit_logs` | `SELECT` | `audit_admin_select` | **SECURE** | Admin-only read. |
| `public.activity_audit_logs` | `INSERT` | `audit_insert_actor_bound` | **SECURE** | `actor_id` and `actor_role` must match caller's token. Cannot forge audit attribution. |
| `public.activity_audit_logs` | `UPDATE/DELETE`| *(None)* | **SECURE** | Append-only ledger. Mutations and deletions are permanently denied. |

---

## 5. Reservation State-Transition & Mutation Integrity Review

### Lifecycle State Machine
```
                       +-----------------------+
                       |   PENDING_APPROVAL    |
                       +-----------+-----------+
                                   |
              +--------------------+--------------------+
              | (Customer Cancel)  | (Admin Reject)     | (Admin Approve)
              v                    v                    v
        +-----------+        +------------+       +-----------+
        | CANCELLED |        |  REJECTED  |       | APPROVED  |
        +-----------+        +------------+       +-----+-----+
                                                        |
                                                        | (Admin Dispatch)
                                                        v
                                                  +-----------+
                                                  |  ACTIVE   |
                                                  +-----+-----+
                                                        |
                                                        | (Admin Return / Inspection)
                                                        v
                                                  +-----------+
                                                  | COMPLETED |
                                                  +-----------+
```

### Invariant Checks
1. **Can customers cancel approved or completed reservations?**
   - **NO.** In `reservationService.ts` line 578: `existing.status !== 'PENDING_APPROVAL'` returns an error.
   - In SQL RLS (`reservations_update`): `USING` requires `status = 'PENDING_APPROVAL'`.
   - In SQL Trigger (`protect_reservation_mutation`): `OLD.status != 'PENDING_APPROVAL'` raises exception `42501`.
2. **Can customers modify prices, camera IDs, or rental dates?**
   - **NO.** Price calculations are performed on the server by reading `digital_cameras` directly from the database; client-supplied prices in the payload are ignored.
   - In SQL Trigger (`protect_reservation_mutation`): Any divergence in `camera_id`, `customer_id`, `start_date`, `end_date`, `total_days`, `daily_rate_snapshot`, `subtotal_php`, `security_deposit_php`, `total_amount_php`, or `reference_no` raises exception `42501`.
3. **Can concurrent users book overlapping dates on the same camera?**
   - **NO.** Guarded at the database engine level by PostgreSQL GIST exclusion constraint:
     ```sql
     ADD CONSTRAINT prevent_camera_reservation_overlap
     EXCLUDE USING gist (
       camera_id WITH =,
       rental_period WITH &&
     )
     WHERE (status IN ('PENDING_APPROVAL', 'APPROVED'));
     ```
     Even if two concurrent requests bypass application availability checks, PostgreSQL enforces atomic serialization and raises error `23P01`.

---

## 6. Staging Readiness Assessment: Is Migration 006 Safe for Staging?

### Verdict: **YES, CONDITIONALLY READY FOR STAGING.**

### Rationale
1. **Zero Data Loss:** Migration 006 performs **no destructive table drops or column deletions**. `profiles.id` remains a `UUID` primary key, preserving all existing foreign keys across reservations, rentals, and payments.
2. **Decoupled Identity:** Safely drops `profiles_id_fkey` to allow Clerk user IDs without breaking relational integrity.
3. **Non-Breaking Helpers:** SQL functions `current_clerk_id()`, `current_profile_id()`, and `get_auth_role()` are `STABLE` and contain explicit search paths (`SET search_path = public, pg_catalog`), preventing search-path hijacking attacks.
4. **Pre-Staging Prerequisite:** Before running `006_clerk_supabase_identity_bridge.sql` in staging, fix the latent `auth.uid()` cast in line 124 of `profiles_insert_own` (Finding SEC-AUD-03) to prevent unexpected `22P02` syntax errors during Clerk registration.

---

## 7. Isolated Staging Test Checklist

Execute this checklist in a local Supabase CLI instance (`supabase start`) or dedicated staging database before considering production rollout:

- [ ] **Step 1: Schema Migration Execution**
  - Run `supabase db reset` and verify that migrations `001` through `006` apply without syntax errors or warnings.
- [ ] **Step 2: Token Bridge Verification (SQL Level)**
  ```sql
  -- Simulate a Clerk JWT session
  SET LOCAL request.jwt.claim.sub = 'user_clerk_test_customer_01';
  SET LOCAL role = 'authenticated';
  
  -- Verify helper functions
  SELECT public.current_clerk_id(); -- Must return 'user_clerk_test_customer_01'
  SELECT public.current_profile_id(); -- Must return matching profile UUID or NULL if not yet created
  SELECT public.get_auth_role(); -- Must return 'CUSTOMER'
  ```
- [ ] **Step 3: Customer Isolation Test**
  - Create two customer profiles (`cust_1` and `cust_2`).
  - As `cust_1`, query `public.profiles`, `public.reservations`, and `public.payments_and_deposits`.
  - Assert that `cust_1` receives **0 rows** for records belonging to `cust_2`.
- [ ] **Step 4: Customer Reservation Cancellation Test**
  - As `cust_1`, insert a reservation in `PENDING_APPROVAL` status.
  - Update `status = 'CANCELLED'`. Assert update **succeeds**.
  - Attempt to update `daily_rate_snapshot = 1.00` during cancellation. Assert PostgreSQL raises `42501` exception from `protect_reservation_mutation`.
- [ ] **Step 5: Overlap Exclusion Constraint Test**
  - Attempt to insert two reservations for `CAM-001` with overlapping dates `[2026-11-01, 2026-11-05]`.
  - Assert that the second insert fails with error `23P01 (exclusion_violation)`.
- [ ] **Step 6: Clerk Dashboard JWT Verification**
  - Verify that the Clerk Dashboard JWT configuration matches Supabase's expected claims.
  - Test real HTTP request from Next.js server action to Supabase with live bearer token and verify that `auth.getUser()` or RLS queries succeed.

---

## 8. Final Live Deployment Recommendation

```
+---------------------------------------------------------------------------------------+
| FINAL VERDICT: NOT READY FOR PRODUCTION DEPLOYMENT                                    |
|                                                                                       |
| Why: While application-layer unit and workflow tests pass (235/235), live PostgreSQL  |
| RLS policy evaluation and trigger execution have not been demonstrated in an active   |
| Supabase database. Applying migrations 005 and 006 directly to the production         |
| database without isolated staging validation violates strict release safety policies. |
|                                                                                       |
| Next Milestone: Run the Staging Test Checklist in an isolated environment, resolve     |
| Finding SEC-AUD-03 in migration 006, and verify live Clerk JWT header forwarding.     |
+---------------------------------------------------------------------------------------+
```

*Audit report compiled by Antigravity IDE for the IDIO Camera Rental System.*
