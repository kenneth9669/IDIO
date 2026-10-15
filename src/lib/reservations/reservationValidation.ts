import { PaymentMethod, ReservationStatus } from '../../types/database';
import { CURRENT_AGREEMENT_VERSION } from '../../data/rentalAgreement';

export const VALID_PAYMENT_METHODS: PaymentMethod[] = ['CASH_PICKUP', 'GCASH', 'MAYA', 'BANK_TRANSFER'];
export const ALLOWED_NEW_PAYMENT_METHODS: PaymentMethod[] = ['CASH_PICKUP'];
export const VALID_RESERVATION_STATUSES: ReservationStatus[] = ['PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED'];

export interface CreateReservationInput {
  cameraId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  purpose: string;
  paymentMethod: PaymentMethod;
  paymentReference?: string;
  agreementAccepted: boolean;
  agreementVersion: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}


/**
 * Validates reservation creation parameters on the server side.
 */
export function validateReservationInput(input: Partial<CreateReservationInput>): ValidationResult {
  const errors: string[] = [];

  // Camera ID
  if (!input.cameraId || typeof input.cameraId !== 'string' || !input.cameraId.trim()) {
    errors.push('Camera ID is required.');
  }

  // Dates
  if (!input.startDate || typeof input.startDate !== 'string' || !input.startDate.trim()) {
    errors.push('Rental start date is required.');
  }

  if (!input.endDate || typeof input.endDate !== 'string' || !input.endDate.trim()) {
    errors.push('Rental end date is required.');
  }

  if (input.startDate && input.endDate) {
    const start = new Date(input.startDate);
    const end = new Date(input.endDate);

    if (isNaN(start.getTime())) {
      errors.push('Start date format is invalid (must be YYYY-MM-DD).');
    }

    if (isNaN(end.getTime())) {
      errors.push('End date format is invalid (must be YYYY-MM-DD).');
    }

    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      if (end < start) {
        errors.push('Rental end date cannot be earlier than start date.');
      }

      // Check for past dates (allowing today)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const startDay = new Date(start);
      startDay.setHours(0, 0, 0, 0);

      if (startDay < today) {
        errors.push('Rental start date cannot be in the past.');
      }
    }
  }

  // Purpose
  if (!input.purpose || typeof input.purpose !== 'string' || !input.purpose.trim()) {
    errors.push('Rental purpose is required.');
  } else if (input.purpose.trim().length > 500) {
    errors.push('Rental purpose cannot exceed 500 characters.');
  }

  // Payment Method: Strictly Cash on Counter Pickup for new reservations at this stage
  if (!input.paymentMethod) {
    errors.push('Payment method is required.');
  } else if (!ALLOWED_NEW_PAYMENT_METHODS.includes(input.paymentMethod)) {
    errors.push(
      `Unsupported payment method '${input.paymentMethod}'. At this stage, only Cash on Counter Pickup ('CASH_PICKUP') is accepted for new reservations.`
    );
  }

  // Customer Rental Agreement Acceptance
  if (input.agreementAccepted !== true) {
    errors.push('Customer Rental Agreement must be explicitly reviewed and accepted before submitting a reservation.');
  }

  if (!input.agreementVersion || input.agreementVersion !== CURRENT_AGREEMENT_VERSION) {
    errors.push(
      `Invalid or outdated agreement version '${input.agreementVersion || 'unspecified'}'. You must review and accept the current agreement version (${CURRENT_AGREEMENT_VERSION}).`
    );
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates state transitions for reservations.
 */
export function validateReservationTransition(
  currentStatus: ReservationStatus,
  targetStatus: ReservationStatus
): ValidationResult {
  const ALLOWED_TRANSITIONS: Record<ReservationStatus, ReservationStatus[]> = {
    PENDING_APPROVAL: ['APPROVED', 'REJECTED', 'CANCELLED'],
    APPROVED: ['CANCELLED'], // Later phases add rental check-out
    REJECTED: [], // Terminal
    CANCELLED: [] // Terminal
  };

  const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(targetStatus)) {
    return {
      isValid: false,
      errors: [
        `Invalid reservation transition: Cannot transition from '${currentStatus}' to '${targetStatus}'. Allowed: [${allowed.join(', ') || 'None (Terminal state)'}].`
      ]
    };
  }

  return { isValid: true, errors: [] };
}
