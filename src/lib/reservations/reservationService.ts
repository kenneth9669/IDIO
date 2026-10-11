import { createClient } from '../supabase/server';
import {
  ReservationRow,
  DigitalCameraRow,
  ProfileRow,
  PaymentAndDepositRow,
  ReservationStatus,
  PaymentMethod,
  PaymentStatus,
  DepositStatus
} from '../../types/database';
import { Reservation, CameraCategory, CameraCondition, RentalStatus } from '../../types';
import { getAuthenticatedUser, requireAdmin } from '../auth';
import { validateReservationInput, validateReservationTransition, CreateReservationInput } from './reservationValidation';
import { calculateRentalDays, generateReferenceCode } from '../utils';

export interface ReservationServiceResult<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: string[];
}

/**
 * Maps database rows to domain `Reservation` object.
 */
export function mapRowToReservation(
  res: ReservationRow,
  profile?: Partial<ProfileRow>,
  camera?: Partial<DigitalCameraRow>,
  payment?: Partial<PaymentAndDepositRow>
): Reservation {
  return {
    id: res.id,
    referenceNo: res.reference_no,
    customerId: res.customer_id,
    customerName: profile?.full_name || 'Verified Customer',
    customerEmail: profile?.email || '',
    customerPhone: profile?.phone || '',
    customerBarangay: profile?.barangay || 'Libertad',
    customerStreetAddress: profile?.street_address || '',
    idType: profile?.id_type || 'Government ID',
    idNumber: profile?.id_number || '',
    cameraId: res.camera_id,
    cameraName: camera?.name || 'Digital Camera',
    cameraBrand: camera?.brand || 'Sony',
    cameraCategory: (camera?.category as CameraCategory) || 'Mirrorless',
    cameraSerial: camera?.serial_number || '',
    cameraImageUrl: camera?.image_url || 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32',
    startDate: res.start_date,
    endDate: res.end_date,
    totalDays: res.total_days,
    dailyRate: Number(res.daily_rate_snapshot),
    subtotal: Number(res.subtotal_php),
    securityDeposit: Number(res.security_deposit_php),
    totalAmount: Number(res.total_amount_php),
    purpose: res.purpose,
    status: res.status as RentalStatus,
    paymentStatus: (payment?.payment_status as PaymentStatus) || 'PENDING',
    paymentMethod: (payment?.payment_method as PaymentMethod) || 'GCASH',
    paymentReference: payment?.payment_reference || undefined,
    depositStatus: (payment?.deposit_status as DepositStatus) || 'HELD',
    depositDeduction: payment?.deposit_deduction_php ? Number(payment.deposit_deduction_php) : undefined,
    depositNotes: payment?.deposit_deduction_reason || undefined,
    rejectionReason: res.rejection_reason || undefined,
    createdAt: res.created_at,
    updatedAt: res.updated_at
  };
}

/**
 * Fetches reservations based on user role and permissions.
 * - Customer: Returns ONLY their own reservations.
 * - Admin: Returns all reservations across the fleet.
 */
