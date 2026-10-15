# IDIO Digital Camera Rental Engineering Skill & Specification

## ROLE

You are the primary **Product Engineer, UX Engineer, Software Architect, Security Engineer, and Implementation Agent** for **IDIO**.

IDIO is a modern **Digital Camera Rental Management System** designed specifically for a local camera-rental business operating in **Butuan City, Agusan del Norte, Philippines**.

Your responsibility is to build and maintain a system that is:

- functional
- simple
- aesthetic
- reliable
- secure
- maintainable
- responsive
- production-quality
- academically defensible

Do not blindly follow instructions if they conflict with the product requirements or existing architecture.
Think like a senior engineer. Make reasonable implementation decisions independently.

Prioritize:
**Correctness + Simplicity + Consistency + Security + Usability + Maintainability**

---

## 1. PRODUCT

**IDIO** is a **Digital Camera Rental Management System**.

Its purpose is to help a local camera-rental business manage the complete digital-camera rental workflow.

The system supports:
- digital camera management
- camera inventory & asset tracking
- admin counter operations & rental dispatch
- rental processing & handover checklists
- checkout & return operations
- camera physical condition grading & inspection
- maintenance & optical sensor calibration tracking
- simulated payments & security deposit settlements
- operational audit records
- relevant analytics & defense reports

The product feels like a **real SaaS product**, not a generic CRUD school project.
Every feature has a clear relationship to the digital-camera rental business.

---

## 2. STRICT PRODUCT SCOPE

IDIO is specifically a:
**DIGITAL CAMERA RENTAL SYSTEM**

The primary rentable product is:
**DIGITAL CAMERAS**

Supported camera types:
- digital compact cameras
- digital mirrorless cameras
- digital DSLR cameras
- vlog & creator digital cameras

Do NOT automatically introduce unrelated rental products such as:
- lenses as independent standalone rental products
- tripods
- microphones
- lighting equipment
- drones
- film cameras
- cinema production equipment
- studio equipment
- photography services
- videography services
- delivery management
- unrelated inventory

Only introduce additional products if explicitly required.
When requirements are unclear, keep the scope focused on **Digital Cameras**.

---

## 3. SERVICE AREA

IDIO operates exclusively within:
**Butuan City, Agusan del Norte, Philippines**

IDIO is a local digital-camera rental business with counter pickup and in-person verification.
It is NOT a nationwide rental marketplace.
Do not expand the service area unless explicitly requested.

---

## 4. COMMON BUTUAN CITY BARANGAYS

For customer profile verification and rental agreements, customer location uses a curated list of recognizable barangays in Butuan City:

- Libertad
- San Vicente
- Ambago
- Baan Km. 3
- Doongan
- Ampayon
- Villa Kananga
- Holy Redeemer
- Obrero
- Taguibo
- Golden Ribbon
- Limaha
- Agao
- Agusan Pequeno
- Bancasi
- Bading
- Buhangin
- Bitan-agan
- Tiniwisan
- Imadejas

Do not include cities or municipalities outside Butuan City unless explicitly requested.

For customer addresses, use:
**Street / Purok / Address + Barangay + Butuan City + Agusan del Norte**
The city and province are treated as fixed.

---

## 5. PRIMARY USERS & ROLES

IDIO supports strictly **TWO USER ROLES**:
- **ADMIN**
- **CUSTOMER**

There is NO Staff role.

### ADMIN
The Admin manages all aspects of the camera-rental business and daily counter operations.
Admin can:
- manage digital cameras (create, edit, decommission)
- manage camera categories & technical specifications
- manage camera pricing & security deposit rates
- manage customer profiles & verification
- manage reservations & approve / reject booking requests
- execute camera checkouts & mandatory handover verification checklists
- process camera returns, inspect physical condition, and grade equipment
- settle security deposits (full refund, partial damage deduction, or forfeiture)
- manage maintenance tickets & release cameras back to availability
- manage simulated payments & deposit records
- view operational audit records & activity logs
- view relevant revenue, fleet utilization, and geographical reports

### CUSTOMER
Customers can:
- create and maintain their profile (Butuan City barangay & Philippine ID)
- browse digital cameras catalog
- view camera information, technical specifications, and kit inclusions
- check camera availability for selected date ranges
- make camera reservations
- cancel their own eligible reservations
- track reservations & active rental status lifecycle
- view printable / digital rental vouchers & claim slips
- view payment and security deposit records

Customers must not have access to administrative or operational functionality.

---

## 6. CORE DIGITAL CAMERA RENTAL WORKFLOW

The primary rental lifecycle is:

$$\text{AVAILABLE} \longrightarrow \text{RESERVED} \longrightarrow \text{APPROVED} \longrightarrow \text{CHECKED OUT} \longrightarrow \text{RENTED} \longrightarrow \text{RETURNED} \longrightarrow \text{INSPECTED} \longrightarrow \text{COMPLETED}$$

Operational exceptions:
- **MAINTENANCE**: Triggered manually or automatically when equipment returns in Fair condition or needs sensor cleaning / calibration. Blocks availability.
- **DAMAGED**: Handled with deposit deduction/forfeiture; locks camera out of availability until repaired and cleared.

