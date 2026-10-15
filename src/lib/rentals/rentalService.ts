import { createClient } from '../supabase/server';
import {
  RentalRow,
  ReservationRow,
  DigitalCameraRow,
  ProfileRow,
  CameraStatus,
  RentalStatus
} from '../../types/database';
import { Rental, CameraCategory, CameraCondition } from '../../types';
import { getAuthenticatedUser, requireAdmin } from '../auth';
import {
  validateCheckoutInput,
  validateReturnInput,
  validateRentalTransition,
  CheckoutRentalInput,
  ReturnRentalInput
} from './rentalValidation';

export interface RentalServiceResult<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: string[];
}

/**
 * Maps a database RentalRow and related joins to a clean domain `Rental` object.
 */
export function mapRowToRental(
  rental: RentalRow,
  reservation?: Partial<ReservationRow>,
  customer?: Partial<ProfileRow>,
  camera?: Partial<DigitalCameraRow>,
  checkoutAdmin?: Partial<ProfileRow>,
  returnAdmin?: Partial<ProfileRow>
): Rental {
  return {
    id: rental.id,
    reservationId: rental.reservation_id,
    referenceNo: reservation?.reference_no,
    cameraId: rental.camera_id,
    cameraName: camera?.name || 'Digital Camera',
    cameraBrand: camera?.brand || 'Sony',
    cameraSerial: camera?.serial_number || '',
    cameraImageUrl: camera?.image_url || 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32',
    customerId: rental.customer_id,
    customerName: customer?.full_name || 'Verified Customer',
    customerEmail: customer?.email || '',
    customerPhone: customer?.phone || '',
    customerBarangay: customer?.barangay || 'Libertad',
    idType: customer?.id_type || 'Government ID',
    idNumber: customer?.id_number || '',
    checkoutAdminId: rental.checkout_admin_id,
    checkoutAdminName: checkoutAdmin?.full_name || 'Counter Admin',
    checkoutCondition: rental.checkout_condition as CameraCondition,
    checkoutNotes: rental.checkout_notes || undefined,
    checkedOutAt: rental.checked_out_at,
    status: rental.status as 'CHECKED_OUT' | 'RETURNED' | 'COMPLETED',
    returnAdminId: rental.return_admin_id || undefined,
    returnAdminName: returnAdmin?.full_name || undefined,
    returnCondition: (rental.return_condition as CameraCondition) || undefined,
    returnInspectionNotes: rental.return_inspection_notes || undefined,
    returnedAt: rental.returned_at || undefined,
    completedAt: rental.completed_at || undefined,
    startDate: reservation?.start_date,
    endDate: reservation?.end_date,
    totalDays: reservation?.total_days,
    dailyRate: reservation?.daily_rate_snapshot ? Number(reservation.daily_rate_snapshot) : undefined,
    subtotal: reservation?.subtotal_php ? Number(reservation.subtotal_php) : undefined,
    securityDeposit: reservation?.security_deposit_php ? Number(reservation.security_deposit_php) : undefined,
    totalAmount: reservation?.total_amount_php ? Number(reservation.total_amount_php) : undefined,
    createdAt: rental.created_at,
    updatedAt: rental.updated_at
  };
}

/**
 * Fetches rental records based on user role and filters.
 * - Customer: Returns ONLY rentals matching their authenticated customer_id.
 * - Admin: Returns all rentals across the fleet with optional filters.
 */
