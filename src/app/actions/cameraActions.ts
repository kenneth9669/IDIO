'use server';

import { revalidatePath } from 'next/cache';
import {
  getCameras,
  getCameraById,
  createCamera,
  updateCamera,
  setCameraStatus,
  setCameraCondition,
  deleteCamera,
  CameraServiceResult
} from '../../lib/cameras/cameraService';
import { CameraInput } from '../../lib/cameras/cameraValidation';
import { CameraStatus, CameraCondition } from '../../types/database';
import { DigitalCamera } from '../../types';

/**
 * Server Action: Fetch public/catalog camera fleet with optional filters.
 */
export async function fetchCamerasAction(filters?: {
  category?: string;
  status?: string;
  brand?: string;
  search?: string;
}): Promise<CameraServiceResult<DigitalCamera[]>> {
  return await getCameras(filters);
}

/**
 * Server Action: Fetch single camera detail by ID.
 */
export async function fetchCameraByIdAction(id: string): Promise<CameraServiceResult<DigitalCamera>> {
  return await getCameraById(id);
}

/**
 * Server Action: Admin creates a new camera in fleet.
 * Enforces requireAdmin() server-side and revalidates cache.
 */
export async function createCameraAction(data: CameraInput): Promise<CameraServiceResult<DigitalCamera>> {
  const result = await createCamera(data);
  if (result.success) {
    revalidatePath('/', 'layout');
  }
  return result;
}

/**
 * Server Action: Admin updates existing camera details.
 * Enforces requireAdmin() server-side and revalidates cache.
 */
export async function updateCameraAction(
  id: string,
  data: Partial<CameraInput>
): Promise<CameraServiceResult<DigitalCamera>> {
  const result = await updateCamera(id, data);
  if (result.success) {
    revalidatePath('/', 'layout');
  }
  return result;
}

/**
 * Server Action: Admin updates operational status (AVAILABLE, MAINTENANCE, DAMAGED, etc.).
 * Enforces requireAdmin() server-side and revalidates cache.
 */
export async function setCameraStatusAction(
  id: string,
  status: CameraStatus,
  notes?: string
): Promise<CameraServiceResult<DigitalCamera>> {
  const result = await setCameraStatus(id, status, notes);
  if (result.success) {
    revalidatePath('/', 'layout');
  }
  return result;
}

/**
 * Server Action: Admin updates camera condition rating (Excellent, Good, Fair, Damaged).
 * Enforces requireAdmin() server-side and revalidates cache.
 */
export async function setCameraConditionAction(
  id: string,
  condition: CameraCondition
): Promise<CameraServiceResult<DigitalCamera>> {
  const result = await setCameraCondition(id, condition);
  if (result.success) {
    revalidatePath('/', 'layout');
  }
  return result;
}

/**
 * Server Action: Admin decommissions/deletes a camera.
 * Enforces requireAdmin() server-side and blocks deletion if active rentals exist.
 */
export async function deleteCameraAction(id: string): Promise<CameraServiceResult> {
  const result = await deleteCamera(id);
  if (result.success) {
    revalidatePath('/', 'layout');
  }
  return result;
}
