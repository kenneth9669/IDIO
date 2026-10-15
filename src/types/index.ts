export type UserRole = 'ADMIN' | 'CUSTOMER';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  avatarUrl?: string;
  barangay: string;
  streetAddress: string;
  city: string; // Fixed to 'Butuan City'
  province: string; // Fixed to 'Agusan del Norte'
  idType: string;
  idNumber: string;
}

export type CameraCategory = 'Mirrorless' | 'Compact' | 'DSLR' | 'Vlog & Creator';

export type CameraStatus = 
  | 'AVAILABLE' 
  | 'RESERVED' 
  | 'CHECKED_OUT' 
  | 'MAINTENANCE' 
  | 'DAMAGED';

export type CameraCondition = 'Excellent' | 'Good' | 'Fair' | 'Damaged';

export interface CameraSpecs {
  sensor: string;
  megapixels: string;
  videoResolution: string;
  isoRange: string;
  lensMountOrKit: string;
  screen: string;
  connectivity: string;
  batteryLife: string;
  weight: string;
}

export interface DigitalCamera {
  id: string;
  serialNumber: string;
  name: string;
  brand: 'Sony' | 'Canon' | 'Fujifilm' | 'Nikon' | 'Panasonic' | 'Ricoh';
  model: string;
  category: CameraCategory;
  dailyRate: number; // in PHP ₱
  securityDeposit: number; // in PHP ₱
  status: CameraStatus;
  condition: CameraCondition;
  specs: CameraSpecs;
  description: string;
  imageUrl: string;
  packageIncludes: string[];
  maintenanceNotes?: string;
  totalRentalsCount: number;
  createdAt: string;
  updatedAt: string;
}

export type RentalStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'CHECKED_OUT'
  | 'RETURNED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REJECTED';

export type PaymentStatus = 'PENDING' | 'PAID' | 'REFUNDED';
export type PaymentMethod = 'GCASH' | 'CASH_PICKUP' | 'MAYA' | 'BANK_TRANSFER';
export type DepositStatus = 'HELD' | 'REFUNDED' | 'DEDUCTED' | 'FORFEITED';

export interface Reservation {
  id: string;
  referenceNo: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerBarangay: string;
  customerStreetAddress: string;
  idType: string;
  idNumber: string;
  cameraId: string;
  cameraName: string;
  cameraBrand: string;
  cameraCategory: CameraCategory;
  cameraSerial: string;
  cameraImageUrl: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  totalDays: number;
  dailyRate: number;
  subtotal: number;
  securityDeposit: number;
  totalAmount: number;
  purpose: string;
  status: RentalStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  paymentReference?: string;
  depositStatus: DepositStatus;
  depositDeduction?: number;
  depositNotes?: string;
  rejectionReason?: string;
  checkoutCondition?: CameraCondition;
  checkoutNotes?: string;
  checkoutTimestamp?: string;
  checkoutAdminName?: string;
  returnCondition?: CameraCondition;
  returnNotes?: string;
  returnTimestamp?: string;
  returnAdminName?: string;
  bufferEndDate?: string; // YYYY-MM-DD (2 calendar days after agreed return date)
  agreementVersion?: string;
  agreementAcceptance?: RentalAgreementAcceptance;
  createdAt: string;
  updatedAt: string;
}

export interface RentalAgreementAcceptance {
  id: string;
  reservationId: string;
  customerId: string;
  agreementId: string;
  version: string;
  agreementVersion?: string; // convenient alias
  agreementTitle: string;
  agreementTextSnapshot: string;
  agreementHash: string;
  acceptedAt: string;
  customerName?: string;
  customerEmail?: string;
}


export interface MaintenanceLog {
  id: string;
  cameraId: string;
  cameraName: string;
  cameraSerial: string;
  issueType: 'Sensor Cleaning' | 'Firmware Update' | 'Physical Repair' | 'Button / Dial Inspection' | 'Routine Quality Check' | 'Post-Rental Damage';
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  description: string;
  costEstimate?: number;
  status: 'Under Service' | 'Parts Ordered' | 'Completed' | 'Decommissioned';
  reportedBy: string;
  startDate: string;
  completionDate?: string;
  notes?: string;
}

export interface Rental {
  id: string; // UUID
  reservationId: string;
  referenceNo?: string;
  cameraId: string;
  cameraName?: string;
  cameraBrand?: string;
  cameraSerial?: string;
  cameraImageUrl?: string;
  customerId: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerBarangay?: string;
  idType?: string;
  idNumber?: string;
  checkoutAdminId: string;
  checkoutAdminName?: string;
  checkoutCondition: CameraCondition;
  checkoutNotes?: string;
  checkedOutAt: string;
  status: 'CHECKED_OUT' | 'RETURNED' | 'COMPLETED';
  returnAdminId?: string;
  returnAdminName?: string;
  returnCondition?: CameraCondition;
  returnInspectionNotes?: string;
  returnedAt?: string;
  completedAt?: string;
  // Reservation snapshots
  startDate?: string;
  endDate?: string;
  totalDays?: number;
  dailyRate?: number;
  subtotal?: number;
  securityDeposit?: number;
  totalAmount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentAndDeposit {
  id: string; // UUID
  reservationId: string;
  referenceNo?: string;
  customerId?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  cameraName?: string;
  cameraSerial?: string;
  rentalAmount: number; // in PHP ₱
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentReference?: string;
  securityDeposit: number; // in PHP ₱
  depositStatus: DepositStatus;
  depositDeduction?: number; // in PHP ₱
  depositDeductionReason?: string;
  settledByAdminId?: string;
  settledByAdminName?: string;
  settledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  details: string;
  targetType: 'CAMERA' | 'RESERVATION' | 'MAINTENANCE' | 'PROFILE';
  targetId: string;
}


