/**
 * IDIO PostgreSQL / Supabase Database Types
 * Represents the 1:1 relational schema generated from supabase/migrations/001_initial_schema.sql
 * Roles: Strictly CUSTOMER and ADMIN (2 Roles)
 */

export type UserRole = 'CUSTOMER' | 'ADMIN';
export type CameraCategory = 'Mirrorless' | 'Compact' | 'DSLR' | 'Vlog & Creator';
export type CameraStatus = 'AVAILABLE' | 'RESERVED' | 'CHECKED_OUT' | 'MAINTENANCE' | 'DAMAGED';
export type CameraCondition = 'Excellent' | 'Good' | 'Fair' | 'Damaged';
export type ReservationStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type RentalStatus = 'CHECKED_OUT' | 'RETURNED' | 'COMPLETED';
export type PaymentMethod = 'GCASH' | 'CASH_PICKUP' | 'MAYA' | 'BANK_TRANSFER';
export type PaymentStatus = 'PENDING' | 'PAID' | 'REFUNDED';
export type DepositStatus = 'HELD' | 'REFUNDED' | 'DEDUCTED' | 'FORFEITED';
export type MaintenanceSeverity = 'Low' | 'Medium' | 'High' | 'Critical';
export type MaintenanceStatus = 'Under Service' | 'Parts Ordered' | 'Completed' | 'Decommissioned';

export interface ProfileRow {
  id: string; // UUID primary key
  clerk_id?: string | null; // Optional Clerk User ID (e.g. user_xxx)
  role: UserRole;
  full_name: string;
  email: string;
  phone: string;
  avatar_url: string | null;
  barangay: string;
  street_address: string;
  city: 'Butuan City';
  province: 'Agusan del Norte';
  id_type: string;
  id_number: string;
  created_at: string;
  updated_at: string;
}

export interface DigitalCameraRow {
  id: string; // e.g. 'CAM-001'
  serial_number: string;
  name: string;
  brand: string;
  model: string;
  category: CameraCategory;
  daily_rate_php: number;
  security_deposit_php: number;
  status: CameraStatus;
  condition: CameraCondition;
  specs: {
    sensor: string;
    megapixels: string;
    videoResolution: string;
    isoRange: string;
    lensMountOrKit: string;
    screen: string;
    connectivity: string;
    batteryLife: string;
    weight: string;
  };
  description: string;
  image_url: string;
  package_includes: string[];
  maintenance_notes: string | null;
  total_rentals_count: number;
  created_at: string;
  updated_at: string;
}

export interface ReservationRow {
  id: string; // UUID
  reference_no: string;
  customer_id: string;
  camera_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  rental_period?: string; // Generated daterange
  total_days: number;
  daily_rate_snapshot: number;
  subtotal_php: number;
  security_deposit_php: number;
  total_amount_php: number;
  purpose: string;
  status: ReservationStatus;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface RentalRow {
  id: string; // UUID
  reservation_id: string;
  camera_id: string;
  customer_id: string;
  checkout_admin_id: string;
  checkout_condition: CameraCondition;
  checkout_notes: string | null;
  checked_out_at: string;
  status: RentalStatus;
  return_admin_id: string | null;
  return_condition: CameraCondition | null;
  return_inspection_notes: string | null;
  returned_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentAndDepositRow {
  id: string;
  reservation_id: string;
  rental_amount_php: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  payment_reference: string | null;
  security_deposit_php: number;
  deposit_status: DepositStatus;
  deposit_deduction_php: number;
  deposit_deduction_reason: string | null;
  settled_by_admin_id: string | null;
  settled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MaintenanceTicketRow {
  id: string;
  camera_id: string;
  issue_type: string;
  severity: MaintenanceSeverity;
  description: string;
  cost_estimate_php: number;
  status: MaintenanceStatus;
  reported_by_admin_id: string;
  start_date: string;
  completion_date: string | null;
  technician_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActivityAuditLogRow {
  id: string;
  actor_id: string | null;
  actor_name: string;
  actor_role: UserRole;
  action: string;
  details: string;
  target_type: string;
  target_id: string;
  created_at: string;
}
