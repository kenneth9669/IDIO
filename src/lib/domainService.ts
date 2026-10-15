import {
  User,
  UserRole,
  DigitalCamera,
  Reservation,
  MaintenanceLog,
  ActivityLog,
  CameraStatus,
  CameraCondition,
  PaymentStatus,
  DepositStatus,
  RentalStatus,
  PaymentMethod
} from '../types';
import { BUTUAN_BARANGAYS } from '../data/seedData';
import { checkCameraAvailability } from './availabilityEngine';
import { generateReferenceCode, calculateRentalDays, getBufferEndDate } from './utils';
import { CURRENT_AGREEMENT_VERSION } from '../data/rentalAgreement';

export interface OperationResult<T = any> {
  success: boolean;
  message: string;
  data?: T;
}

// 1. RBAC & Ownership Guards
export function validateRole(actor: User, allowedRoles: UserRole[], actionName: string): OperationResult {
  if (!actor || !actor.role) {
    return { success: false, message: `Access Denied: Unauthenticated actor attempting ${actionName}.` };
  }
  if (!allowedRoles.includes(actor.role)) {
    return {
      success: false,
      message: `Access Denied: Role '${actor.role}' is not authorized to perform '${actionName}'. Required roles: ${allowedRoles.join(', ')}.`
    };
  }
  return { success: true, message: 'Authorized' };
}

export function validateOwnershipOrAdmin(actor: User, resourceOwnerId: string, actionName: string): OperationResult {
  if (actor.role === 'ADMIN') {
    return { success: true, message: 'Authorized (Elevated Role)' };
  }
  if (actor.id !== resourceOwnerId) {
    return {
      success: false,
      message: `Access Denied: You do not have permission to access or modify resource belonging to user '${resourceOwnerId}'.`
    };
  }
  return { success: true, message: 'Authorized (Owner)' };
}

// 2. State Transition Matrix
const VALID_TRANSITIONS: Record<RentalStatus, RentalStatus[]> = {
  PENDING_APPROVAL: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['CHECKED_OUT', 'CANCELLED', 'REJECTED'],
  CHECKED_OUT: ['COMPLETED'],
  RETURNED: ['COMPLETED'],
  COMPLETED: [], // Terminal
  REJECTED: [],  // Terminal
  CANCELLED: []  // Terminal
};

export function validateStateTransition(currentStatus: RentalStatus, targetStatus: RentalStatus): OperationResult {
  const allowed = VALID_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(targetStatus)) {
    return {
      success: false,
      message: `Invalid State Transition: Cannot transition rental from '${currentStatus}' to '${targetStatus}'. Allowed transitions: [${allowed.join(', ') || 'None (Terminal State)'}].`
    };
  }
  return { success: true, message: 'Valid transition' };
}

