---
name: idio-camera-rental
description: Implementation and architecture guide for the IDIO Digital Camera Rental Management System (Next.js App Router, Supabase PostgreSQL, Butuan City).
---

# IDIO Digital Camera Rental Engineering Guide

This Agent Skill serves as the persistent architectural, security, and implementation guide for AI coding agents working on the **IDIO Digital Camera Rental Management System**.

---

## 1. Project Identity & Context

- **Project Name**: IDIO
- **System**: Digital Camera Rental Management System
- **Context**: Academic Defense / Production-grade Local SaaS System
- **Operating Location**: **Butuan City, Agusan del Norte, Philippines**
- **Business Model**: Specialized local digital camera rentals with physical counter pickup, ID verification, equipment handover checklists, condition grading, return inspection, and security deposit settlements.

---

## 2. Strict Product Scope

IDIO is strictly dedicated to **DIGITAL CAMERA** rentals.

### Supported Camera Categories
1. **Mirrorless** (e.g., Sony Alpha 7 IV, Fujifilm X-T5, Canon EOS R6)
2. **Compact** (e.g., Ricoh GR IIIx, Sony ZV-1 II)
3. **DSLR** (e.g., Canon EOS 90D, Nikon D7500)
4. **Vlog & Creator** (e.g., Sony ZV-E10, Canon PowerShot V10)

### Hard Out-of-Scope Boundaries
Do **NOT** introduce, add, or infer:
- Heavy equipment or construction machinery
- Standalone independent lens rentals
- Tripods, lighting equipment, or studio rigs
- Microphones, audio recorders, or drones
- Film or analog cameras
- Cinema production gear
- Photography or videography freelance services
- Delivery logistics or nationwide courier shipping
- Generic unrelated rental products

---

## 3. User Roles & RBAC (Strictly TWO Roles)

IDIO has exactly **TWO ROLES**:

1. **`CUSTOMER`**
   - Browse digital camera catalog and view camera specifications.
   - Check real-time date availability.
   - Create pending rental reservations (`PENDING_APPROVAL`).
   - View their own bookings, vouchers, and rental history.
   - Cancel their own pending reservations.

2. **`ADMIN`**
   - Manage camera inventory, categories, specs, daily tariffs, and security deposit rates.
   - Verify customer identity and Butuan City barangay residence.
   - Review, approve, reject, and cancel booking requests.
   - Execute counter checkout and return inspection workflows.
   - Grade physical condition (`Excellent`, `Good`, `Fair`, `Damaged`).
   - Settle refundable security deposits (refund, damage deduction, forfeit).
   - Track maintenance tickets and restore cameras to availability.
   - View operational audit logs and academic defense ledger reports.

### Critical Rule: NO STAFF ROLE
- **There is NO STAFF role in IDIO.**
- Never introduce, restore, rename, or infer a `STAFF` role in database schemas, enums, backend logic, UI, or tests.
- All operational and administrative duties are performed by `ADMIN`.

---

## 4. Technology Stack

The repository uses the following verified technology stack:

- **Framework**: Next.js 16+ (App Router, Server Actions, Route Handlers, Turbopack)
- **Language**: TypeScript (strict type safety)
- **Database & Auth**: PostgreSQL 15+ hosted on Supabase (`@supabase/ssr` with secure cookie sessions)
- **Styling**: Tailwind CSS with custom styling tokens
- **Component System**: shadcn/ui (Radix primitives, Lucide React icons)
- **Testing**: Vitest with unit, schema invariant, and RBAC isolation tests

---

## 5. Architectural Principles & Code Organization

```text
src/
├── app/                  # Next.js App Router (pages, layouts, server actions)
│   ├── actions/          # Server Actions (authActions, cameraActions, reservationActions)
│   ├── admin/            # Admin dashboard and counter management routes
│   ├── login/            # Authentication login page
│   ├── register/         # Customer registration page
│   └── page.tsx          # Main public landing & customer catalog page
├── components/           # UI components (shadcn/ui based)
│   ├── admin/            # Admin management interfaces (FleetManager, ReservationMaster, etc.)
│   ├── common/           # Shared badges, dialogs, status indicators
│   └── customer/         # Customer catalog, booking modal, vouchers, profile
├── context/              # Client state providers (AuthContext, SystemContext)
├── data/                 # Seed data and Butuan City barangay constants
├── lib/                  # Server and domain logic modules
│   ├── auth.ts           # Server-side authentication and requireAdmin/requireCustomer guards
│   ├── availabilityEngine.ts # Date math and overlap availability helpers
│   ├── cameras/          # Camera service and server-side validation
│   ├── reservations/     # Reservation service and server-side validation
│   ├── supabase/         # Supabase client factories (server.ts, client.ts, middleware.ts)
│   └── utils.ts          # Formatting (formatPHP, formatDate, calculateRentalDays)
└── types/                # Domain and database TypeScript definitions
    ├── database.ts       # 1:1 relational schema types from Supabase
    └── index.ts          # Core application domain interfaces
```

