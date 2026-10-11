import { CameraCondition } from '../../types';
import { RentalStatus } from '../../types/database';

export interface CheckoutRentalInput {
  reservationId: string;
  checkoutCondition: CameraCondition;
  checkoutNotes?: string;
}

export interface ReturnRentalInput {
  rentalId: string;
  returnCondition: CameraCondition;
  returnInspectionNotes: string;
  flagMaintenance?: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

const VALID_CONDITIONS: CameraCondition[] = ['Excellent', 'Good', 'Fair', 'Damaged'];
const VALID_RENTAL_STATUSES: RentalStatus[] = ['CHECKED_OUT', 'RETURNED', 'COMPLETED'];

/**
 * Validates physical checkout inputs.
 */
export function validateCheckoutInput(input: CheckoutRentalInput): ValidationResult {
  const errors: string[] = [];

  if (!input.reservationId || !input.reservationId.trim()) {
    errors.push('Reservation ID is required for checkout.');
  }

  if (!input.checkoutCondition || !VALID_CONDITIONS.includes(input.checkoutCondition)) {
    errors.push(`Invalid checkout condition: '${input.checkoutCondition}'. Must be one of: ${VALID_CONDITIONS.join(', ')}.`);
  } else if (input.checkoutCondition === 'Damaged') {
    errors.push('Cannot checkout camera: Equipment is in Damaged condition and must undergo maintenance first.');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates return inspection inputs.
 */
export function validateReturnInput(input: ReturnRentalInput): ValidationResult {
  const errors: string[] = [];

  if (!input.rentalId || !input.rentalId.trim()) {
    errors.push('Rental ID is required for return processing.');
  }

  if (!input.returnCondition || !VALID_CONDITIONS.includes(input.returnCondition)) {
    errors.push(`Invalid return condition: '${input.returnCondition}'. Must be one of: ${VALID_CONDITIONS.join(', ')}.`);
  }

  if (!input.returnInspectionNotes || !input.returnInspectionNotes.trim()) {
    errors.push('Return inspection notes are mandatory to complete the physical return checklist.');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates legal rental state machine transitions.
 * Legal:
 *   CHECKED_OUT -> RETURNED
 *   RETURNED -> COMPLETED
 */
export function validateRentalTransition(
  currentStatus: RentalStatus,
  targetStatus: RentalStatus
): ValidationResult {
  const errors: string[] = [];

  if (!VALID_RENTAL_STATUSES.includes(targetStatus)) {
    return {
      isValid: false,
      errors: [`Invalid target rental status '${targetStatus}'. Allowed: ${VALID_RENTAL_STATUSES.join(', ')}.`]
    };
  }

  if (currentStatus === targetStatus) {
    return {
      isValid: false,
      errors: [`Rental is already in '${currentStatus}' status.`]
    };
  }

  if (currentStatus === 'CHECKED_OUT') {
    if (targetStatus !== 'RETURNED') {
      errors.push(`Illegal rental transition: 'CHECKED_OUT' rental must be 'RETURNED' before it can be marked '${targetStatus}'.`);
    }
  } else if (currentStatus === 'RETURNED') {
    if (targetStatus !== 'COMPLETED') {
      errors.push(`Illegal rental transition: 'RETURNED' rental cannot transition backwards to '${targetStatus}'.`);
    }
  } else if (currentStatus === 'COMPLETED') {
    errors.push(`Terminal state: Rental is already 'COMPLETED' and cannot be transitioned to '${targetStatus}'.`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
