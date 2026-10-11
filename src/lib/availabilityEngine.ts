import { DigitalCamera, Reservation, RentalStatus } from '../types';

export interface AvailabilityResult {
  isAvailable: boolean;
  reason?: string;
  conflictingReservation?: Reservation;
}

const BLOCKING_STATUSES: RentalStatus[] = [
  'PENDING_APPROVAL',
  'APPROVED',
  'CHECKED_OUT'
];

/**
 * Checks if a digital camera is available for the given start and end date range.
 * Strict domain logic:
 * 1. Camera status cannot be MAINTENANCE or DAMAGED.
 * 2. No overlapping active reservations (PENDING_APPROVAL, APPROVED, CHECKED_OUT).
 */
export function checkCameraAvailability(
  camera: DigitalCamera,
  startDate: string,
  endDate: string,
  allReservations: Reservation[],
  excludeReservationId?: string
): AvailabilityResult {
  // 1. Check direct camera operational state
  if (camera.status === 'MAINTENANCE') {
    return {
      isAvailable: false,
      reason: `Camera is currently flagged under maintenance (${camera.maintenanceNotes || 'Routine calibration / repair'}).`
    };
  }

  if (camera.status === 'DAMAGED' || camera.condition === 'Damaged') {
    return {
      isAvailable: false,
      reason: 'Camera is currently marked as damaged and cannot be rented.'
    };
  }

  if (!startDate || !endDate) {
    return { isAvailable: true };
  }

  const reqStart = new Date(startDate).getTime();
  const reqEnd = new Date(endDate).getTime();

  if (reqEnd < reqStart) {
    return {
      isAvailable: false,
      reason: 'Rental end date cannot be earlier than start date.'
    };
  }

  // 2. Check for overlapping reservations for this specific camera
  const cameraReservations = allReservations.filter(res => 
    res.cameraId === camera.id && 
    BLOCKING_STATUSES.includes(res.status) &&
    (!excludeReservationId || res.id !== excludeReservationId)
  );

  for (const res of cameraReservations) {
    const resStart = new Date(res.startDate).getTime();
    const resEnd = new Date(res.endDate).getTime();

    // Overlap condition: reqStart <= resEnd && reqEnd >= resStart
    const hasOverlap = reqStart <= resEnd && reqEnd >= resStart;

    if (hasOverlap) {
      return {
        isAvailable: false,
        reason: `Camera is already reserved/rented from ${res.startDate} to ${res.endDate} (${res.referenceNo}).`,
        conflictingReservation: res
      };
    }
  }

  return { isAvailable: true };
}

/**
 * Returns all upcoming booked date intervals for a camera to assist calendar rendering.
 */
export function getBookedDateRanges(
  cameraId: string,
  allReservations: Reservation[]
): { startDate: string; endDate: string; referenceNo: string; status: RentalStatus }[] {
  return allReservations
    .filter(r => r.cameraId === cameraId && BLOCKING_STATUSES.includes(r.status))
    .map(r => ({
      startDate: r.startDate,
      endDate: r.endDate,
      referenceNo: r.referenceNo,
      status: r.status
    }));
}
