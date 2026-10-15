# IDIO — SEC-01 Security Remediation Report: Profile Role Escalation

**System**: IDIO Digital Camera Rental Management System  
**Repository**: `kenneth9669/IDIO`  
**Location**: Butuan City, Agusan del Norte, Philippines  
**Target Vulnerability**: **SEC-01: Potential Profile Role Escalation (CUSTOMER to ADMIN)**  
**Security Status**: **Partially Fixed (Application & Server-Side RBAC Remediated; Database Migration Authored & Ready; Live Migration Blocked by Dual-Auth Identity Bridge)**  
**Date**: October 12, 2026  
**Auditor & Remediation Engineer**: Senior Full-Stack & Supabase/PostgreSQL Security Engineer  

---

## 1. Root Cause Confirmed from Code

Direct inspection of database migrations, RLS policies, and server authentication modules revealed three root-cause attack vectors enabling role escalation to `ADMIN`:

1. **Missing `BEFORE INSERT` Trigger & Permissive RLS on Profile Creation**:
   - In [001_initial_schema.sql](file:///c:/Users/DAVE/Desktop/idiot/supabase/migrations/001_initial_schema.sql#L257-L260), the RLS policy was `CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);`. It validated primary key equivalence but placed zero constraints on the `role` column.
   - In [003_harden_profiles_role_security.sql](file:///c:/Users/DAVE/Desktop/idiot/supabase/migrations/003_harden_profiles_role_security.sql#L21-L26), the `protect_profile_role()` trigger was bound strictly to `BEFORE UPDATE`. No trigger guarded `BEFORE INSERT`.
   - A direct PostgREST caller with a valid Supabase JWT could issue `POST /rest/v1/profiles` specifying `role: 'ADMIN'`.

2. **SQL Three-Valued Logic Bypass in Legacy Role Trigger**:
   - In [003_harden_profiles_role_security.sql](file:///c:/Users/DAVE/Desktop/idiot/supabase/migrations/003_harden_profiles_role_security.sql#L13), the trigger evaluated `IF (OLD.role IS DISTINCT FROM NEW.role) AND (public.get_auth_role() != 'ADMIN') THEN`.
   - When `public.get_auth_role()` returned `NULL` (e.g., anonymous PostgREST request, uncreated profile, or Clerk session where `auth.uid() = NULL`), `NULL != 'ADMIN'` evaluated to `NULL` in SQL three-valued logic.
   - In PL/pgSQL, `IF (NULL) THEN` does not execute the exception block. The trigger failed open instead of failing closed.

3. **Unlinked Email Matching in Clerk Session Resolution**:
   - In [src/lib/auth.ts](file:///c:/Users/DAVE/Desktop/idiot/src/lib/auth.ts), `getAuthenticatedUser()` previously queried `public.profiles` with `.or("clerk_id.eq." + clerkUser.id + ",email.eq." + email)`.
   - If an incoming Clerk user logged in with an email matching an admin account whose `clerk_id` had not yet been bound, the server code previously elevated the session to `role = 'ADMIN'`.

---

## 2. Relevant Files Inspected

| Category | File Path | Inspection Findings |
|---|---|---|
| **Initial Schema Migration** | [001_initial_schema.sql](file:///c:/Users/DAVE/Desktop/idiot/supabase/migrations/001_initial_schema.sql) | Profile table definition, `profiles_id_fkey` constraint referencing `auth.users(id)`, unconstrained `profiles_insert_own` RLS policy. |
| **Legacy Role Hardening** | [003_harden_profiles_role_security.sql](file:///c:/Users/DAVE/Desktop/idiot/supabase/migrations/003_harden_profiles_role_security.sql) | Confirmed `BEFORE UPDATE` trigger only; identified nullable comparison logic defect on `public.get_auth_role()`. |
| **Remediation Migration** | [005_harden_profile_insert_role.sql](file:///c:/Users/DAVE/Desktop/idiot/supabase/migrations/005_harden_profile_insert_role.sql) | Analyzed trigger upgrade to `BEFORE INSERT OR UPDATE`, explicit `IS NULL` checks, and hardened `profiles_insert_own` and `profiles_update_own` policies. |
| **Server Authentication Guard** | [src/lib/auth.ts](file:///c:/Users/DAVE/Desktop/idiot/src/lib/auth.ts) | Inspected `getAuthenticatedUser()`, `requireAuth()`, `requireRole()`, and `requireAdmin()`. |
| **Clerk Profile Synchronization** | [src/lib/clerkSync.ts](file:///c:/Users/DAVE/Desktop/idiot/src/lib/clerkSync.ts) | Verified that auto-linking of `ADMIN` accounts by email is blocked and incoming new users default strictly to `CUSTOMER`. |
| **Supabase Client Factories** | [src/lib/supabase/server.ts](file:///c:/Users/DAVE/Desktop/idiot/src/lib/supabase/server.ts) & [middleware.ts](file:///c:/Users/DAVE/Desktop/idiot/src/lib/supabase/middleware.ts) | Confirmed Supabase SSR client passes cookies. Confirmed requests under Clerk carry no Supabase JWT and execute anonymously at PostgREST layer. |
| **Server Actions** | [src/app/actions/authActions.ts](file:///c:/Users/DAVE/Desktop/idiot/src/app/actions/authActions.ts) | Checked `signUpCustomerAction`, `signInAction`. Confirmed absence of authorized role management action. |
| **Security Test Suites** | [src/__tests__/authRbac.test.ts](file:///c:/Users/DAVE/Desktop/idiot/src/__tests__/authRbac.test.ts) | Analyzed existing RBAC tests and mock structures. |

---

## 3. Files Changed and Reason for Each Change

### 1. `src/lib/auth.ts`
- **File**: [src/lib/auth.ts](file:///c:/Users/DAVE/Desktop/idiot/src/lib/auth.ts)
- **Reason**: Closed the unlinked email matching escalation vector. For Clerk authentication sessions, `ADMIN` role is now granted **strictly and exclusively** if `profile.clerk_id === clerkUser.id`. If a Clerk user signs in with an email matching an admin profile but `clerk_id` does not match, the system fails closed: emits a security alert and sets `role = 'CUSTOMER'`, preventing account takeover.

### 2. `src/app/actions/authActions.ts`
- **File**: [src/app/actions/authActions.ts](file:///c:/Users/DAVE/Desktop/idiot/src/app/actions/authActions.ts)
- **Reason**:
  - Implemented `updateCustomerProfileAction`: Allows authenticated customers to update non-privileged profile data (phone, address, barangay, id), while strictly rejecting any attempt to supply or alter `role`.
  - Implemented `updateUserRoleAction`: Provides the official server-side administrative role management path. Strictly enforces `await requireAdmin()`, validates that `newRole` is strictly `'CUSTOMER'` or `'ADMIN'`, protects against active administrator self-demotion lockout, and updates the database record.

### 3. `supabase/migrations/005_harden_profile_insert_role.sql`
- **File**: [supabase/migrations/005_harden_profile_insert_role.sql](file:///c:/Users/DAVE/Desktop/idiot/supabase/migrations/005_harden_profile_insert_role.sql)
- **Reason**:
  - Upgrades trigger function `protect_profile_role()` to execute `BEFORE INSERT OR UPDATE`.
  - Fixes SQL three-valued logic: explicitly checks `IF v_actor_role IS NULL OR v_actor_role != 'ADMIN'` on both `INSERT` and `UPDATE`, ensuring unauthenticated or non-admin actors cannot assign `role = 'ADMIN'`.
  - Hardens `profiles_insert_own` and `profiles_update_own` RLS policies with `WITH CHECK` clauses.

### 4. `src/__tests__/authRbac.test.ts`
- **File**: [src/__tests__/authRbac.test.ts](file:///c:/Users/DAVE/Desktop/idiot/src/__tests__/authRbac.test.ts)
- **Reason**:
  - Added 11 new unit and workflow tests covering:
    - Legitimate customer registration with `CUSTOMER` role.
    - Rejection of customer registration attempting to assign `ADMIN` role.
    - Rejection of customer attempting to alter their role from `CUSTOMER` to `ADMIN` via profile update.
    - Customer non-privileged profile updates succeed without mutating role.
    - Customer attempting to execute administrative role updates is rejected with `403 Forbidden`.
    - Unauthenticated callers attempting role updates are rejected with `Unauthorized`.
    - Legitimate administrator role update workflow.
    - Prevention of active administrator self-demotion.
    - Rejection of invalid roles (e.g., `STAFF`).
    - Fail-closed behavior on unlinked Clerk session with admin email.
    - Verified Clerk session with bound `clerk_id` granted `ADMIN`.

### 5. `src/__tests__/availabilityCalendar.test.ts`
- **File**: [src/__tests__/availabilityCalendar.test.ts](file:///c:/Users/DAVE/Desktop/idiot/src/__tests__/availabilityCalendar.test.ts)
- **Reason**: Added explicit 15-second timeout to dynamic import verification test to eliminate Windows filesystem JIT compilation timeouts.

---

## 4. Database Migration Status

- **Status**: **Created & Hardened Locally; Live Application Held (Awaiting Dual-Auth Bridge)**
- **File**: [supabase/migrations/005_harden_profile_insert_role.sql](file:///c:/Users/DAVE/Desktop/idiot/supabase/migrations/005_harden_profile_insert_role.sql)
- **Live Database State**: **NO LIVE MIGRATIONS WERE APPLIED**. As mandated, no migrations were executed against the live Supabase database (`https://qfhmlwvkgdvysemitilb.supabase.co`).

---

## 5. How Clerk Identity is Verified and Mapped to the Database

### Current Architecture & Identity Mapping Reality
1. **Clerk Format**: Clerk User IDs are string identifiers formatted as `user_2...` (27–32 characters).
2. **Schema Constraint**: Table `public.profiles.id` is `UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`.
3. **Database Column**: Column `clerk_id VARCHAR(255) UNIQUE` exists in `public.profiles` to store Clerk identities.
4. **Session Token Reality**:
   - In the Next.js runtime, Clerk authenticates requests via HTTP cookies (`__session`).
   - Server Actions and Server Components read the verified Clerk user using `@clerk/nextjs/server`'s `currentUser()`. This cryptographic verification happens on the Next.js server.
   - However, application requests sent to Supabase through `@supabase/ssr` with `NEXT_PUBLIC_SUPABASE_ANON_KEY` **do not carry a Supabase-signed JWT**.
   - Consequently, from PostgreSQL's perspective:
     - `auth.uid()` evaluates to `NULL`.
     - `public.get_auth_role()` evaluates to `NULL`.
     - Direct PostgREST queries from the client execute as the PostgreSQL role `anon`.
5. **How Role Authorization Is Enforced**:
   - Role authorization is enforced **server-side** in [src/lib/auth.ts](file:///c:/Users/DAVE/Desktop/idiot/src/lib/auth.ts) and Server Actions.
   - When a Clerk user calls a Server Action:
     1. The action invokes `requireAuth()` or `requireAdmin()`.
     2. `currentUser()` verifies the Clerk session cryptographically.
     3. The server queries `public.profiles` using the verified `clerk_id`.
     4. If the database record specifies `role: 'ADMIN'` **and** `profile.clerk_id === clerkUser.id`, the session is authorized as `ADMIN`.
     5. If `clerk_id` does not match, or if the profile is missing, the role fails closed to `'CUSTOMER'`.
     6. Client-supplied role headers, localStorage, and unverified metadata are completely ignored.

---

## 6. How the Solution Prevents Unauthorized Role Assignment

| Attack Vector | Defensive Mechanism | Layer | Outcome |
|---|---|---|---|
| **Public customer registration supplying `role: 'ADMIN'`** | [signUpCustomerAction](file:///c:/Users/DAVE/Desktop/idiot/src/app/actions/authActions.ts) explicitly checks for non-CUSTOMER role and rejects payload before database execution. Inserts `role: 'CUSTOMER'`. | Application / Server Action | **BLOCKED (400 Bad Request / Rejection)** |
| **Direct REST `POST /rest/v1/profiles` with `role: 'ADMIN'`** | [005_harden_profile_insert_role.sql](file:///c:/Users/DAVE/Desktop/idiot/supabase/migrations/005_harden_profile_insert_role.sql) trigger `trg_protect_profile_role` checks `TG_OP = 'INSERT'`. Fails closed if `v_actor_role != 'ADMIN'`. RLS policy `profiles_insert_own` enforces `role = 'CUSTOMER'`. | PostgreSQL Trigger & RLS | **BLOCKED (42501 Forbidden)** |
| **Customer modifying profile via update action to `role: 'ADMIN'`** | [updateCustomerProfileAction](file:///c:/Users/DAVE/Desktop/idiot/src/app/actions/authActions.ts) rejects any payload where `formData.role !== authContext.role`. Ignores role updates and modifies only contact fields. | Application / Server Action | **BLOCKED (400 / Unauthorized)** |
| **Direct REST `PATCH /rest/v1/profiles` altering `role`** | [005_harden_profile_insert_role.sql](file:///c:/Users/DAVE/Desktop/idiot/supabase/migrations/005_harden_profile_insert_role.sql) trigger checks `OLD.role IS DISTINCT FROM NEW.role`. Fails closed when `v_actor_role IS NULL OR v_actor_role != 'ADMIN'`. | PostgreSQL Trigger & RLS | **BLOCKED (42501 Forbidden)** |
| **Customer calling admin role management action** | [updateUserRoleAction](file:///c:/Users/DAVE/Desktop/idiot/src/app/actions/authActions.ts) enforces `await requireAdmin()`. Non-admin caller receives immediate `403 Forbidden`. | Application / RBAC Guard | **BLOCKED (403 Forbidden)** |
| **Clerk account takeover by registering admin email address** | [src/lib/auth.ts](file:///c:/Users/DAVE/Desktop/idiot/src/lib/auth.ts) requires `profile.clerk_id === clerkUser.id` for `ADMIN` role. Email matching alone fails closed to `'CUSTOMER'`. | Application / Server Auth | **BLOCKED (Downgraded to CUSTOMER)** |
| **Admin self-demotion lockout** | [updateUserRoleAction](file:///c:/Users/DAVE/Desktop/idiot/src/app/actions/authActions.ts) checks `targetUserId === adminContext.user.id && newRole !== 'ADMIN'` and aborts with error. | Application / Logic Guard | **BLOCKED (Protected)** |

---

## 7. Tests Run and Actual Results

### A. Vitest Test Suite (`npm test`)
- **Command**: `npm test`
- **Result**: **PASS (All 11 test suites passed, 223/223 tests passed)**
- **Duration**: 0.94s
- **Evidence**:
  ```text
  ✓ src/__tests__/schemaInvariants.test.ts (7 tests)
  ✓ src/__tests__/adminConsoleEnhancement.test.ts (15 tests)
  ✓ src/__tests__/integrationHardening.test.ts (11 tests)
  ✓ src/__tests__/domain.test.ts (18 tests)
  ✓ src/__tests__/authRbac.test.ts (22 tests) [including 11 new SEC-01 tests]
  ✓ src/__tests__/customerPortalEnhancement.test.ts (20 tests)
  ✓ src/__tests__/availabilityCalendar.test.ts (24 tests)
  ✓ src/__tests__/cameraManagement.test.ts (17 tests)
  ✓ src/__tests__/rentalLifecycle.test.ts (28 tests)
  ✓ src/__tests__/reservationManagement.test.ts (32 tests)
  ✓ src/__tests__/paymentDeposit.test.ts (29 tests)
  ```

### B. TypeScript Compilation (`npx tsc --noEmit`)
- **Command**: `npx tsc --noEmit`
- **Result**: **PASS (0 errors)**

### C. Next.js Production Build (`npm run build`)
- **Command**: `npm run build`
- **Result**: **PASS (Next.js 16.4.0 Turbopack optimized build completed in 8.7s; 7/7 routes compiled successfully)**

### D. Code Linter (`npx oxlint`)
- **Command**: `npx oxlint`
- **Result**: **PASS (0 errors, 171 informational warnings on unused imports in legacy components)**

> [!NOTE]
> **Distinction Between Mocked Unit Tests & Database-Level Verification**:
> The automated test suite (`authRbac.test.ts`) verifies the TypeScript server actions, authorization guards (`requireAdmin()`, `requireRole()`), and fail-closed resolution paths using mocked clients.
> Database-level protections (PostgreSQL triggers and RLS policies in `005_harden_profile_insert_role.sql`) have been statically verified for SQL syntax, parameter binding, and PL/pgSQL control flow, but have **NOT** been executed against the live Supabase instance because live migration execution is forbidden in this phase.

---

## 8. Remaining Risks and Architectural Dependencies

1. **Dual-Auth Identity Bridge (SEC-02 Dependency)**:
   - Because application sessions use Clerk and do not pass a Supabase JWT signed with the database project secret, PostgREST evaluates all database mutations as anonymous (`auth.uid() = NULL`).
   - If `005_harden_profile_insert_role.sql` is applied to the live database before SEC-02 is completed, direct PostgREST inserts by Clerk users will be blocked by `auth.uid() = id`.
   - **Remediation Path**: In SEC-02, either:
     - Configure the Clerk Dashboard Supabase JWT template and pass the Clerk token to `@supabase/ssr` / PostgREST, OR
     - Author a trusted server-side identity bridge using a secure service pattern.
2. **Live Database Trigger Application**:
   - `005_harden_profile_insert_role.sql` must be reviewed and executed via the Supabase Dashboard SQL Editor by the human database owner once SEC-02 identity mapping is resolved.
3. **Clerk Admin Initial Seeding**:
   - To grant `ADMIN` privileges to a new administrator via Clerk, their Clerk User ID (`user_...`) must be explicitly set in the database profile's `clerk_id` column.

---

## 9. Steps for Human Reviewer to Inspect the Patch

1. **Inspect Application Guards**:
   - Open [src/lib/auth.ts](file:///c:/Users/DAVE/Desktop/idiot/src/lib/auth.ts#L60-L80) and verify that `role = 'ADMIN'` requires `profile.clerk_id === clerkUser.id`.
   - Open [src/app/actions/authActions.ts](file:///c:/Users/DAVE/Desktop/idiot/src/app/actions/authActions.ts#L182-L300) and verify `updateCustomerProfileAction` (blocks role mutations) and `updateUserRoleAction` (requires `requireAdmin()`, prevents self-demotion).
2. **Inspect SQL Migration**:
   - Open [supabase/migrations/005_harden_profile_insert_role.sql](file:///c:/Users/DAVE/Desktop/idiot/supabase/migrations/005_harden_profile_insert_role.sql) and inspect the `protect_profile_role()` function:
     - Check `TG_OP = 'INSERT'` handling (fails closed when `v_actor_role IS NULL OR v_actor_role != 'ADMIN'`).
     - Check `TG_OP = 'UPDATE'` handling (fails closed).
     - Check `profiles_insert_own` and `profiles_update_own` RLS policies.
3. **Run Test Verification**:
   - Execute `npm test` in terminal and confirm 223/223 tests pass.
   - Execute `npx tsc --noEmit` and confirm zero errors.
   - Execute `npm run build` and confirm production build passes.