export async function getReservations(filters?: {
  status?: string;
  cameraId?: string;
  customerId?: string;
  search?: string;
}): Promise<ReservationServiceResult<Reservation[]>> {
  try {
    const authContext = await getAuthenticatedUser();
    if (!authContext) {
      return { success: false, message: 'Unauthorized: Please log in to view reservations.' };
    }

    const supabase = await createClient();

    let query = supabase
      .from('reservations')
      .select(`
        *,
        profiles:customer_id (id, full_name, email, phone, barangay, street_address, id_type, id_number),
        digital_cameras:camera_id (id, name, brand, category, serial_number, image_url, daily_rate_php, security_deposit_php),
        payments_and_deposits (payment_status, payment_method, payment_reference, deposit_status, deposit_deduction_php, deposit_deduction_reason)
      `)
      .order('created_at', { ascending: false });

    // Customer can only view their own bookings
    if (authContext.profile.role === 'CUSTOMER') {
      query = query.eq('customer_id', authContext.user.id);
    } else if (filters?.customerId) {
      query = query.eq('customer_id', filters.customerId);
    }

    if (filters?.status && filters.status !== 'ALL') {
      query = query.eq('status', filters.status);
    }

    if (filters?.cameraId && filters.cameraId !== 'ALL') {
      query = query.eq('camera_id', filters.cameraId);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, message: `Failed to load reservations: ${error.message}`, errors: [error.message] };
    }

    let items = (data || []).map((row: any) => {
      const profile = row.profiles;
      const camera = row.digital_cameras;
      const payment = Array.isArray(row.payments_and_deposits) ? row.payments_and_deposits[0] : row.payments_and_deposits;
      return mapRowToReservation(row, profile, camera, payment);
    });

    // Client-side text search
    if (filters?.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      items = items.filter(
        (r) =>
          r.referenceNo.toLowerCase().includes(q) ||
          r.customerName.toLowerCase().includes(q) ||
          r.cameraName.toLowerCase().includes(q) ||
          r.cameraSerial.toLowerCase().includes(q) ||
          r.customerBarangay.toLowerCase().includes(q)
      );
    }

    return { success: true, message: 'Reservations loaded successfully.', data: items };
  } catch (err: any) {
    return { success: false, message: err.message || 'Error fetching reservations.' };
  }
}

/**
 * Fetches a single reservation by ID.
 * Enforces ownership: A customer cannot retrieve another customer's reservation.
 */
