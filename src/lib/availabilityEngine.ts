import { DigitalCamera, Reservation, RentalStatus } from '../types';
import { addDays, formatDate } from './utils';

export interface AvailabilityResult {
  isAvailable: boolean;
  reason?: string;
  expectedAvailabilityDate?: string;
  conflictingReservation?: Reservation;
}

export interface BookedDateRange {
  startDate: string;        // YYYY-MM-DD
  endDate: string;          // YYYY-MM-DD (contractual return date)
  referenceNo: string;
  status: RentalStatus | 'MAINTENANCE' | 'DAMAGED';
  isOverdue?: boolean;
}

const BLOCKING_STATUSES: RentalStatus[] = [
  'PENDING_APPROVAL',
  'APPROVED',
  'CHECKED_OUT'
];

export interface CameraOperationalScheduleState {
  isMaintenance: boolean;
  isDamaged: boolean;
  isCheckedOut: boolean;
  isOverdue: boolean;
  overdueReservation?: Reservation;
  activeRental?: Reservation;
  activeReservationToday?: Reservation;
  futureApprovedReservations: Reservation[];
  pendingReservations: Reservation[];
  hasFutureReservations: boolean;
  hasPendingReservations: boolean;
  isGenuinelyAvailableToday: boolean;
  effectiveStatus: 'AVAILABLE' | 'CHECKED_OUT' | 'OVERDUE' | 'RESERVED_TODAY' | 'MAINTENANCE' | 'DAMAGED';
  statusLabel: string;
}

/**
 * Computes the authoritative operational and reservation scheduling state for a physical camera.
 * Reused by Admin Dashboard, Fleet Manager, and Customer views to ensure 100% consistent availability status.
 */
export function getCameraOperationalScheduleState(
  camera: DigitalCamera,
  allReservations: Reservation[],
  currentDate?: string
): CameraOperationalScheduleState {
  const todayStr = currentDate || new Date().toISOString().split('T')[0];

  const isMaintenance = camera.status === 'MAINTENANCE';
  const isDamaged = camera.status === 'DAMAGED' || camera.condition === 'Damaged';

  const cameraReservations = allReservations.filter(r => r.cameraId === camera.id);

  // Active checked-out rental
  const activeRental = cameraReservations.find(r => r.status === 'CHECKED_OUT');
  const isCheckedOut = camera.status === 'CHECKED_OUT' || Boolean(activeRental);

  // Overdue check
  const isOverdue = Boolean(activeRental && activeRental.status === 'CHECKED_OUT' && todayStr > activeRental.endDate);
  const overdueReservation = isOverdue ? activeRental : undefined;

  // Active approved reservation covering today (ready for pickup or in rental window)
  const activeReservationToday = cameraReservations.find(
    r => r.status === 'APPROVED' && r.startDate <= todayStr && r.endDate >= todayStr && !isCheckedOut
  );

  // Future approved reservations starting strictly after today
  const futureApprovedReservations = cameraReservations.filter(
    r => r.status === 'APPROVED' && r.startDate > todayStr
  );

  // Pending reservations that hold inventory and end today or in the future
  const pendingReservations = cameraReservations.filter(
    r => r.status === 'PENDING_APPROVAL' && r.endDate >= todayStr
  );

  const hasFutureReservations = futureApprovedReservations.length > 0;
  const hasPendingReservations = pendingReservations.length > 0;

  // Genuinely available today for immediate booking/pickup
  const isGenuinelyAvailableToday =
    !isMaintenance &&
    !isDamaged &&
    !isCheckedOut &&
    !isOverdue &&
    !activeReservationToday;

  let effectiveStatus: CameraOperationalScheduleState['effectiveStatus'] = 'AVAILABLE';
  let statusLabel = 'Available';

  if (isMaintenance) {
    effectiveStatus = 'MAINTENANCE';
    statusLabel = 'Maintenance';
  } else if (isDamaged) {
    effectiveStatus = 'DAMAGED';
    statusLabel = 'Damaged';
  } else if (isOverdue) {
    effectiveStatus = 'OVERDUE';
    statusLabel = 'Overdue Return';
  } else if (isCheckedOut) {
    effectiveStatus = 'CHECKED_OUT';
    statusLabel = 'In-Field Rental';
  } else if (activeReservationToday) {
    effectiveStatus = 'RESERVED_TODAY';
    statusLabel = 'Reserved (Pickup Today)';
  } else if (hasPendingReservations) {
    effectiveStatus = 'AVAILABLE';
    statusLabel = 'Available (Pending Booking)';
  } else if (hasFutureReservations) {
    effectiveStatus = 'AVAILABLE';
    statusLabel = 'Available (Future Bookings)';
  }

  return {
    isMaintenance,
    isDamaged,
    isCheckedOut,
    isOverdue,
    overdueReservation,
    activeRental,
    activeReservationToday,
    futureApprovedReservations,
    pendingReservations,
    hasFutureReservations,
    hasPendingReservations,
    isGenuinelyAvailableToday,
    effectiveStatus,
    statusLabel
  };
}

