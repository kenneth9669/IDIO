# IDIO — SEC-02 Security Remediation Report: Clerk–Supabase Identity Mapping

**System**: IDIO Digital Camera Rental Management System  
**Repository**: `kenneth9669/IDIO`  
**Location**: Butuan City, Agusan del Norte, Philippines  
**Target Vulnerability**: **SEC-02: Clerk-to-Supabase Identity Mapping & PostgreSQL Token Bridge**  
**Security Status**: **Partially Fixed (Application Bridge, UUID Mapping, & Server Token Forwarding Implemented; Migration 006 Authored; Live Migration Held Pending External Clerk JWT Template Setup)**  
**Date**: October 12, 2026  
**Auditor & Remediation Engineer**: Senior Full-Stack & Supabase/PostgreSQL Security Engineer  

---

## 1. Root Cause and Verified Code Findings

Direct investigation of the database migrations, `@supabase/ssr` server factories, and Clerk authentication layer established the following verified architectural facts:

1. **UUID Constraint vs. Clerk String Format (PostgreSQL `22P02`)**:
   - In [001_initial_schema.sql](file:///c:/Users/DAVE/Desktop/idiot/supabase/migrations/001_initial_schema.sql#L60), `public.profiles.id` is typed as `UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`.
   - Clerk user IDs are alphanumeric string identifiers (e.g. `user_2bF89xKL34...`), which violate PostgreSQL UUID syntax.
   - Calling Supabase's native `auth.uid()` evaluates `current_setting('request.jwt.claim.sub', true)::uuid`, which throws runtime database error `22P02: invalid input syntax for type uuid: "user_2bF89xKL34..."`.
   - Relational tables (`reservations.customer_id`, `rentals.customer_id`, `payments_and_deposits.settled_by_admin_id`) store UUID foreign keys referencing `public.profiles(id)`.

2. **Foreign Key Coupling to Supabase Auth (`profiles_id_fkey`)**:
   - `profiles_id_fkey` enforced that every profile `id` must exist in Supabase's private `auth.users` table.
   - Because users authenticate through Clerk, they do not have rows in `auth.users`. Attempting to insert a profile for a Clerk user with a generated UUID failed with `23503: foreign key violation`.

3. **Anonymous PostgREST Requests Under Clerk**:
   - [src/lib/supabase/server.ts](file:///c:/Users/DAVE/Desktop/idiot/src/lib/supabase/server.ts) previously only read incoming HTTP cookies.
   - Because Clerk stores sessions in Clerk-specific cookies (`__session`) rather than Supabase cookies, PostgREST received no Supabase session token.
   - Consequently, all database queries executed as PostgreSQL role `anon`, where `auth.uid()` evaluated to `NULL` and `public.get_auth_role()` evaluated to `NULL`.

4. **In-Memory ID Fallback Discrepancy**:
   - In [src/lib/auth.ts](file:///c:/Users/DAVE/Desktop/idiot/src/lib/auth.ts), `resolvedProfile` fell back to `id: clerkUser.id` when a database profile had not yet been fetched. Passing this raw string into relational mutations (such as `createReservation`) caused downstream UUID type errors.

---

## 2. Selected Architecture and Why It Is Supported

### The Hybrid Token Bridge & Persistent UUID Architecture
We selected the official, supported Clerk–Supabase integration architecture with a schema-preserving UUID bridge:

1. **Clerk Issues Supabase-Compatible JWTs**:
   - Clerk signs tokens containing standard Supabase claims:
     - `aud`: `'authenticated'`
     - `role`: `'authenticated'`
     - `sub`: `'user_...'` (the verified Clerk User ID)
     - `email`: user's verified primary email.
2. **PostgreSQL Schema Preservation**:
   - `public.profiles.id` **remains a UUID** (`DEFAULT gen_random_uuid()`).
   - All relational tables (`reservations`, `rentals`, `payments_and_deposits`) preserve their existing UUID foreign keys. No existing business records or relationships are broken.
   - `public.profiles.clerk_id VARCHAR(255) UNIQUE` acts as the verified external identity anchor.
3. **Safe SQL Helpers**:
   - `public.current_clerk_id()`: Safely reads `request.jwt.claim.sub` as `text` without crashing on non-UUID strings. Fails closed to `NULL`.
   - `public.current_profile_id()`: A `SECURITY DEFINER` function that maps `current_clerk_id()` to the user's persistent `UUID` in `public.profiles`. Also maintains fallback to native Supabase `auth.uid()` for dual-auth compatibility.
   - `public.get_auth_role()`: Resolves the user's role from `public.profiles` using `current_profile_id()`.

---

## 3. Identity Mapping and JWT Verification Flow

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Customer (Browser)
    participant Server as Next.js Server (App Router)
    participant Clerk as Clerk Auth Service
    participant Supabase as Supabase PostgREST (PostgreSQL)

    Customer->>Server: Request action (e.g. createReservation)
    Server->>Clerk: auth() & getToken({ template: 'supabase' })
    Clerk-->>Server: Return cryptographically verified JWT (sub: user_2...)
    Server->>Supabase: Query with Authorization: Bearer <clerk_jwt>
    Note over Supabase: PostgREST verifies signature & sets:<br/>request.jwt.claim.sub = 'user_2...'<br/>request.jwt.claim.role = 'authenticated'
    Note over Supabase: public.current_clerk_id() -> 'user_2...'<br/>public.current_profile_id() -> <profile_uuid><br/>public.get_auth_role() -> 'CUSTOMER'
    Supabase-->>Server: Return authorized data (RLS enforced)
    Server-->>Customer: Render response / Action result
```

1. **Token Retrieval**: In [src/lib/supabase/server.ts](file:///c:/Users/DAVE/Desktop/idiot/src/lib/supabase/server.ts), `createClient()` calls `auth().getToken({ template: 'supabase' })`.
2. **Bearer Token Attachment**: If a Clerk JWT is returned, it is attached as `Authorization: Bearer ${clerkToken}` in the `global.headers` of `@supabase/ssr`.
3. **PostgREST Verification**: PostgREST verifies the token signature against the project secret (or Clerk JWKS).
4. **Database Resolution**:
   - In PostgreSQL, RLS policies call `public.current_profile_id()` and `public.get_auth_role()`.
   - The user's internal `UUID` is resolved and checked against `customer_id`.
   - The user cannot view or mutate another customer's records.

---

## 4. Files Changed and Their Purpose

| File | Changes Made | Security / Architectural Purpose |
|---|---|---|
| [src/lib/supabase/server.ts](file:///c:/Users/DAVE/Desktop/idiot/src/lib/supabase/server.ts) | Added Clerk token retrieval via `auth().getToken({ template: 'supabase' })` and attached `Authorization: Bearer <token>` to global headers. | Forwards verified Clerk identity to PostgREST so database requests carry authenticated identity instead of executing anonymously. |
| [src/lib/clerkSync.ts](file:///c:/Users/DAVE/Desktop/idiot/src/lib/clerkSync.ts) | 1. Generates `id: crypto.randomUUID()` on profile insert.<br>2. Added and exported `deriveDeterministicUuid(clerkId)`.<br>3. Returns valid in-memory profile with deterministic UUID if database insert fails. | Guarantees that profile primary keys are always valid UUID syntax, preventing PostgreSQL `22P02` syntax crashes. |
| [src/lib/auth.ts](file:///c:/Users/DAVE/Desktop/idiot/src/lib/auth.ts) | 1. Automatically invokes `syncCurrentClerkUser()` when no database profile exists.<br>2. Replaced raw string fallback `id: clerkUser.id` with `deriveDeterministicUuid(clerkUser.id)`.<br>3. Preserves SEC-01 fail-closed role protection. | Ensures every authenticated session context carries a valid UUID and enforces server-side role derivation. |
| [supabase/migrations/006_clerk_supabase_identity_bridge.sql](file:///c:/Users/DAVE/Desktop/idiot/supabase/migrations/006_clerk_supabase_identity_bridge.sql) | 1. Drops dead foreign key `profiles_id_fkey`.<br>2. Sets default `gen_random_uuid()` on `profiles.id`.<br>3. Adds unique index on `clerk_id`.<br>4. Authors `current_clerk_id()`, `current_profile_id()`, and upgraded `get_auth_role()`.<br>5. Updates RLS policies on `profiles`. | Establishes the database-layer identity bridge between Clerk string IDs and PostgreSQL relational tables under RLS. |
| [src/__tests__/clerkSupabaseIdentity.test.ts](file:///c:/Users/DAVE/Desktop/idiot/src/__tests__/clerkSupabaseIdentity.test.ts) | Authored 12 new unit and workflow tests for SEC-02 identity mapping, deterministic UUID derivation, token forwarding, ownership isolation, and profile synchronization. | Verifies all SEC-02 requirements and fail-closed behaviors under automated testing. |

---

## 5. Required Environment and Dashboard Configuration

To activate live database token verification, the following manual setup must be performed in the respective administrative dashboards:

### 1. Clerk Dashboard (`https://dashboard.clerk.com`)
1. Navigate to **Configure** -> **JWT Templates**.
2. Click **New template** -> Select **Supabase**.
3. Name: `supabase`.
4. Claims:
   ```json
   {
     "aud": "authenticated",
     "role": "authenticated",
     "email": "{{user.primary_email_address}}",
     "sub": "{{user.id}}"
   }
   ```
5. Signing Key: Enter the Supabase project JWT Secret (obtained from Supabase Dashboard -> Settings -> API -> JWT Secret).
6. Lifetime: 60 seconds (recommended default for short-lived session tokens).

### 2. Supabase Dashboard (`https://supabase.com/dashboard`)
1. In the SQL Editor, review and execute migration [006_clerk_supabase_identity_bridge.sql](file:///c:/Users/DAVE/Desktop/idiot/supabase/migrations/006_clerk_supabase_identity_bridge.sql) after human review.
2. Ensure `idx_profiles_clerk_id` index is created.
3. For existing admin users, verify that `public.profiles.clerk_id` is populated with their Clerk User ID.

---

## 6. Migration Dependencies & Compatibility with Migration 005

- **Compatibility with Migration 005**:
  - In [005_harden_profile_insert_role.sql](file:///c:/Users/DAVE/Desktop/idiot/supabase/migrations/005_harden_profile_insert_role.sql), the trigger function `protect_profile_role()` calls `public.get_auth_role()`.
  - Migration 006 upgrades `public.get_auth_role()` to resolve the role through `public.current_profile_id()`.
  - Therefore, when migration 006 is applied, migration 005's role protection triggers evaluate correctly for both Clerk JWT sessions and native Supabase sessions.
  - Migration 005 and Migration 006 are 100% mutually compatible.

---

## 7. Tests Run and Actual Outcomes

### A. Vitest Test Suite (`npm test`)
- **Command**: `npm test`
- **Result**: **PASS (All 12 test suites passed, 235/235 tests passed)**
- **Duration**: 8.97s
- **Evidence**:
  ```text
  ✓ src/__tests__/integrationHardening.test.ts (11 tests)
  ✓ src/__tests__/adminConsoleEnhancement.test.ts (15 tests)
  ✓ src/__tests__/domain.test.ts (18 tests)
  ✓ src/__tests__/authRbac.test.ts (22 tests)
  ✓ src/__tests__/clerkSupabaseIdentity.test.ts (12 tests) [NEW SEC-02 SUITE]
  ✓ src/__tests__/customerPortalEnhancement.test.ts (20 tests)
  ✓ src/__tests__/schemaInvariants.test.ts (7 tests)
  ✓ src/__tests__/cameraManagement.test.ts (17 tests)
  ✓ src/__tests__/rentalLifecycle.test.ts (28 tests)
  ✓ src/__tests__/paymentDeposit.test.ts (29 tests)
  ✓ src/__tests__/reservationManagement.test.ts (32 tests)
  ✓ src/__tests__/availabilityCalendar.test.ts (24 tests)
  ```

### B. TypeScript Compilation (`npx tsc --noEmit`)
- **Command**: `npx tsc --noEmit`
- **Result**: **PASS (0 errors)**

### C. Next.js Production Build (`npm run build`)
- **Command**: `npm run build`
- **Result**: **PASS (Next.js 16.4.0 Turbopack build optimized all 7 static/dynamic routes in 11.7s)**

### D. Code Linter (`npx oxlint`)
- **Command**: `npx oxlint`
- **Result**: **PASS (0 errors across 93 files)**

> [!NOTE]
> **Testing Boundary Notice**: Automated tests verify the application bridge, token header forwarding, deterministic UUID derivation, and ownership authorization. Database PL/pgSQL functions and RLS policies have been statically verified; live PostgreSQL RLS enforcement will take effect once Migration 006 is executed on the database instance.

---

## 8. Remaining Security Risks

1. **External Clerk JWT Template Dependency**:
   - Until the human administrator configures the `supabase` JWT template in the Clerk Dashboard with the Supabase JWT secret, `getToken({ template: 'supabase' })` returns `null`. During this interim period, database requests fall back to server-side RBAC validation.
2. **Live Database Migration Pending Review**:
   - Migration [006_clerk_supabase_identity_bridge.sql](file:///c:/Users/DAVE/Desktop/idiot/supabase/migrations/006_clerk_supabase_identity_bridge.sql) has not been applied to the live database, as mandated by the implementation boundaries.

---

## 9. Exact Next Steps Before Live Migration

1. **Review Patch & Migration 006**: Inspect `src/lib/supabase/server.ts`, `src/lib/clerkSync.ts`, `src/lib/auth.ts`, and `supabase/migrations/006_clerk_supabase_identity_bridge.sql`.
2. **Configure Clerk JWT Template**: In Clerk Dashboard, configure the `supabase` template using the Supabase project JWT secret.
3. **Execute Migration 006**: In Supabase SQL Editor, execute Migration 006 (and pending Migration 005).
4. **Proceed to Phase 3 (SEC-03: Reservation Cancellation Policy Hardening)**.