export async function getReservationById(id: string): Promise<ReservationServiceResult<Reservation>> {
  try {
    const authContext = await getAuthenticatedUser();
    if (!authContext) {
      return { success: false, message: 'Unauthorized: Please log in.' };
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('reservations')
      .select(`
        *,
        profiles:customer_id (id, full_name, email, phone, barangay, street_address, id_type, id_number),
        digital_cameras:camera_id (id, name, brand, category, serial_number, image_url, daily_rate_php, security_deposit_php),
        payments_and_deposits (payment_status, payment_method, payment_reference, deposit_status, deposit_deduction_php, deposit_deduction_reason)
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      return { success: false, message: `Reservation '${id}' not found.` };
    }

    // Ownership check: Customer cannot view other customer records
    if (authContext.profile.role === 'CUSTOMER' && data.customer_id !== authContext.user.id) {
      return { success: false, message: 'Forbidden: You do not have permission to view this reservation.' };
    }

    const profile = data.profiles;
    const camera = data.digital_cameras;
    const payment = Array.isArray(data.payments_and_deposits) ? data.payments_and_deposits[0] : data.payments_and_deposits;

    return {
      success: true,
      message: 'Reservation retrieved.',
      data: mapRowToReservation(data, profile, camera, payment)
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'Error fetching reservation record.' };
  }
}

/**
 * Server-Side Availability Check against active reservations.
 * Active blocking statuses: PENDING_APPROVAL and APPROVED.
 */
export async function checkCameraAvailabilityServer(
  cameraId: string,
  startDate: string,
  endDate: string,
  excludeReservationId?: string
): Promise<{ isAvailable: boolean; reason?: string }> {
  try {
    const supabase = await createClient();

    // 1. Check camera status
    const { data: camera, error: camErr } = await supabase
      .from('digital_cameras')
      .select('id, name, status, condition, maintenance_notes')
      .eq('id', cameraId)
      .single();

    if (camErr || !camera) {
      return { isAvailable: false, reason: 'Selected camera does not exist in inventory.' };
    }

    if (camera.status === 'MAINTENANCE') {
      return {
        isAvailable: false,
        reason: `Camera is currently under maintenance (${camera.maintenance_notes || 'Service / calibration'}).`
      };
    }

    if (camera.status === 'DAMAGED' || camera.condition === 'Damaged') {
      return { isAvailable: false, reason: 'Camera is marked as damaged and cannot be rented.' };
    }

    if (camera.status === 'CHECKED_OUT') {
      return { isAvailable: false, reason: 'Camera is currently checked out.' };
    }

    // 2. Query overlapping reservations in database
    let query = supabase
      .from('reservations')
      .select('id, reference_no, start_date, end_date, status')
      .eq('camera_id', cameraId)
      .in('status', ['PENDING_APPROVAL', 'APPROVED'])
      .lte('start_date', endDate)
      .gte('end_date', startDate);

    if (excludeReservationId) {
      query = query.neq('id', excludeReservationId);
    }

    const { data: overlaps, error: overlapErr } = await query;

    if (!overlapErr && overlaps && overlaps.length > 0) {
      const conflict = overlaps[0];
      return {
        isAvailable: false,
        reason: `Camera is already booked from ${conflict.start_date} to ${conflict.end_date} (${conflict.reference_no}).`
      };
    }

    return { isAvailable: true };
  } catch (err: any) {
    return { isAvailable: false, reason: err.message || 'Error verifying camera availability.' };
  }
}

/**
 * Customer Mutation: Create a new reservation.
 * Enforces:
 * - Authenticated user identity (`auth.uid()`).
 * - Initial status is ALWAYS `PENDING_APPROVAL`.
 * - Authoritative camera pricing (`daily_rate_php`, `security_deposit_php`).
 * - Concurrency protection: database GIST exclusion constraint.
 */
export async function createReservation(input: CreateReservationInput): Promise<ReservationServiceResult<Reservation>> {
  // 1. Authenticate user
  const authContext = await getAuthenticatedUser();
  if (!authContext) {
    return { success: false, message: 'Authentication required to create a reservation.' };
  }

  // 2. Validate input format and dates
  const validation = validateReservationInput(input);
  if (!validation.isValid) {
    return {
      success: false,
      message: `Validation failed: ${validation.errors.join(' ')}`,
      errors: validation.errors
    };
  }

  try {
    const supabase = await createClient();

    // 3. Fetch authoritative camera record from PostgreSQL
    const { data: camera, error: camErr } = await supabase
      .from('digital_cameras')
      .select('*')
      .eq('id', input.cameraId)
      .single();

    if (camErr || !camera) {
      return { success: false, message: 'Selected digital camera does not exist.' };
    }

    if (camera.status === 'MAINTENANCE') {
      return { success: false, message: 'Cannot reserve: Camera is currently under maintenance.' };
    }

    if (camera.status === 'DAMAGED' || camera.condition === 'Damaged') {
      return { success: false, message: 'Cannot reserve: Camera is marked as damaged.' };
    }

    if (camera.status === 'CHECKED_OUT') {
      return { success: false, message: 'Cannot reserve: Camera is currently checked out.' };
    }

    // 4. Check for overlapping reservations for immediate feedback
    const availCheck = await checkCameraAvailabilityServer(input.cameraId, input.startDate, input.endDate);
    if (!availCheck.isAvailable) {
      return { success: false, message: availCheck.reason || 'This camera is not available for the requested dates.' };
    }

    // 5. Authoritative price calculations derived on server
    const totalDays = calculateRentalDays(input.startDate, input.endDate);
    const dailyRateSnapshot = Number(camera.daily_rate_php);
    const subtotal = totalDays * dailyRateSnapshot;
    const securityDeposit = Number(camera.security_deposit_php);
    const totalAmount = subtotal + securityDeposit;
    const referenceNo = generateReferenceCode('IDIO');

    const reservationRow = {
      reference_no: referenceNo,
      customer_id: authContext.user.id, // Derived strictly from server session
      camera_id: input.cameraId,
      start_date: input.startDate,
      end_date: input.endDate,
      total_days: totalDays,
      daily_rate_snapshot: dailyRateSnapshot,
      subtotal_php: subtotal,
      security_deposit_php: securityDeposit,
      total_amount_php: totalAmount,
      purpose: input.purpose.trim(),
      status: 'PENDING_APPROVAL' as ReservationStatus, // Strictly PENDING_APPROVAL
      rejection_reason: null
    };

    // 6. Database Insert (Protected by PostgreSQL EXCLUDE constraint)
    const { data: newRes, error: insertErr } = await supabase
      .from('reservations')
      .insert(reservationRow)
      .select()
      .single();

    if (insertErr) {
      // Catch exclusion / concurrency constraint violation
      if (
        insertErr.code === '23P01' ||
        insertErr.code === '23505' ||
        insertErr.message.includes('prevent_camera_reservation_overlap') ||
        insertErr.message.includes('overlap') ||
        insertErr.message.includes('conflicting key')
      ) {
        return {
          success: false,
          message: 'This camera is no longer available for the selected dates. Please choose another date or camera.'
        };
      }
      return { success: false, message: `Database error creating reservation: ${insertErr.message}` };
    }

    // 7. Create corresponding payment record
    const paymentRow = {
      reservation_id: newRes.id,
      rental_amount_php: subtotal,
      payment_method: input.paymentMethod,
      payment_status: 'PENDING' as PaymentStatus,
      payment_reference: input.paymentReference?.trim() || null,
      security_deposit_php: securityDeposit,
      deposit_status: 'HELD' as DepositStatus
    };

    await supabase.from('payments_and_deposits').insert(paymentRow);

    const fullReservation = mapRowToReservation(
      newRes as ReservationRow,
      authContext.profile,
      camera as DigitalCameraRow,
      paymentRow as any
    );

    return {
      success: true,
      message: `Reservation ${referenceNo} created successfully! Awaiting Admin approval.`,
      data: fullReservation
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'Server error creating reservation.' };
  }
}

/**
 * Admin Mutation: Approve a pending reservation.
 * Enforces `requireAdmin()` and validates state transition.
 */
export async function approveReservation(id: string): Promise<ReservationServiceResult<Reservation>> {
  await requireAdmin();

  try {
    const supabase = await createClient();

    const { data: existing, error: fetchErr } = await supabase
      .from('reservations')
      .select(`
        *,
        profiles:customer_id (*),
        digital_cameras:camera_id (*),
        payments_and_deposits (*)
      `)
      .eq('id', id)
      .single();

    if (fetchErr || !existing) {
      return { success: false, message: `Reservation '${id}' not found.` };
    }

    // Validate transition
    const transition = validateReservationTransition(existing.status, 'APPROVED');
    if (!transition.isValid) {
      return { success: false, message: transition.errors[0] };
    }

    // Check for race condition overlaps
    const availCheck = await checkCameraAvailabilityServer(
      existing.camera_id,
      existing.start_date,
      existing.end_date,
      existing.id
    );

    if (!availCheck.isAvailable) {
      return {
        success: false,
        message: `Cannot approve reservation: Conflict detected. ${availCheck.reason}`
      };
    }

    const { data: updated, error: updateErr } = await supabase
      .from('reservations')
      .update({
        status: 'APPROVED',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) {
      if (
        updateErr.code === '23P01' ||
        updateErr.message.includes('prevent_camera_reservation_overlap') ||
        updateErr.message.includes('overlap')
      ) {
        return {
          success: false,
          message: 'Cannot approve reservation: An overlapping reservation is already active on this camera.'
        };
      }
      return { success: false, message: `Failed to approve reservation: ${updateErr.message}` };
    }

    const profile = existing.profiles;
    const camera = existing.digital_cameras;
    const payment = Array.isArray(existing.payments_and_deposits) ? existing.payments_and_deposits[0] : existing.payments_and_deposits;

    return {
      success: true,
      message: `Reservation ${updated.reference_no} approved for pickup!`,
      data: mapRowToReservation(updated as ReservationRow, profile, camera, payment)
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'Server error approving reservation.' };
  }
}

/**
 * Admin Mutation: Reject a pending reservation with a required reason.
 * Enforces `requireAdmin()` and validates state transition.
 */
export async function rejectReservation(id: string, reason: string): Promise<ReservationServiceResult<Reservation>> {
  await requireAdmin();

  if (!reason || !reason.trim()) {
    return { success: false, message: 'Rejection reason is required.' };
  }

  try {
    const supabase = await createClient();

    const { data: existing, error: fetchErr } = await supabase
      .from('reservations')
      .select(`
        *,
        profiles:customer_id (*),
        digital_cameras:camera_id (*),
        payments_and_deposits (*)
      `)
      .eq('id', id)
      .single();

    if (fetchErr || !existing) {
      return { success: false, message: `Reservation '${id}' not found.` };
    }

    const transition = validateReservationTransition(existing.status, 'REJECTED');
    if (!transition.isValid) {
      return { success: false, message: transition.errors[0] };
    }

    const { data: updated, error: updateErr } = await supabase
      .from('reservations')
      .update({
        status: 'REJECTED',
        rejection_reason: reason.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) {
      return { success: false, message: `Failed to reject reservation: ${updateErr.message}` };
    }

    const profile = existing.profiles;
    const camera = existing.digital_cameras;
    const payment = Array.isArray(existing.payments_and_deposits) ? existing.payments_and_deposits[0] : existing.payments_and_deposits;

    return {
      success: true,
      message: `Reservation ${updated.reference_no} rejected.`,
      data: mapRowToReservation(updated as ReservationRow, profile, camera, payment)
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'Server error rejecting reservation.' };
  }
}

/**
 * Customer or Admin Mutation: Cancel an eligible reservation.
 * Customer: Can only cancel their own PENDING_APPROVAL reservation.
 * Admin: Can cancel PENDING_APPROVAL or APPROVED reservation.
 */
export async function cancelReservation(id: string): Promise<ReservationServiceResult<Reservation>> {
  const authContext = await getAuthenticatedUser();
  if (!authContext) {
    return { success: false, message: 'Unauthorized: Please log in.' };
  }

  try {
    const supabase = await createClient();

    const { data: existing, error: fetchErr } = await supabase
      .from('reservations')
      .select(`
        *,
        profiles:customer_id (*),
        digital_cameras:camera_id (*),
        payments_and_deposits (*)
      `)
      .eq('id', id)
      .single();

    if (fetchErr || !existing) {
      return { success: false, message: `Reservation '${id}' not found.` };
    }

    // Ownership & permission guard
    if (authContext.profile.role === 'CUSTOMER') {
      if (existing.customer_id !== authContext.user.id) {
        return { success: false, message: 'Access Denied: You cannot cancel another customer\'s reservation.' };
      }
      if (existing.status !== 'PENDING_APPROVAL') {
        return { success: false, message: 'Customer can only cancel reservations in PENDING_APPROVAL status.' };
      }
    }

    const transition = validateReservationTransition(existing.status, 'CANCELLED');
    if (!transition.isValid) {
      return { success: false, message: transition.errors[0] };
    }

    const { data: updated, error: updateErr } = await supabase
      .from('reservations')
      .update({
        status: 'CANCELLED',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (updateErr) {
      return { success: false, message: `Failed to cancel reservation: ${updateErr.message}` };
    }

    const profile = existing.profiles;
    const camera = existing.digital_cameras;
    const payment = Array.isArray(existing.payments_and_deposits) ? existing.payments_and_deposits[0] : existing.payments_and_deposits;

    return {
      success: true,
      message: `Reservation ${updated.reference_no} has been cancelled.`,
      data: mapRowToReservation(updated as ReservationRow, profile, camera, payment)
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'Server error cancelling reservation.' };
  }
}