---

## 6. Security & Server-Side Authorization Rules

1. **Zero Client Trust**:
   - Never trust client-supplied `role`, `user_id`, or `customer_id`.
   - Never trust client-supplied pricing, daily rates, deposits, or totals.
   - Never trust client-supplied availability calculations.
   - Always derive customer identity from the server-side Supabase session (`auth.uid()`).
2. **Strict Server-Side Mutation Guards**:
   - Every Admin mutation must enforce `await requireAdmin()`.
   - Non-admin callers receive an immediate `403 Forbidden` rejection.
3. **Supabase RLS & Credential Safety**:
   - Keep Row Level Security (RLS) enabled on all tables.
   - **DO NOT USE `SUPABASE_SERVICE_ROLE_KEY`**. Normal operations use the authenticated `@supabase/ssr` server client with RLS.
   - Never expose database credentials, secrets, or privileged service keys to browser bundles.
4. **No `localStorage` Source of Truth**:
   - `localStorage` must NEVER be used as the persistent authoritative store for cameras, reservations, rentals, users, or payments.
   - Database (`public.digital_cameras`, `public.reservations`, etc.) is the only authoritative source of truth.

---

## 7. Business Logic & Domain Invariants

### 1. Butuan City Location Scope
- Fixed province: `Agusan del Norte`
- Fixed city: `Butuan City`
- Curated barangays:
  `Libertad`, `San Vicente`, `Ambago`, `Baan Km. 3`, `Doongan`, `Ampayon`, `Villa Kananga`, `Holy Redeemer`, `Obrero`, `Taguibo`, `Golden Ribbon`, `Limaha`, `Agao`, `Agusan Pequeno`, `Bancasi`, `Bading`, `Buhangin`, `Bitan-agan`, `Tiniwisan`, `Imadejas`.

### 2. Camera Asset States
- **Statuses**: `AVAILABLE`, `RESERVED`, `CHECKED_OUT`, `MAINTENANCE`, `DAMAGED`.
- **Condition Grades**: `Excellent`, `Good`, `Fair`, `Damaged`.
- **Guardrails**:
  - `MAINTENANCE` and `DAMAGED` cameras cannot be reserved or checked out.
  - `CHECKED_OUT` units cannot be directly marked `AVAILABLE` without passing through return inspection.

### 3. Reservation & Concurrency Lifecycle
- **Statuses**: `PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `CANCELLED`.
- **Inclusive Date Range**: `rental_period DATERANGE GENERATED ALWAYS AS (daterange(start_date, end_date + 1, '[)')) STORED`.
- **GIST Exclusion Constraint**: PostgreSQL enforces `EXCLUDE USING gist (camera_id WITH =, rental_period WITH &&) WHERE (status IN ('PENDING_APPROVAL', 'APPROVED'))`.
- **Transitions**:
  - `PENDING_APPROVAL` → `APPROVED` | `REJECTED` | `CANCELLED`
  - `APPROVED` → `CANCELLED` (or checkout in rental phase)
  - `REJECTED` & `CANCELLED` are terminal states and release date availability.

### 4. Authoritative Pricing
- `total_days` = `calculateRentalDays(startDate, endDate)` (inclusive days).
- `daily_rate_snapshot` = `camera.daily_rate_php`.
- `subtotal_php` = `total_days * daily_rate_snapshot`.
- `security_deposit_php` = `camera.security_deposit_php`.
- `total_amount_php` = `subtotal_php + security_deposit_php`.

---

## 8. UI/UX & Design Guidelines

- **Design System**: shadcn/ui + Tailwind CSS with dark slate backgrounds (`slate-950`, `slate-900`), amber brand accents (`amber-500`, `amber-400`), emerald badges for availability, and cyan/rose accents for technical statuses.
- **Tone**: Clean, professional, trustworthy camera rental hub.
- **Simplicity**: Avoid excessive 3D animations, heavy glassmorphism, or cluttered dashboards.
- **Accessibility**: Use semantic HTML, responsive card/table layouts, clear labels, and descriptive modals.

---

## 9. Development & Verification Workflow

When executing any task on the IDIO repository:

1. **Review Rules**: Consult the root `SKILLS.md` (master specification) and this Agent Skill.
2. **Inspect First**: Inspect existing types, migrations, server actions, and components before writing code.
3. **Incremental Scope**: Implement only the requested phase/feature. Do NOT leap ahead to future phases (e.g., do not add checkout/returns during camera or reservation phases).
4. **Smallest Safe Diff**: Make focused, modular changes.
5. **Run Tests**: Execute `npm test` and verify that all test suites pass.
6. **Verify Build**: Execute `npm run build` to confirm TypeScript type safety and page generation.
7. **Transparent Reporting**:
   - Clearly distinguish between unit/mock test results, static SQL verification, build results, and live Supabase status.
   - Never fabricate live database test results when running on a local mock environment.