/**
 * Checks if a digital camera is available for the given start and end date range.
 *
 * Core Business Rules:
 * 1. Camera operational state: cannot be MAINTENANCE, DAMAGED, or condition 'Damaged'.
 * 2. Overdue protection: if camera or an active rental is CHECKED_OUT and overdue (current date > end date),
 *    the camera remains strictly unavailable until physically returned, inspected, and confirmed.
 * 3. Multiple non-conflicting rentals allowed:
 *    The same physical camera can be rented by different customers on different eligible dates.
 *    - Example: Customer A rents Oct 20–22. Customer B requests Oct 23–25 -> ALLOWED.
 *    - Customer C requests dates overlapping Oct 20–22 -> PREVENTED.
 * 4. Contextual messaging without PII leakage:
 *    Never exposes another customer's identity, contact information, payment details, or private reference number.
 * 5. Revalidation on server immediately before committing a reservation.
 */
export function checkCameraAvailability(
  camera: DigitalCamera,
  startDate: string,
  endDate: string,
  allReservations: Reservation[],
  excludeReservationId?: string
): AvailabilityResult {
  // 1. Direct camera operational status check
  if (camera.status === 'MAINTENANCE') {
    return {
      isAvailable: false,
      reason: 'This camera is currently unavailable due to maintenance.'
    };
  }

  if (camera.status === 'DAMAGED' || camera.condition === 'Damaged') {
    return {
      isAvailable: false,
      reason: 'This camera is currently unavailable due to damage (damaged).'
    };
  }

  const todayStr = new Date().toISOString().split('T')[0];

  // Active reservations for this camera (exclude cancelled, rejected, and completed; also exclude expired uncollected bookings)
  const cameraReservations = allReservations.filter(res => {
    if (res.cameraId !== camera.id) return false;
    if (!BLOCKING_STATUSES.includes(res.status)) return false;
    if (excludeReservationId && res.id === excludeReservationId) return false;
    // Expired uncollected reservations (ended before today and never checked out) do not block future rentals
    if (res.status !== 'CHECKED_OUT' && res.endDate < todayStr && startDate >= todayStr) {
      return false;
    }
    return true;
  });

  // 2. Check for overdue rentals on this camera
  const overdueReservation = cameraReservations.find(res => 
    res.status === 'CHECKED_OUT' && todayStr > res.endDate
  );
  if (overdueReservation) {
    return {
      isAvailable: false,
      reason: 'This camera is currently checked out and overdue. Availability has not yet been confirmed.',
      conflictingReservation: overdueReservation
    };
  }

  // If no dates have been chosen yet, check current checked-out status for expected return date
  if (!startDate || !endDate) {
    const activeCheckout = cameraReservations.find(res => res.status === 'CHECKED_OUT');
    if (activeCheckout) {
      const expected = addDays(activeCheckout.endDate, 1);
      return {
        isAvailable: true,
        expectedAvailabilityDate: expected,
        reason: `Expected availability: ${formatDate(expected)}, subject to return and inspection.`
      };
    }
    return { isAvailable: true };
  }

  if (endDate < startDate) {
    return {
      isAvailable: false,
      reason: 'Rental end date cannot be earlier than start date.'
    };
  }

  // 3. Exact date overlap check against active reservations
  // A requested period [startDate, endDate] conflicts with [res.startDate, res.endDate]
  // if and only if: startDate <= res.endDate && endDate >= res.startDate
  for (const res of cameraReservations) {
    const hasOverlap = startDate <= res.endDate && endDate >= res.startDate;

    if (hasOverlap) {
      if ((res.status as string) === 'MAINTENANCE' || (res.status as string) === 'DAMAGED') {
        return {
          isAvailable: false,
          reason: 'This camera is currently unavailable due to maintenance.',
          conflictingReservation: res
        };
      }
      const expectedDate = addDays(res.endDate, 1);
      return {
        isAvailable: false,
        reason: `This camera is unavailable for your selected dates. Expected availability: ${formatDate(expectedDate)}, subject to return and inspection.`,
        expectedAvailabilityDate: expectedDate,
        conflictingReservation: res
      };
    }
  }

  return {
    isAvailable: true,
    reason: 'Available for your selected dates.'
  };
}

/**
 * Returns all upcoming booked date intervals for a camera to assist calendar rendering.
 * Filters out completed, rejected, cancelled, and past expired uncollected reservations.
 */
export function getBookedDateRanges(
  cameraId: string,
  allReservations: Reservation[]
): BookedDateRange[] {
  const todayStr = new Date().toISOString().split('T')[0];

  return allReservations
    .filter(r => {
      if (r.cameraId !== cameraId) return false;
      const isBlocking =
        BLOCKING_STATUSES.includes(r.status) ||
        (r.status as string) === 'MAINTENANCE' ||
        (r.status as string) === 'DAMAGED';
      if (!isBlocking) return false;
      // Exclude expired uncollected bookings that ended before today and were never checked out
      if (
        r.status !== 'CHECKED_OUT' &&
        (r.status as string) !== 'MAINTENANCE' &&
        (r.status as string) !== 'DAMAGED' &&
        r.endDate < todayStr
      ) {
        return false;
      }
      return true;
    })
    .map(r => {
      const isOverdue = r.status === 'CHECKED_OUT' && todayStr > r.endDate;

      return {
        startDate: r.startDate,
        endDate: r.endDate,
        referenceNo: r.referenceNo,
        status: r.status,
        isOverdue
      };
    });
}