export async function getRentals(filters?: {
  status?: string;
  cameraId?: string;
  customerId?: string;
  search?: string;
}): Promise<RentalServiceResult<Rental[]>> {
  try {
    const authContext = await getAuthenticatedUser();
    if (!authContext) {
      return { success: false, message: 'Unauthorized: Please log in to view rentals.' };
    }

    const supabase = await createClient({ requireAuth: true });

    let query = supabase
      .from('rentals')
      .select(`
        *,
        reservations:reservation_id (id, reference_no, start_date, end_date, total_days, daily_rate_snapshot, subtotal_php, security_deposit_php, total_amount_php),
        profiles:customer_id (id, full_name, email, phone, barangay, street_address, id_type, id_number),
        digital_cameras:camera_id (id, name, brand, category, serial_number, image_url),
        checkout_admin:checkout_admin_id (id, full_name),
        return_admin:return_admin_id (id, full_name)
      `)
      .order('checked_out_at', { ascending: false });

    // Customer can only view their own rentals
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
      return { success: false, message: `Failed to load rentals: ${error.message}`, errors: [error.message] };
    }

    let items = (data || []).map((row: any) => {
      const reservation = row.reservations;
      const customer = row.profiles;
      const camera = row.digital_cameras;
      const checkoutAdmin = row.checkout_admin;
      const returnAdmin = row.return_admin;
      return mapRowToRental(row, reservation, customer, camera, checkoutAdmin, returnAdmin);
    });

    if (filters?.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      items = items.filter(
        (r) =>
          (r.referenceNo && r.referenceNo.toLowerCase().includes(q)) ||
          (r.customerName && r.customerName.toLowerCase().includes(q)) ||
          (r.cameraName && r.cameraName.toLowerCase().includes(q)) ||
          (r.cameraSerial && r.cameraSerial.toLowerCase().includes(q)) ||
          (r.customerBarangay && r.customerBarangay.toLowerCase().includes(q))
      );
    }

    return { success: true, message: 'Rentals loaded successfully.', data: items };
  } catch (err: any) {
    return { success: false, message: err.message || 'Error fetching rentals.' };
  }
}

/**
 * Fetches a single rental by ID.
 * Enforces ownership: A customer cannot retrieve another customer's rental.
 */