// 3. Domain Logic: Create Reservation
export function serviceCreateReservation(
  actor: User,
  data: {
    cameraId: string;
    startDate: string;
    endDate: string;
    purpose: string;
    paymentMethod: PaymentMethod;
    paymentReference?: string;
  },
  cameras: DigitalCamera[],
  reservations: Reservation[]
): OperationResult<Reservation> {
  // Guard: Customer identity
  if (!actor || !actor.id) {
    return { success: false, message: 'Customer profile required to create reservation.' };
  }

  // Guard: Barangay validation
  if (actor.barangay && !BUTUAN_BARANGAYS.includes(actor.barangay)) {
    return { success: false, message: `Barangay '${actor.barangay}' is outside the authorized Butuan City service area.` };
  }

  // Guard: Camera existence
  const camera = cameras.find(c => c.id === data.cameraId);
  if (!camera) {
    return { success: false, message: 'Selected digital camera does not exist in fleet inventory.' };
  }

  // Guard: Camera operational state
  if (camera.status === 'MAINTENANCE') {
    return { success: false, message: `Cannot reserve: Camera is currently under maintenance (${camera.maintenanceNotes || 'Service'}).` };
  }
  if (camera.status === 'DAMAGED' || camera.condition === 'Damaged') {
    return { success: false, message: 'Cannot reserve: Camera is marked as damaged.' };
  }

  // Guard: Date format & range
  if (!data.startDate || !data.endDate) {
    return { success: false, message: 'Start date and end date are both required.' };
  }

  const startMs = new Date(data.startDate).getTime();
  const endMs = new Date(data.endDate).getTime();
  if (isNaN(startMs) || isNaN(endMs)) {
    return { success: false, message: 'Invalid date format provided.' };
  }
  if (endMs < startMs) {
    return { success: false, message: 'Rental end date cannot precede start date.' };
  }

  // Guard: Overlap check
  const avail = checkCameraAvailability(camera, data.startDate, data.endDate, reservations);
  if (!avail.isAvailable) {
    return { success: false, message: avail.reason || 'Camera has a conflicting booking for the selected dates.' };
  }

  // Server-side calculation of tariffs
  const totalDays = calculateRentalDays(data.startDate, data.endDate);
  const subtotal = totalDays * camera.dailyRate;
  const securityDeposit = camera.securityDeposit;
  const totalAmount = subtotal + securityDeposit;

  const newId = `RES-${new Date().getFullYear()}-${String(reservations.length + 1).padStart(3, '0')}`;
  const referenceNo = generateReferenceCode('IDIO');

  const newReservation: Reservation = {
    id: newId,
    referenceNo,
    customerId: actor.id,
    customerName: actor.name,
    customerEmail: actor.email,
    customerPhone: actor.phone,
    customerBarangay: actor.barangay || 'Libertad',
    customerStreetAddress: actor.streetAddress || 'J.C. Aquino Ave',
    idType: actor.idType || 'Philippine National ID',
    idNumber: actor.idNumber || 'Verified-PH-ID',
    cameraId: camera.id,
    cameraName: camera.name,
    cameraBrand: camera.brand,
    cameraCategory: camera.category,
    cameraSerial: camera.serialNumber,
    cameraImageUrl: camera.imageUrl,
    startDate: data.startDate,
    endDate: data.endDate,
    totalDays,
    dailyRate: camera.dailyRate,
    subtotal,
    securityDeposit,
    totalAmount,
    purpose: data.purpose?.trim() || 'Personal / Creative Production in Butuan City',
    status: 'PENDING_APPROVAL',
    paymentStatus: data.paymentMethod === 'CASH_PICKUP' ? 'PENDING' : 'PAID',
    paymentMethod: data.paymentMethod,
    paymentReference: data.paymentReference?.trim() || undefined,
    depositStatus: 'HELD',
    bufferEndDate: getBufferEndDate(data.endDate),
    agreementVersion: (data as any).agreementVersion || CURRENT_AGREEMENT_VERSION,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  return {
    success: true,
    message: `Reservation ${referenceNo} created successfully.`,
    data: newReservation
  };
}

// 4. Domain Logic: Approve Reservation
export function serviceApproveReservation(
  actor: User,
  reservationId: string,
  reservations: Reservation[],
  cameras: DigitalCamera[]
): OperationResult<{ updatedReservation: Reservation }> {
  const roleCheck = validateRole(actor, ['ADMIN'], 'Approve Reservation');
  if (!roleCheck.success) return roleCheck;

  const res = reservations.find(r => r.id === reservationId);
  if (!res) return { success: false, message: `Reservation '${reservationId}' not found.` };

  const transitionCheck = validateStateTransition(res.status, 'APPROVED');
  if (!transitionCheck.success) return transitionCheck;

  const camera = cameras.find(c => c.id === res.cameraId);
  if (!camera) return { success: false, message: 'Associated camera asset record is missing.' };

  // Re-verify availability
  const avail = checkCameraAvailability(camera, res.startDate, res.endDate, reservations, res.id);
  if (!avail.isAvailable) {
    return { success: false, message: `Cannot approve: ${avail.reason}` };
  }

  const updated: Reservation = {
    ...res,
    status: 'APPROVED',
    updatedAt: new Date().toISOString()
  };

  return { success: true, message: `Reservation ${res.referenceNo} approved for pickup.`, data: { updatedReservation: updated } };
}

// 5. Domain Logic: Reject Reservation
export function serviceRejectReservation(
  actor: User,
  reservationId: string,
  reason: string,
  reservations: Reservation[]
): OperationResult<{ updatedReservation: Reservation }> {
  const roleCheck = validateRole(actor, ['ADMIN'], 'Reject Reservation');
  if (!roleCheck.success) return roleCheck;

  const res = reservations.find(r => r.id === reservationId);
  if (!res) return { success: false, message: `Reservation '${reservationId}' not found.` };

  const transitionCheck = validateStateTransition(res.status, 'REJECTED');
  if (!transitionCheck.success) return transitionCheck;

  const updated: Reservation = {
    ...res,
    status: 'REJECTED',
    rejectionReason: reason?.trim() || 'Declined by administration.',
    updatedAt: new Date().toISOString()
  };

  return { success: true, message: `Reservation ${res.referenceNo} rejected.`, data: { updatedReservation: updated } };
}

// 6. Domain Logic: Cancel Reservation
export function serviceCancelReservation(
  actor: User,
  reservationId: string,
  reservations: Reservation[]
): OperationResult<{ updatedReservation: Reservation }> {
  const res = reservations.find(r => r.id === reservationId);
  if (!res) return { success: false, message: `Reservation '${reservationId}' not found.` };

  const ownerCheck = validateOwnershipOrAdmin(actor, res.customerId, 'Cancel Reservation');
  if (!ownerCheck.success) return ownerCheck;

  const transitionCheck = validateStateTransition(res.status, 'CANCELLED');
  if (!transitionCheck.success) return transitionCheck;

  const updated: Reservation = {
    ...res,
    status: 'CANCELLED',
    updatedAt: new Date().toISOString()
  };

  return { success: true, message: `Reservation ${res.referenceNo} cancelled.`, data: { updatedReservation: updated } };
}

// 7. Domain Logic: Checkout Rental
export function serviceCheckoutRental(
  actor: User,
  reservationId: string,
  handoverCondition: CameraCondition,
  checkoutNotes: string | undefined,
  reservations: Reservation[],
  cameras: DigitalCamera[]
): OperationResult<{ updatedReservation: Reservation; updatedCamera: DigitalCamera }> {
  const roleCheck = validateRole(actor, ['ADMIN'], 'Execute Checkout');
  if (!roleCheck.success) return roleCheck;

  const res = reservations.find(r => r.id === reservationId);
  if (!res) return { success: false, message: `Reservation '${reservationId}' not found.` };

  const transitionCheck = validateStateTransition(res.status, 'CHECKED_OUT');
  if (!transitionCheck.success) return transitionCheck;

  const camera = cameras.find(c => c.id === res.cameraId);
  if (!camera) return { success: false, message: 'Camera record missing.' };

  if (camera.status === 'MAINTENANCE' || camera.status === 'DAMAGED') {
    return { success: false, message: `Cannot checkout: Camera is marked as ${camera.status}.` };
  }

  const timestamp = new Date().toISOString();

  const updatedReservation: Reservation = {
    ...res,
    status: 'CHECKED_OUT',
    checkoutCondition: handoverCondition,
    checkoutNotes: checkoutNotes || 'Physical checklist and serial number verified.',
    checkoutTimestamp: timestamp,
    checkoutAdminName: actor.name,
    updatedAt: timestamp
  };

  const updatedCamera: DigitalCamera = {
    ...camera,
    status: 'CHECKED_OUT',
    condition: handoverCondition,
    totalRentalsCount: camera.totalRentalsCount + 1,
    updatedAt: timestamp
  };

  return {
    success: true,
    message: `Rental ${res.referenceNo} checked out successfully.`,
    data: { updatedReservation, updatedCamera }
  };
}

// 8. Domain Logic: Return Inspection & Deposit Settlement
export function serviceReturnInspectionRental(
  actor: User,
  reservationId: string,
  returnCondition: CameraCondition,
  notes: string,
  depositAction: 'REFUND_FULL' | 'DEDUCT_DAMAGE' | 'FORFEIT',
  deductionAmount: number = 0,
  deductionReason: string = '',
  flagMaintenance: boolean = false,
  reservations: Reservation[],
  cameras: DigitalCamera[]
): OperationResult<{
  updatedReservation: Reservation;
  updatedCamera: DigitalCamera;
  newMaintenanceLog?: MaintenanceLog;
}> {
  const roleCheck = validateRole(actor, ['ADMIN'], 'Return Inspection');
  if (!roleCheck.success) return roleCheck;

  const res = reservations.find(r => r.id === reservationId);
  if (!res) return { success: false, message: `Rental record '${reservationId}' not found.` };

  const transitionCheck = validateStateTransition(res.status, 'COMPLETED');
  if (!transitionCheck.success) return transitionCheck;

  const camera = cameras.find(c => c.id === res.cameraId);
  if (!camera) return { success: false, message: 'Camera record missing.' };

  // Deposit settlement validation
  let depositStatus: DepositStatus = 'REFUNDED';
  let settledDeduction = 0;

  if (depositAction === 'DEDUCT_DAMAGE') {
    if (deductionAmount <= 0) {
      return { success: false, message: 'Deduction amount must be greater than 0.' };
    }
    if (deductionAmount > res.securityDeposit) {
      return { success: false, message: `Deduction (₱${deductionAmount}) cannot exceed security deposit (₱${res.securityDeposit}).` };
    }
    if (!deductionReason.trim()) {
      return { success: false, message: 'Specific reason for damage deduction is mandatory.' };
    }
    depositStatus = 'DEDUCTED';
    settledDeduction = deductionAmount;
  } else if (depositAction === 'FORFEIT') {
    depositStatus = 'FORFEITED';
    settledDeduction = res.securityDeposit;
  }

  // Rule: Camera availability post-inspection
  // Damaged or Maintenance-flagged equipment MUST NOT become AVAILABLE
  let resultingCamStatus: CameraStatus = 'AVAILABLE';
  if (returnCondition === 'Damaged') {
    resultingCamStatus = 'DAMAGED';
  } else if (flagMaintenance || returnCondition === 'Fair') {
    resultingCamStatus = 'MAINTENANCE';
  }

  const timestamp = new Date().toISOString();

  const updatedReservation: Reservation = {
    ...res,
    status: 'COMPLETED',
    returnCondition,
    returnNotes: notes?.trim() || 'Returned and inspected.',
    returnTimestamp: timestamp,
    returnAdminName: actor.name,
    depositStatus,
    depositDeduction: settledDeduction,
    depositNotes: deductionReason?.trim() || undefined,
    updatedAt: timestamp
  };

  const updatedCamera: DigitalCamera = {
    ...camera,
    status: resultingCamStatus,
    condition: returnCondition,
    maintenanceNotes:
      resultingCamStatus !== 'AVAILABLE'
        ? `Return inspection on ${timestamp.slice(0, 10)}: ${notes || returnCondition}`
        : undefined,
    updatedAt: timestamp
  };

  let newMaintenanceLog: MaintenanceLog | undefined;
  if (flagMaintenance || returnCondition === 'Damaged' || returnCondition === 'Fair') {
    newMaintenanceLog = {
      id: `MNT-${Date.now().toString().slice(-4)}`,
      cameraId: camera.id,
      cameraName: camera.name,
      cameraSerial: camera.serialNumber,
      issueType: returnCondition === 'Damaged' ? 'Post-Rental Damage' : 'Routine Quality Check',
      severity: returnCondition === 'Damaged' ? 'High' : 'Medium',
      description: `Flagged during return inspection: ${notes || 'Inspection check'}`,
      costEstimate: settledDeduction > 0 ? settledDeduction : 450,
      status: 'Under Service',
      reportedBy: actor.name,
      startDate: timestamp.slice(0, 10),
      notes: deductionReason || undefined
    };
  }

  return {
    success: true,
    message: `Return inspection completed for ${res.referenceNo}. Camera status is now '${resultingCamStatus}'.`,
    data: {
      updatedReservation,
      updatedCamera,
      newMaintenanceLog
    }
  };
}

// 9. Domain Logic: Admin Fleet Operations
export function serviceAddCamera(
  actor: User,
  data: Omit<DigitalCamera, 'id' | 'createdAt' | 'updatedAt' | 'totalRentalsCount'>,
  existingCameras: DigitalCamera[]
): OperationResult<DigitalCamera> {
  const roleCheck = validateRole(actor, ['ADMIN'], 'Add Camera to Fleet');
  if (!roleCheck.success) return roleCheck;

  if (!data.name || !data.serialNumber || !data.brand) {
    return { success: false, message: 'Camera name, serial number, and brand are mandatory.' };
  }

  if (data.dailyRate <= 0) {
    return { success: false, message: 'Daily rental rate must be greater than ₱0.' };
  }

  if (data.securityDeposit <= 0) {
    return { success: false, message: 'Security deposit must be greater than ₱0.' };
  }

  // Serial uniqueness
  const duplicate = existingCameras.find(c => c.serialNumber.toLowerCase() === data.serialNumber.toLowerCase());
  if (duplicate) {
    return { success: false, message: `Serial number '${data.serialNumber}' is already registered to ${duplicate.name}.` };
  }

  const id = `CAM-${String(existingCameras.length + 1).padStart(3, '0')}`;
  const newCamera: DigitalCamera = {
    ...data,
    id,
    totalRentalsCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  return { success: true, message: `Added ${newCamera.name} (${newCamera.serialNumber}) to fleet.`, data: newCamera };
}

export function serviceDeleteCamera(
  actor: User,
  cameraId: string,
  cameras: DigitalCamera[],
  reservations: Reservation[]
): OperationResult {
  const roleCheck = validateRole(actor, ['ADMIN'], 'Delete Camera');
  if (!roleCheck.success) return roleCheck;

  const cam = cameras.find(c => c.id === cameraId);
  if (!cam) return { success: false, message: `Camera '${cameraId}' not found.` };

  // Rule: Cannot delete camera with active rental
  const hasActiveRental = reservations.some(
    r => r.cameraId === cameraId && (r.status === 'CHECKED_OUT' || r.status === 'APPROVED')
  );
  if (hasActiveRental) {
    return { success: false, message: `Cannot delete camera '${cam.name}': It has an active or approved rental in progress.` };
  }

  return { success: true, message: `Camera ${cam.name} deleted.` };
}