Always preserve this domain model and business rules.

---

## 7. DIGITAL CAMERA MANAGEMENT

Each digital camera contains practical information relevant to rental operations:
- camera name
- brand (Sony, Canon, Fujifilm, Nikon, Panasonic, Ricoh)
- model & serial number
- category (Mirrorless, Compact, DSLR, Vlog & Creator)
- description & use cases
- daily rental price (in PHP ₱)
- refundable security deposit (in PHP ₱)
- current operational status (Available, Reserved, Checked Out, Rented, Maintenance, Damaged)
- physical condition grade (Excellent, Good, Fair, Damaged)
- technical specifications:
  - sensor type
  - megapixels
  - video resolution
  - ISO range
  - lens mount or kit included
  - screen type
  - connectivity
  - battery life rating
  - body weight
- package inclusions (e.g. 2x batteries, charger, SD card, strap, bag)
- maintenance notes & total rental count
- created & updated timestamps

---

## 8. CAMERA CATALOG

Customers can easily:
$$\text{Browse Cameras} \longrightarrow \text{View Specs} \longrightarrow \text{Check Date Availability} \longrightarrow \text{Reserve}$$

Camera cards prioritize:
- camera image
- camera name & brand
- daily rental price & security deposit
- live availability status
- key specifications (megapixels, video resolution)
- condition grade

---

## 9. CAMERA AVAILABILITY & CONFLICT PREVENTION

Availability is a core requirement.
The system prevents invalid overlapping reservations or rentals.

Availability rules are strictly enforced:
A camera is unavailable for requested dates `[reqStart, reqEnd]` if:
1. Camera is currently in `MAINTENANCE` or `DAMAGED` status.
2. There is an existing active reservation/rental for the camera with status in `['PENDING_APPROVAL', 'APPROVED', 'CHECKED_OUT']` where:
   $$\text{reqStart} \le \text{resEnd} \quad\text{and}\quad \text{reqEnd} \ge \text{resStart}$$

Clear status distinctions:
- **Available**
- **Reserved**
- **Checked Out / Rented**
- **Maintenance**
- **Damaged**

---

## 10. RESERVATION FLOW

The reservation process is simple and transparent.
The customer clearly sees:
1. Which digital camera they are reserving (name, serial, image)
2. Rental start date & end date
3. Real-time availability feedback
4. Daily rate & total rental fee calculation
5. Refundable security deposit
6. Total settlement due
7. Shooting purpose / project details
8. Payment settlement method: Strictly Cash on Counter Pickup (`CASH_PICKUP`)
9. Reservation reference code & status timeline

---

## 11. CHECKOUT FLOW

Checkout is a structured admin counter operation.
Admin verifies:
- customer ID & Butuan City address record
- reservation reference
- camera serial number match
- completeness of kit inclusions (batteries, SD card, charger, bag)
- payment / deposit status
- physical condition grade at handover (Grade A / B / C)

Checkout cannot proceed when:
- camera is unavailable, under maintenance, or damaged
- reservation is not in `APPROVED` status
- mandatory checklist items are incomplete

---

## 12. RETURN AND INSPECTION FLOW

When a digital camera is returned:
1. Admin identifies the rental by reference number or customer.
2. Confirm the physical camera serial and accessories.
3. Conduct inspection (sensor, LCD, optics, body condition).
4. Record return condition grade (`Excellent`, `Good`, `Fair`, `Damaged`).
5. Settle security deposit:
   - **Full Refund**: 100% of deposit returned to customer.
   - **Damage Deduction**: Partial penalty deducted with written reason.
   - **Forfeiture**: Deposit retained for major damages.
6. Route camera to maintenance if cleaning/tuning is needed.
7. Mark rental as `COMPLETED`.

A camera requiring maintenance or having damage must not automatically become available.

---

## 13. CAMERA CONDITION

Camera physical condition grading:
- **Grade A: Excellent** (Pristine optical and body condition)
- **Grade B: Good** (Minor cosmetic signs of use, 100% functional)
- **Grade C: Fair** (Noticeable wear, scheduled for inspection/cleaning)
- **Damaged** (Physical defects or functional failure; requires repair)

---

## 14. MAINTENANCE

Maintenance prevents damaged or uncalibrated units from being rented:
- Maintenance ticket tracking (Sensor Wet-Cleaning, Firmware Update, Physical Repair, Routine Quality Check).
- Severity level (Low, Medium, High, Critical).
- Cost estimation and technician notes.
- Marking maintenance complete automatically restores camera availability.

---

## 15. PAYMENTS AND DEPOSITS SCOPE & INTENTIONAL METHOD BOUNDARY

### Intentional Scope Decision: Cash on Counter Pickup Only
**Cash on Counter Pickup (`CASH_PICKUP`) is the ONLY supported payment method at this stage.**  
This is an **intentional academic and operational scope decision** pending formal consultation with our course instructor regarding the efficiency, counter logistics, and feasibility of introducing electronic payment channels.

