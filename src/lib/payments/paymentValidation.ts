import { PaymentMethod, PaymentStatus, DepositStatus } from '../../types/database';

export interface ConfirmPaymentInput {
  paymentId: string;
  paymentMethod?: PaymentMethod;
  paymentReference?: string;
}

export interface RefundPaymentInput {
  paymentId: string;
  reason?: string;
}

export interface SettleDepositInput {
  paymentId: string;
  action: 'REFUND_FULL' | 'DEDUCT_DAMAGE' | 'FORFEIT';
  deductionAmount?: number;
  deductionReason?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

const VALID_PAYMENT_METHODS: PaymentMethod[] = ['GCASH', 'CASH_PICKUP', 'MAYA', 'BANK_TRANSFER'];
const VALID_PAYMENT_STATUSES: PaymentStatus[] = ['PENDING', 'PAID', 'REFUNDED'];
const VALID_DEPOSIT_STATUSES: DepositStatus[] = ['HELD', 'REFUNDED', 'DEDUCTED', 'FORFEITED'];

/**
 * Validates manual payment reference formatting.
 * Ensures no sensitive credit card credentials or passwords are stored.
 */
export function validatePaymentReference(reference: string): ValidationResult {
  const errors: string[] = [];
  const trimmed = reference.trim();

  if (trimmed.length > 100) {
    errors.push('Payment reference number cannot exceed 100 characters.');
  }

  // Reject potential card numbers (13-19 continuous digits)
  if (/\b\d{13,19}\b/.test(trimmed.replace(/[\s-]/g, ''))) {
    errors.push('Payment reference must not contain raw credit/debit card numbers.');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates legal payment status state machine transitions.
 * Legal:
 *   PENDING -> PAID
 *   PAID -> REFUNDED
 */
export function validatePaymentTransition(
  currentStatus: PaymentStatus,
  targetStatus: PaymentStatus
): ValidationResult {
  const errors: string[] = [];

  if (!VALID_PAYMENT_STATUSES.includes(targetStatus)) {
    return {
      isValid: false,
      errors: [`Invalid target payment status '${targetStatus}'. Allowed: ${VALID_PAYMENT_STATUSES.join(', ')}.`]
    };
  }

  if (currentStatus === targetStatus) {
    return {
      isValid: false,
      errors: [`Payment is already in '${currentStatus}' status.`]
    };
  }

  if (currentStatus === 'PENDING') {
    if (targetStatus !== 'PAID') {
      errors.push(`Illegal payment transition: 'PENDING' payment must be confirmed as 'PAID' before it can be '${targetStatus}'.`);
    }
  } else if (currentStatus === 'PAID') {
    if (targetStatus !== 'REFUNDED') {
      errors.push(`Illegal payment transition: 'PAID' payment cannot transition backwards to '${targetStatus}'.`);
    }
  } else if (currentStatus === 'REFUNDED') {
    errors.push(`Terminal state: Payment is already 'REFUNDED' and cannot be transitioned to '${targetStatus}'.`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates legal security deposit status state machine transitions.
 * Legal:
 *   HELD -> REFUNDED
 *   HELD -> DEDUCTED
 *   HELD -> FORFEITED
 */
export function validateDepositTransition(
  currentStatus: DepositStatus,
  targetStatus: DepositStatus
): ValidationResult {
  const errors: string[] = [];

  if (!VALID_DEPOSIT_STATUSES.includes(targetStatus)) {
    return {
      isValid: false,
      errors: [`Invalid target deposit status '${targetStatus}'. Allowed: ${VALID_DEPOSIT_STATUSES.join(', ')}.`]
    };
  }

  if (currentStatus === targetStatus) {
    return {
      isValid: false,
      errors: [`Deposit is already in '${currentStatus}' status.`]
    };
  }

  if (currentStatus !== 'HELD') {
    errors.push(`Deposit is already settled in '${currentStatus}' status and cannot be re-settled to '${targetStatus}'.`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates security deposit deduction parameters against authoritative deposit.
 */
export function validateDepositDeduction(
  securityDeposit: number,
  deductionAmount: number,
  deductionReason: string
): ValidationResult {
  const errors: string[] = [];

  if (deductionAmount <= 0) {
    errors.push('Deposit deduction amount must be greater than ₱0.00.');
  }

  if (deductionAmount > securityDeposit) {
    errors.push(`Deposit deduction amount (₱${deductionAmount.toFixed(2)}) cannot exceed held security deposit (₱${securityDeposit.toFixed(2)}).`);
  }

  if (!deductionReason || !deductionReason.trim()) {
    errors.push('A specific justification reason is mandatory when deducting from a security deposit.');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