export async function getRentalById(id: string): Promise<RentalServiceResult<Rental>> {
  try {
    const authContext = await getAuthenticatedUser();
    if (!authContext) {
      return { success: false, message: 'Unauthorized: Please log in.' };
    }

    const supabase = await createClient({ requireAuth: true });

    const { data, error } = await supabase
      .from('rentals')
      .select(`
        *,
        reservations:reservation_id (id, reference_no, start_date, end_date, total_days, daily_rate_snapshot, subtotal_php, security_deposit_php, total_amount_php),
        profiles:customer_id (id, full_name, email, phone, barangay, street_address, id_type, id_number),
        digital_cameras:camera_id (id, name, brand, category, serial_number, image_url),
        checkout_admin:checkout_admin_id (id, full_name),
        return_admin:return_admin_id (id, full_name)
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      return { success: false, message: `Rental record '${id}' not found.` };
    }

    if (authContext.profile.role === 'CUSTOMER' && data.customer_id !== authContext.user.id) {
      return { success: false, message: 'Forbidden: You do not have permission to view this rental.' };
    }

    const reservation = data.reservations;
    const customer = data.profiles;
    const camera = data.digital_cameras;
    const checkoutAdmin = data.checkout_admin;
    const returnAdmin = data.return_admin;

    return {
      success: true,
      message: 'Rental retrieved.',
      data: mapRowToRental(data, reservation, customer, camera, checkoutAdmin, returnAdmin)
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'Error fetching rental.' };
  }
}

/**
 * Fetches a rental by associated reservation ID.
 */
export async function getRentalByReservationId(reservationId: string): Promise<RentalServiceResult<Rental>> {
  try {
    const authContext = await getAuthenticatedUser();
    if (!authContext) {
      return { success: false, message: 'Unauthorized: Please log in.' };
    }

    const supabase = await createClient({ requireAuth: true });

    const { data, error } = await supabase
      .from('rentals')
      .select(`
        *,
        reservations:reservation_id (id, reference_no, start_date, end_date, total_days, daily_rate_snapshot, subtotal_php, security_deposit_php, total_amount_php),
        profiles:customer_id (id, full_name, email, phone, barangay, street_address, id_type, id_number),
        digital_cameras:camera_id (id, name, brand, category, serial_number, image_url),
        checkout_admin:checkout_admin_id (id, full_name),
        return_admin:return_admin_id (id, full_name)
      `)
      .eq('reservation_id', reservationId)
      .maybeSingle();

    if (error || !data) {
      return { success: false, message: `Rental for reservation '${reservationId}' not found.` };
    }

    if (authContext.profile.role === 'CUSTOMER' && data.customer_id !== authContext.user.id) {
      return { success: false, message: 'Forbidden: You do not have permission to view this rental.' };
    }

    const reservation = data.reservations;
    const customer = data.profiles;
    const camera = data.digital_cameras;
    const checkoutAdmin = data.checkout_admin;
    const returnAdmin = data.return_admin;

    return {
      success: true,
      message: 'Rental retrieved.',
      data: mapRowToRental(data, reservation, customer, camera, checkoutAdmin, returnAdmin)
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'Error fetching rental.' };
  }
}

/**
 * Admin Operation: Physical Camera Checkout.
 * Converts an APPROVED reservation into an active rental:
 * 1. Verifies reservation status is APPROVED.
 * 2. Verifies reservation has not already been checked out.
 * 3. Verifies camera is not MAINTENANCE, DAMAGED, or CHECKED_OUT.
 * 4. Inserts rental row into `public.rentals`.
 * 5. Updates camera status in `public.digital_cameras` to CHECKED_OUT.
 * 6. Records audit log.
 */
export async function checkoutRental(input: CheckoutRentalInput): Promise<RentalServiceResult<Rental>> {
  const authContext = await requireAdmin();

  const validation = validateCheckoutInput(input);
  if (!validation.isValid) {
    return {
      success: false,
      message: `Validation error: ${validation.errors.join(' ')}`,
      errors: validation.errors
    };
  }

  try {
    const supabase = await createClient({ requireAuth: true });

    // 1. Fetch reservation
    const { data: reservation, error: resErr } = await supabase
      .from('reservations')
      .select(`
        *,
        profiles:customer_id (*),
        digital_cameras:camera_id (*)
      `)
      .eq('id', input.reservationId)
      .single();

    if (resErr || !reservation) {
      return { success: false, message: `Reservation '${input.reservationId}' does not exist.` };
    }

    // 2. Reservation state check
    if (reservation.status !== 'APPROVED') {
      return {
        success: false,
        message: `Cannot checkout reservation in '${reservation.status}' status. Reservation must be 'APPROVED' before physical checkout.`
      };
    }

    // 3. Verify reservation has not already been converted into a rental
    const { data: existingRental } = await supabase
      .from('rentals')
      .select('id, status')
      .eq('reservation_id', input.reservationId)
      .maybeSingle();

    if (existingRental) {
      return {
        success: false,
        message: `Reservation ${reservation.reference_no} has already been checked out (Rental ID: ${existingRental.id}, Status: ${existingRental.status}).`
      };
    }

    // 4. Verify camera eligibility
    const { data: camera, error: camErr } = await supabase
      .from('digital_cameras')
      .select('*')
      .eq('id', reservation.camera_id)
      .single();

    if (camErr || !camera) {
      return { success: false, message: 'Associated camera record was not found in inventory.' };
    }

    if (camera.status === 'MAINTENANCE') {
      return { success: false, message: `Cannot checkout: Camera ${camera.name} is currently under MAINTENANCE.` };
    }

    if (camera.status === 'DAMAGED' || camera.condition === 'Damaged') {
      return { success: false, message: `Cannot checkout: Camera ${camera.name} is marked as DAMAGED.` };
    }

    if (camera.status === 'CHECKED_OUT') {
      return { success: false, message: `Cannot checkout: Camera ${camera.name} is already CHECKED_OUT.` };
    }

    const now = new Date().toISOString();

    // 5. Insert Rental record into public.rentals
    const rentalInsertData = {
      reservation_id: reservation.id,
      camera_id: camera.id,
      customer_id: reservation.customer_id,
      checkout_admin_id: authContext.user.id,
      checkout_condition: input.checkoutCondition,
      checkout_notes: input.checkoutNotes?.trim() || 'Physical handover checklist and serial verification completed.',
      checked_out_at: now,
      status: 'CHECKED_OUT' as RentalStatus
    };

    const { data: newRental, error: insertErr } = await supabase
      .from('rentals')
      .insert(rentalInsertData)
      .select()
      .single();

    if (insertErr) {
      if (insertErr.code === '23505' || insertErr.message.includes('reservation_id')) {
        return {
          success: false,
          message: `Cannot checkout: Reservation ${reservation.reference_no} has already been checked out.`
        };
      }
      return { success: false, message: `Failed to create rental record: ${insertErr.message}` };
    }

    // 6. Update Camera status in public.digital_cameras to CHECKED_OUT
    const { error: camUpdateErr } = await supabase
      .from('digital_cameras')
      .update({
        status: 'CHECKED_OUT' as CameraStatus,
        condition: input.checkoutCondition,
        total_rentals_count: (camera.total_rentals_count || 0) + 1,
        updated_at: now
      })
      .eq('id', camera.id);

    if (camUpdateErr) {
      return { success: false, message: `Rental recorded, but failed to update camera status: ${camUpdateErr.message}` };
    }

    // 7. Audit log
    await supabase.from('activity_audit_logs').insert({
      actor_id: authContext.user.id,
      actor_name: authContext.profile.full_name,
      actor_role: authContext.profile.role,
      action: 'CHECKOUT_RENTAL',
      details: `Physical checkout executed for ${camera.name} (${camera.serial_number}) to ${reservation.profiles?.full_name || 'Customer'}. Grade: ${input.checkoutCondition}`,
      target_type: 'RENTAL',
      target_id: newRental.id
    });

    const fullRental = mapRowToRental(
      newRental as RentalRow,
      reservation as ReservationRow,
      reservation.profiles,
      camera as DigitalCameraRow,
      authContext.profile
    );

    return {
      success: true,
      message: `Camera ${camera.name} (${camera.serial_number}) checked out successfully to ${reservation.profiles?.full_name || 'Customer'}.`,
      data: fullRental
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'Server error during rental checkout.' };
  }
}

/**
 * Admin Operation: Physical Return & Condition Inspection.
 * Records return timestamp, condition grade, and inspection notes.
 * Updates camera status based on inspection:
 * - Damaged -> DAMAGED
 * - Maintenance required or Fair -> MAINTENANCE
 * - Clean -> AVAILABLE
 */
export async function processReturn(input: ReturnRentalInput): Promise<RentalServiceResult<Rental>> {
  const authContext = await requireAdmin();

  const validation = validateReturnInput(input);
  if (!validation.isValid) {
    return {
      success: false,
      message: `Validation error: ${validation.errors.join(' ')}`,
      errors: validation.errors
    };
  }

  try {
    const supabase = await createClient({ requireAuth: true });

    // 1. Fetch rental record
    const { data: rental, error: fetchErr } = await supabase
      .from('rentals')
      .select(`
        *,
        reservations:reservation_id (*),
        profiles:customer_id (*),
        digital_cameras:camera_id (*),
        checkout_admin:checkout_admin_id (*)
      `)
      .eq('id', input.rentalId)
      .single();

    if (fetchErr || !rental) {
      return { success: false, message: `Rental record '${input.rentalId}' not found.` };
    }

    // 2. Validate transition
    const transition = validateRentalTransition(rental.status, 'RETURNED');
    if (!transition.isValid) {
      return { success: false, message: transition.errors[0] };
    }

    // 3. Determine resulting camera status
    let nextCameraStatus: CameraStatus = 'AVAILABLE';
    if (input.returnCondition === 'Damaged') {
      nextCameraStatus = 'DAMAGED';
    } else if (input.flagMaintenance || input.returnCondition === 'Fair') {
      nextCameraStatus = 'MAINTENANCE';
    }

    const now = new Date().toISOString();

    // 4. Update Rental record
    const { data: updatedRental, error: updateErr } = await supabase
      .from('rentals')
      .update({
        status: 'RETURNED' as RentalStatus,
        return_admin_id: authContext.user.id,
        return_condition: input.returnCondition,
        return_inspection_notes: input.returnInspectionNotes.trim(),
        returned_at: now,
        updated_at: now
      })
      .eq('id', rental.id)
      .select()
      .single();

    if (updateErr) {
      return { success: false, message: `Failed to record return: ${updateErr.message}` };
    }

    // 5. Update Camera status in public.digital_cameras
    const cameraUpdateData: Partial<DigitalCameraRow> = {
      status: nextCameraStatus,
      condition: input.returnCondition,
      updated_at: now
    };

    if (nextCameraStatus !== 'AVAILABLE') {
      cameraUpdateData.maintenance_notes = `Post-return inspection on ${now.slice(0, 10)}: ${input.returnInspectionNotes.trim()}`;
    }

    const { error: camErr } = await supabase
      .from('digital_cameras')
      .update(cameraUpdateData)
      .eq('id', rental.camera_id);

    if (camErr) {
      return { success: false, message: `Return recorded, but failed to update camera status: ${camErr.message}` };
    }

    // 6. Audit log
    await supabase.from('activity_audit_logs').insert({
      actor_id: authContext.user.id,
      actor_name: authContext.profile.full_name,
      actor_role: authContext.profile.role,
      action: 'RETURN_RENTAL',
      details: `Return & inspection processed for ${rental.digital_cameras?.name || 'Camera'}. Condition: ${input.returnCondition}. Resulting status: ${nextCameraStatus}`,
      target_type: 'RENTAL',
      target_id: rental.id
    });

    const fullRental = mapRowToRental(
      updatedRental as RentalRow,
      rental.reservations,
      rental.profiles,
      rental.digital_cameras,
      rental.checkout_admin,
      authContext.profile
    );

    return {
      success: true,
      message: `Return inspection completed for ${rental.digital_cameras?.name || 'Camera'}. Equipment status: ${nextCameraStatus}.`,
      data: fullRental
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'Server error processing return.' };
  }
}

/**
 * Admin Operation: Complete Rental Lifecycle.
 * Transitions a RETURNED rental to COMPLETED.
 */
export async function completeRental(rentalId: string): Promise<RentalServiceResult<Rental>> {
  const authContext = await requireAdmin();

  if (!rentalId || !rentalId.trim()) {
    return { success: false, message: 'Rental ID is required.' };
  }

  try {
    const supabase = await createClient();

    // 1. Fetch existing rental
    const { data: rental, error: fetchErr } = await supabase
      .from('rentals')
      .select(`
        *,
        reservations:reservation_id (*),
        profiles:customer_id (*),
        digital_cameras:camera_id (*),
        checkout_admin:checkout_admin_id (*),
        return_admin:return_admin_id (*)
      `)
      .eq('id', rentalId)
      .single();

    if (fetchErr || !rental) {
      return { success: false, message: `Rental record '${rentalId}' not found.` };
    }

    // 2. Validate transition
    const transition = validateRentalTransition(rental.status, 'COMPLETED');
    if (!transition.isValid) {
      return { success: false, message: transition.errors[0] };
    }

    const now = new Date().toISOString();

    // 3. Update Rental record to COMPLETED
    const { data: updatedRental, error: updateErr } = await supabase
      .from('rentals')
      .update({
        status: 'COMPLETED' as RentalStatus,
        completed_at: now,
        updated_at: now
      })
      .eq('id', rental.id)
      .select()
      .single();

    if (updateErr) {
      return { success: false, message: `Failed to complete rental: ${updateErr.message}` };
    }

    // 4. Audit log
    await supabase.from('activity_audit_logs').insert({
      actor_id: authContext.user.id,
      actor_name: authContext.profile.full_name,
      actor_role: authContext.profile.role,
      action: 'COMPLETE_RENTAL',
      details: `Rental lifecycle completed for ${rental.digital_cameras?.name || 'Camera'} (Rental ID: ${rental.id})`,
      target_type: 'RENTAL',
      target_id: rental.id
    });

    const fullRental = mapRowToRental(
      updatedRental as RentalRow,
      rental.reservations,
      rental.profiles,
      rental.digital_cameras,
      rental.checkout_admin,
      rental.return_admin
    );

    return {
      success: true,
      message: `Rental lifecycle completed successfully for ${rental.digital_cameras?.name || 'Camera'}.`,
      data: fullRental
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'Server error completing rental.' };
  }
}
