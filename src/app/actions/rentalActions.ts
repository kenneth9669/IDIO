'use server';

import { revalidatePath } from 'next/cache';
import {
  getRentals,
  getRentalById,
  getRentalByReservationId,
  checkoutRental,
  processReturn,
  completeRental,
  RentalServiceResult
} from '../../lib/rentals/rentalService';
import { CheckoutRentalInput, ReturnRentalInput } from '../../lib/rentals/rentalValidation';
import { Rental } from '../../types';

/**
 * Server Action: Fetch rental records for the active user (own for Customer, all for Admin).
 */
export async function fetchRentalsAction(filters?: {
  status?: string;
  cameraId?: string;
  customerId?: string;
  search?: string;
}): Promise<RentalServiceResult<Rental[]>> {
  return await getRentals(filters);
}

/**
 * Server Action: Fetch single rental details by ID.
 */
export async function fetchRentalByIdAction(id: string): Promise<RentalServiceResult<Rental>> {
  return await getRentalById(id);
}

/**
 * Server Action: Fetch rental details by associated reservation ID.
 */
export async function fetchRentalByReservationIdAction(reservationId: string): Promise<RentalServiceResult<Rental>> {
  return await getRentalByReservationId(reservationId);
}

/**
 * Server Action: Admin executes physical checkout of an approved reservation.
 */
export async function checkoutRentalAction(
  input: CheckoutRentalInput
): Promise<RentalServiceResult<Rental>> {
  const result = await checkoutRental(input);
  if (result.success) {
    revalidatePath('/', 'layout');
  }
  return result;
}

/**
 * Server Action: Admin processes physical return and condition inspection.
 */
export async function processReturnAction(
  input: ReturnRentalInput
): Promise<RentalServiceResult<Rental>> {
  const result = await processReturn(input);
  if (result.success) {
    revalidatePath('/', 'layout');
  }
  return result;
}

/**
 * Server Action: Admin marks a returned rental as COMPLETED.
 */
export async function completeRentalAction(
  rentalId: string
): Promise<RentalServiceResult<Rental>> {
  const result = await completeRental(rentalId);
  if (result.success) {
    revalidatePath('/', 'layout');
  }
  return result;
}
