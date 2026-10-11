'use server';

import { revalidatePath } from 'next/cache';
import {
  getReservations,
  getReservationById,
  createReservation,
  approveReservation,
  rejectReservation,
  cancelReservation,
  checkCameraAvailabilityServer,
  ReservationServiceResult
} from '../../lib/reservations/reservationService';
import { CreateReservationInput } from '../../lib/reservations/reservationValidation';
import { Reservation } from '../../types';

/**
 * Server Action: Fetch reservations for the active user (own for Customer, all for Admin).
 */
export async function fetchReservationsAction(filters?: {
  status?: string;
  cameraId?: string;
  customerId?: string;
  search?: string;
}): Promise<ReservationServiceResult<Reservation[]>> {
  return await getReservations(filters);
}

/**
 * Server Action: Fetch single reservation details by ID.
 */
export async function fetchReservationByIdAction(id: string): Promise<ReservationServiceResult<Reservation>> {
  return await getReservationById(id);
}

/**
 * Server Action: Check camera availability for given dates.
 */
export async function checkCameraAvailabilityAction(
  cameraId: string,
  startDate: string,
  endDate: string
): Promise<{ isAvailable: boolean; reason?: string }> {
  return await checkCameraAvailabilityServer(cameraId, startDate, endDate);
}

/**
 * Server Action: Customer creates a new pending reservation.
 */
export async function createReservationAction(
  input: CreateReservationInput
): Promise<ReservationServiceResult<Reservation>> {
  const result = await createReservation(input);
  if (result.success) {
    revalidatePath('/', 'layout');
  }
  return result;
}

/**
 * Server Action: Admin approves a pending reservation.
 */
export async function approveReservationAction(id: string): Promise<ReservationServiceResult<Reservation>> {
  const result = await approveReservation(id);
  if (result.success) {
    revalidatePath('/', 'layout');
  }
  return result;
}

/**
 * Server Action: Admin rejects a pending reservation with reason.
 */
export async function rejectReservationAction(
  id: string,
  reason: string
): Promise<ReservationServiceResult<Reservation>> {
  const result = await rejectReservation(id, reason);
  if (result.success) {
    revalidatePath('/', 'layout');
  }
  return result;
}

/**
 * Server Action: Customer or Admin cancels an eligible reservation.
 */
export async function cancelReservationAction(id: string): Promise<ReservationServiceResult<Reservation>> {
  const result = await cancelReservation(id);
  if (result.success) {
    revalidatePath('/', 'layout');
  }
  return result;
}
