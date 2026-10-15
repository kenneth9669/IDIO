import { createClient } from '../supabase/server';
import {
  PaymentAndDepositRow,
  ReservationRow,
  ProfileRow,
  DigitalCameraRow,
  PaymentStatus,
  DepositStatus,
  PaymentMethod
} from '../../types/database';
import { PaymentAndDeposit } from '../../types';
import { getAuthenticatedUser, requireAdmin } from '../auth';
import {
  validatePaymentReference,
  validatePaymentTransition,
  validateDepositTransition,
  validateDepositDeduction,
  validatePaymentMethodForNewTransaction,
  ConfirmPaymentInput,
  RefundPaymentInput,
  SettleDepositInput
} from './paymentValidation';

export interface PaymentServiceResult<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: string[];
}

/**
 * Maps a database PaymentAndDepositRow and related joins to a clean domain `PaymentAndDeposit` object.
 */
export function mapRowToPaymentAndDeposit(
  row: PaymentAndDepositRow,
  reservation?: Partial<ReservationRow>,
  customer?: Partial<ProfileRow>,
  camera?: Partial<DigitalCameraRow>,
  settledAdmin?: Partial<ProfileRow>
): PaymentAndDeposit {
  return {
    id: row.id,
    reservationId: row.reservation_id,
    referenceNo: reservation?.reference_no,
    customerId: reservation?.customer_id,
    customerName: customer?.full_name || 'Verified Customer',
    customerEmail: customer?.email || '',
    customerPhone: customer?.phone || '',
    cameraName: camera?.name || 'Digital Camera',
    cameraSerial: camera?.serial_number || '',
    rentalAmount: Number(row.rental_amount_php),
    paymentMethod: row.payment_method as PaymentMethod,
    paymentStatus: row.payment_status as PaymentStatus,
    paymentReference: row.payment_reference || undefined,
    securityDeposit: Number(row.security_deposit_php),
    depositStatus: row.deposit_status as DepositStatus,
    depositDeduction: row.deposit_deduction_php !== null && row.deposit_deduction_php !== undefined ? Number(row.deposit_deduction_php) : undefined,
    depositDeductionReason: row.deposit_deduction_reason || undefined,
    settledByAdminId: row.settled_by_admin_id || undefined,
    settledByAdminName: settledAdmin?.full_name || undefined,
    settledAt: row.settled_at || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Fetches payments and deposit records based on user role and filters.
 * - Customer: Returns ONLY records associated with their reservations.
 * - Admin: Returns all records across the fleet with optional filters.
 */
export async function getPayments(filters?: {
  paymentStatus?: string;
  depositStatus?: string;
  reservationId?: string;
  search?: string;
}): Promise<PaymentServiceResult<PaymentAndDeposit[]>> {
  try {
    const authContext = await getAuthenticatedUser();
    if (!authContext) {
      return { success: false, message: 'Unauthorized: Please log in to view financial records.' };
    }

    const supabase = await createClient({ requireAuth: true });

    let query = supabase
      .from('payments_and_deposits')
      .select(`
        *,
        reservations:reservation_id (
          id, reference_no, customer_id, camera_id, start_date, end_date, total_days,
          profiles:customer_id (id, full_name, email, phone, barangay),
          digital_cameras:camera_id (id, name, brand, serial_number)
        ),
        settled_admin:settled_by_admin_id (id, full_name)
      `)
      .order('created_at', { ascending: false });

    if (filters?.reservationId) {
      query = query.eq('reservation_id', filters.reservationId);
    }

    if (filters?.paymentStatus && filters.paymentStatus !== 'ALL') {
      query = query.eq('payment_status', filters.paymentStatus);
    }

    if (filters?.depositStatus && filters.depositStatus !== 'ALL') {
      query = query.eq('deposit_status', filters.depositStatus);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, message: `Failed to load payment records: ${error.message}`, errors: [error.message] };
    }

    let items = (data || []).map((row: any) => {
      const reservation = row.reservations;
      const customer = reservation?.profiles;
      const camera = reservation?.digital_cameras;
      const settledAdmin = row.settled_admin;
      return mapRowToPaymentAndDeposit(row, reservation, customer, camera, settledAdmin);
    });

    // Customer ownership filter
    if (authContext.profile.role === 'CUSTOMER') {
      items = items.filter((p) => p.customerId === authContext.user.id);
    }

    // Search query filter
    if (filters?.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      items = items.filter(
        (p) =>
          (p.referenceNo && p.referenceNo.toLowerCase().includes(q)) ||
          (p.paymentReference && p.paymentReference.toLowerCase().includes(q)) ||
          (p.customerName && p.customerName.toLowerCase().includes(q)) ||
          (p.cameraName && p.cameraName.toLowerCase().includes(q)) ||
          (p.cameraSerial && p.cameraSerial.toLowerCase().includes(q))
      );
    }

    return { success: true, message: 'Payment records loaded.', data: items };
  } catch (err: any) {
    return { success: false, message: err.message || 'Error fetching payment records.' };
  }
}

/**
 * Fetches a single payment record by ID.
 * Enforces ownership: A customer cannot view another customer's payment record.
 */
export async function getPaymentById(id: string): Promise<PaymentServiceResult<PaymentAndDeposit>> {
  try {
    const authContext = await getAuthenticatedUser();
    if (!authContext) {
      return { success: false, message: 'Unauthorized: Please log in.' };
    }

    const supabase = await createClient({ requireAuth: true });

    const { data, error } = await supabase
      .from('payments_and_deposits')
      .select(`
        *,
        reservations:reservation_id (
          id, reference_no, customer_id, camera_id,
          profiles:customer_id (id, full_name, email, phone, barangay),
          digital_cameras:camera_id (id, name, brand, serial_number)
        ),
        settled_admin:settled_by_admin_id (id, full_name)
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      return { success: false, message: `Payment record '${id}' not found.` };
    }

    const reservation = data.reservations;
    const customer = reservation?.profiles;
    const camera = reservation?.digital_cameras;
    const settledAdmin = data.settled_admin;

    // Ownership check
    if (authContext.profile.role === 'CUSTOMER' && reservation?.customer_id !== authContext.user.id) {
      return { success: false, message: 'Forbidden: You do not have permission to view this financial record.' };
    }

    return {
      success: true,
      message: 'Payment record retrieved.',
      data: mapRowToPaymentAndDeposit(data, reservation, customer, camera, settledAdmin)
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'Error fetching payment record.' };
  }
}

/**
 * Fetches a payment record by associated reservation ID.
 */
export async function getPaymentByReservationId(reservationId: string): Promise<PaymentServiceResult<PaymentAndDeposit>> {
  try {
    const authContext = await getAuthenticatedUser();
    if (!authContext) {
      return { success: false, message: 'Unauthorized: Please log in.' };
    }

    const supabase = await createClient({ requireAuth: true });

    const { data, error } = await supabase
      .from('payments_and_deposits')
      .select(`
        *,
        reservations:reservation_id (
          id, reference_no, customer_id, camera_id,
          profiles:customer_id (id, full_name, email, phone, barangay),
          digital_cameras:camera_id (id, name, brand, serial_number)
        ),
        settled_admin:settled_by_admin_id (id, full_name)
      `)
      .eq('reservation_id', reservationId)
      .maybeSingle();

    if (error || !data) {
      return { success: false, message: `Financial record for reservation '${reservationId}' not found.` };
    }

    const reservation = data.reservations;
    const customer = reservation?.profiles;
    const camera = reservation?.digital_cameras;
    const settledAdmin = data.settled_admin;

    // Ownership check
    if (authContext.profile.role === 'CUSTOMER' && reservation?.customer_id !== authContext.user.id) {
      return { success: false, message: 'Forbidden: You do not have permission to view this financial record.' };
    }

    return {
      success: true,
      message: 'Payment record retrieved.',
      data: mapRowToPaymentAndDeposit(data, reservation, customer, camera, settledAdmin)
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'Error fetching payment record.' };
  }
}

/**
 * Admin Operation: Confirm manual/simulated rental payment.
 * Transitions payment_status PENDING -> PAID.
 */
export async function confirmPayment(input: ConfirmPaymentInput): Promise<PaymentServiceResult<PaymentAndDeposit>> {
  const authContext = await requireAdmin();

  if (!input.paymentId || !input.paymentId.trim()) {
    return { success: false, message: 'Payment ID is required.' };
  }

  if (input.paymentReference) {
    const refCheck = validatePaymentReference(input.paymentReference);
    if (!refCheck.isValid) {
      return { success: false, message: refCheck.errors.join(' '), errors: refCheck.errors };
    }
  }

  try {
    const supabase = await createClient({ requireAuth: true });

    // 1. Fetch existing payment record
    const { data: existing, error: fetchErr } = await supabase
      .from('payments_and_deposits')
      .select(`
        *,
        reservations:reservation_id (
          id, reference_no, customer_id, camera_id,
          profiles:customer_id (*),
          digital_cameras:camera_id (*)
        )
      `)
      .eq('id', input.paymentId)
      .single();

    if (fetchErr || !existing) {
      return { success: false, message: `Payment record '${input.paymentId}' not found.` };
    }

    // 2. Validate transition
    const transition = validatePaymentTransition(existing.payment_status, 'PAID');
    if (!transition.isValid) {
      return { success: false, message: transition.errors[0] };
    }

    const now = new Date().toISOString();

    const updatePayload: Partial<PaymentAndDepositRow> = {
      payment_status: 'PAID',
      updated_at: now
    };

    if (input.paymentMethod) {
      const methodCheck = validatePaymentMethodForNewTransaction(input.paymentMethod);
      if (!methodCheck.isValid) {
        return { success: false, message: methodCheck.errors[0] };
      }
      updatePayload.payment_method = input.paymentMethod;
    }

    if (input.paymentReference !== undefined) {
      updatePayload.payment_reference = input.paymentReference.trim() || null;
    }

    // 3. Update database
    const { data: updated, error: updateErr } = await supabase
      .from('payments_and_deposits')
      .update(updatePayload)
      .eq('id', existing.id)
      .select()
      .single();

    if (updateErr) {
      return { success: false, message: `Failed to confirm payment: ${updateErr.message}` };
    }

    // 4. Audit log
    await supabase.from('activity_audit_logs').insert({
      actor_id: authContext.user.id,
      actor_name: authContext.profile.full_name,
      actor_role: authContext.profile.role,
      action: 'CONFIRM_PAYMENT',
      details: `Confirmed rental payment of ₱${Number(updated.rental_amount_php).toFixed(2)} (${updated.payment_method}) for reservation ${existing.reservations?.reference_no || existing.reservation_id}`,
      target_type: 'PAYMENT',
      target_id: updated.id
    });

    const fullPayment = mapRowToPaymentAndDeposit(
      updated as PaymentAndDepositRow,
      existing.reservations,
      existing.reservations?.profiles,
      existing.reservations?.digital_cameras
    );

    return {
      success: true,
      message: `Payment of ₱${fullPayment.rentalAmount.toFixed(2)} confirmed as PAID.`,
      data: fullPayment
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'Server error confirming payment.' };
  }
}

/**
 * Admin Operation: Process simulated rental payment refund.
 * Transitions payment_status PAID -> REFUNDED.
 */
export async function refundPayment(input: RefundPaymentInput): Promise<PaymentServiceResult<PaymentAndDeposit>> {
  const authContext = await requireAdmin();

  if (!input.paymentId || !input.paymentId.trim()) {
    return { success: false, message: 'Payment ID is required.' };
  }

  try {
    const supabase = await createClient({ requireAuth: true });

    // 1. Fetch existing payment record
    const { data: existing, error: fetchErr } = await supabase
      .from('payments_and_deposits')
      .select(`
        *,
        reservations:reservation_id (
          id, reference_no, customer_id, camera_id,
          profiles:customer_id (*),
          digital_cameras:camera_id (*)
        )
      `)
      .eq('id', input.paymentId)
      .single();

    if (fetchErr || !existing) {
      return { success: false, message: `Payment record '${input.paymentId}' not found.` };
    }

    // 2. Validate transition
    const transition = validatePaymentTransition(existing.payment_status, 'REFUNDED');
    if (!transition.isValid) {
      return { success: false, message: transition.errors[0] };
    }

    const now = new Date().toISOString();

    // 3. Update database
    const { data: updated, error: updateErr } = await supabase
      .from('payments_and_deposits')
      .update({
        payment_status: 'REFUNDED',
        updated_at: now
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (updateErr) {
      return { success: false, message: `Failed to record refund: ${updateErr.message}` };
    }

    // 4. Audit log
    await supabase.from('activity_audit_logs').insert({
      actor_id: authContext.user.id,
      actor_name: authContext.profile.full_name,
      actor_role: authContext.profile.role,
      action: 'REFUND_PAYMENT',
      details: `Processed simulated payment refund of ₱${Number(updated.rental_amount_php).toFixed(2)} for reservation ${existing.reservations?.reference_no || existing.reservation_id}. Reason: ${input.reason || 'Not specified'}`,
      target_type: 'PAYMENT',
      target_id: updated.id
    });

    const fullPayment = mapRowToPaymentAndDeposit(
      updated as PaymentAndDepositRow,
      existing.reservations,
      existing.reservations?.profiles,
      existing.reservations?.digital_cameras
    );

    return {
      success: true,
      message: `Payment of ₱${fullPayment.rentalAmount.toFixed(2)} marked as REFUNDED.`,
      data: fullPayment
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'Server error processing refund.' };
  }
}

/**
 * Admin Operation: Settle security deposit after physical return & inspection.
 * Supports:
 * - REFUND_FULL: HELD -> REFUNDED
 * - DEDUCT_DAMAGE: HELD -> DEDUCTED (with deduction amount & reason)
 * - FORFEIT: HELD -> FORFEITED (with reason)
 */
export async function settleSecurityDeposit(input: SettleDepositInput): Promise<PaymentServiceResult<PaymentAndDeposit>> {
  const authContext = await requireAdmin();

  if (!input.paymentId || !input.paymentId.trim()) {
    return { success: false, message: 'Payment ID is required.' };
  }

  try {
    const supabase = await createClient({ requireAuth: true });

    // 1. Fetch existing payment record
    const { data: existing, error: fetchErr } = await supabase
      .from('payments_and_deposits')
      .select(`
        *,
        reservations:reservation_id (
          id, reference_no, customer_id, camera_id,
          profiles:customer_id (*),
          digital_cameras:camera_id (*)
        )
      `)
      .eq('id', input.paymentId)
      .single();

    if (fetchErr || !existing) {
      return { success: false, message: `Financial record '${input.paymentId}' not found.` };
    }

    const heldDeposit = Number(existing.security_deposit_php);

    // 2. Validate action and target status
    let targetStatus: DepositStatus = 'REFUNDED';
    let deduction = 0;
    let deductionReason: string | null = null;

    if (input.action === 'REFUND_FULL') {
      targetStatus = 'REFUNDED';
    } else if (input.action === 'DEDUCT_DAMAGE') {
      targetStatus = 'DEDUCTED';
      deduction = input.deductionAmount || 0;
      deductionReason = input.deductionReason?.trim() || '';

      const deductionCheck = validateDepositDeduction(heldDeposit, deduction, deductionReason);
      if (!deductionCheck.isValid) {
        return { success: false, message: deductionCheck.errors.join(' '), errors: deductionCheck.errors };
      }
    } else if (input.action === 'FORFEIT') {
      targetStatus = 'FORFEITED';
      deduction = heldDeposit;
      deductionReason = input.deductionReason?.trim() || '';

      if (!deductionReason) {
        return { success: false, message: 'A specific reason is required when forfeiting a security deposit.' };
      }
    } else {
      return { success: false, message: `Invalid deposit settlement action '${input.action}'.` };
    }

    // 3. Validate transition from current deposit_status
    const transitionCheck = validateDepositTransition(existing.deposit_status, targetStatus);
    if (!transitionCheck.isValid) {
      return { success: false, message: transitionCheck.errors[0] };
    }

    const now = new Date().toISOString();

    // 4. Update database
    const { data: updated, error: updateErr } = await supabase
      .from('payments_and_deposits')
      .update({
        deposit_status: targetStatus,
        deposit_deduction_php: deduction,
        deposit_deduction_reason: deductionReason || null,
        settled_by_admin_id: authContext.user.id,
        settled_at: now,
        updated_at: now
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (updateErr) {
      return { success: false, message: `Failed to settle security deposit: ${updateErr.message}` };
    }

    // 5. Audit log
    await supabase.from('activity_audit_logs').insert({
      actor_id: authContext.user.id,
      actor_name: authContext.profile.full_name,
      actor_role: authContext.profile.role,
      action: 'SETTLE_DEPOSIT',
      details: `Settled security deposit of ₱${heldDeposit.toFixed(2)} as ${targetStatus}${deduction > 0 ? ` (Deduction: ₱${deduction.toFixed(2)}, Reason: ${deductionReason})` : ''} for reservation ${existing.reservations?.reference_no || existing.reservation_id}`,
      target_type: 'DEPOSIT',
      target_id: updated.id
    });

    const fullPayment = mapRowToPaymentAndDeposit(
      updated as PaymentAndDepositRow,
      existing.reservations,
      existing.reservations?.profiles,
      existing.reservations?.digital_cameras,
      authContext.profile
    );

    return {
      success: true,
      message: `Security deposit settled successfully: ${targetStatus}.`,
      data: fullPayment
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'Server error settling security deposit.' };
  }
}