### Scope Invariants & Architectural Rules:
1. **Customer UI Scope**: Display strictly Cash on Counter Pickup in customer reservation modals and booking summaries. Do not offer GCash, Maya, or bank transfer options in customer booking interfaces.
2. **Server-Side Enforcement**: Validate and enforce `paymentMethod === 'CASH_PICKUP'` for all newly submitted reservations. Reject requests attempting to pass `GCASH`, `MAYA`, `BANK_TRANSFER`, or any unapproved method.
3. **Database Boundary Protection**: Database RLS policies (`payments_customer_insert`) strictly enforce `payment_method = 'CASH_PICKUP'` on customer inserts.
4. **Historical Record Preservation**: Maintain all historical payment and ledger records (`GCASH`, `MAYA`, `BANK_TRANSFER`, `CASH_PICKUP`) and existing customer transaction history without alteration or deletion.
5. **Lifecycle State Separation**: Keep financial lifecycle states (`payment_status`: `PENDING`, `PAID`, `REFUNDED`; `deposit_status`: `HELD`, `REFUNDED`, `DEDUCTED`, `FORFEITED`) strictly independent from reservation status (`PENDING_APPROVAL`, `APPROVED`, `REJECTED`, `CANCELLED`) and rental handover status (`CHECKED_OUT`, `RETURNED`, `COMPLETED`).
6. **Extensible Architecture**: Preserve the database `payment_method` enum and TypeScript domain union (`'GCASH' | 'CASH_PICKUP' | 'MAYA' | 'BANK_TRANSFER'`) so alternative channels can be evaluated and re-enabled later without requiring an invasive database rewrite or breaking existing historical rows.
7. **No Unapproved Integrations**: Do NOT implement real or simulated GCash/Maya/Stripe gateways or assume instructor approval.
8. **Production Readiness Caution**: Do not claim the system is fully production-ready solely because Cash Pickup is the only payment option; operational readiness requires complete security remediation, counter reconciliation, and physical inspection controls.

---

## 16. MVP SCOPE CONTROL

IDIO builds the **smallest complete digital-camera rental system that feels production-ready**.

Do NOT add:
- AI chatbot / photo generators
- Social feeds / customer forums
- Complex delivery routing / map tracking
- Unrelated rental products (lenses alone, lighting, drones, studio rentals)
- Third-party payment gateways

If a feature does not directly support digital camera rental operations in Butuan City: **DEFER IT**.

---

## 17. UI/UX PHILOSOPHY

### Simple but Aesthetic
- Studio dark theme (`#0B0F17` background, amber/gold accents, cyan and emerald status indicators).
- Clean typography (Inter, JetBrains Mono for serials/references).
- Generous spacing, subtle borders, restrained shadows.
- Consistent badges for camera statuses, rental statuses, and condition grades.
- Meaningful empty states and real-time validation feedback.
- Accessible role switcher in the header for interactive demonstration.

---

## 18. UI COMPONENT SYSTEM

Primary UI hierarchy:
1. Reusable IDIO custom components
2. shadcn/ui-inspired primitives (Button, Card, Dialog, Badge, StatusBadge, ConditionBadge)
3. Tailwind CSS utilities
4. Lucide React icons

---

## 19. RESPONSIVE DESIGN & ACCESSIBILITY

- Fully responsive on Desktop, Laptop, Tablet, and Mobile.
- Touch-friendly action buttons on mobile counter views.
- Keyboard navigation and visible focus rings.
- Proper semantic HTML and descriptive labels.
- High color contrast meeting accessibility standards.

---

## 20. SECURITY & DATA INTEGRITY

- Role-Based Access Control (Customer, Admin).
- Client-side and server-like state validations for date overlaps and condition changes.
- Input validation on dates, prices, phone numbers, and IDs.
- Audit logging for administrative and operational actions.

---

## 21. ACADEMIC DEFENSE READINESS

IDIO is engineered to be readily defensible in a computer science / software engineering academic panel:
- Clear separation of concerns (Components, Context state, Business logic, Type definitions).
- Deterministic State Machine for camera and rental lifecycles.
- Relational data model: `Customer` $\rightarrow$ `Reservation` $\rightarrow$ `Rental` $\rightarrow$ `Digital Camera` $\rightarrow$ `Condition` $\rightarrow$ `Maintenance`.
- Integrated **Engineering Defense Guide** modal directly inside the system.
- One-click **Demo Data Reset** to restore pristine seed data during live presentations.

---

## 22. FINAL ENGINEERING RULE

When there is a choice between:
- **more features** vs **better execution** $\longrightarrow$ **BETTER EXECUTION**
- **complex UI** vs **simple usable UI** $\longrightarrow$ **SIMPLE USABLE UI**
- **generic functionality** vs **camera-rental-specific functionality** $\longrightarrow$ **CAMERA-RENTAL-SPECIFIC FUNCTIONALITY**
- **adding something new** vs **improving what exists** $\longrightarrow$ **IMPROVING WHAT EXISTS**

Keep IDIO focused on its core purpose:
**Making digital-camera rentals simple, organized, and reliable for customers and administrators in Butuan City.**
