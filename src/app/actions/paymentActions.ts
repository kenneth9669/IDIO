'use server';

import { revalidatePath } from 'next/cache';
import {
  getPayments,
  getPaymentById,
  getPaymentByReservationId,
  confirmPayment,
  refundPayment,
  settleSecurityDeposit,
  PaymentServiceResult
} from '../../lib/payments/paymentService';
import {
  ConfirmPaymentInput,
  RefundPaymentInput,
  SettleDepositInput
} from '../../lib/payments/paymentValidation';
import { PaymentAndDeposit } from '../../types';

/**
 * Server Action: Fetch payment/deposit records (own for Customer, all for Admin).
 */
export async function fetchPaymentsAction(filters?: {
  paymentStatus?: string;
  depositStatus?: string;
  reservationId?: string;
  search?: string;
}): Promise<PaymentServiceResult<PaymentAndDeposit[]>> {
  return await getPayments(filters);
}

/**
 * Server Action: Fetch single payment/deposit record by ID.
 */
export async function fetchPaymentByIdAction(id: string): Promise<PaymentServiceResult<PaymentAndDeposit>> {
  return await getPaymentById(id);
}

/**
 * Server Action: Fetch payment/deposit record by associated reservation ID.
 */
export async function fetchPaymentByReservationIdAction(
  reservationId: string
): Promise<PaymentServiceResult<PaymentAndDeposit>> {
  return await getPaymentByReservationId(reservationId);
}

/**
 * Server Action: Admin confirms manual payment as PAID.
 */
export async function confirmPaymentAction(
  input: ConfirmPaymentInput
): Promise<PaymentServiceResult<PaymentAndDeposit>> {
  const result = await confirmPayment(input);
  if (result.success) {
    revalidatePath('/', 'layout');
  }
  return result;
}

/**
 * Server Action: Admin records simulated payment refund.
 */
export async function refundPaymentAction(
  input: RefundPaymentInput
): Promise<PaymentServiceResult<PaymentAndDeposit>> {
  const result = await refundPayment(input);
  if (result.success) {
    revalidatePath('/', 'layout');
  }
  return result;
}

/**
 * Server Action: Admin settles held security deposit (refund, deduct, or forfeit).
 */
export async function settleDepositAction(
  input: SettleDepositInput
): Promise<PaymentServiceResult<PaymentAndDeposit>> {
  const result = await settleSecurityDeposit(input);
  if (result.success) {
    revalidatePath('/', 'layout');
  }
  return result;
}
