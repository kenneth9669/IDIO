import { createClient } from '../supabase/server';
import { DigitalCameraRow, CameraCategory, CameraCondition, CameraStatus } from '../../types/database';
import { DigitalCamera, CameraSpecs } from '../../types';
import { validateCameraInput, CameraInput } from './cameraValidation';
import { requireAdmin } from '../auth';

export interface CameraServiceResult<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: string[];
}

/**
 * Maps a database row (`public.digital_cameras`) to the application domain `DigitalCamera` model.
 */
export function mapRowToCamera(row: DigitalCameraRow): DigitalCamera {
  return {
    id: row.id,
    serialNumber: row.serial_number,
    name: row.name,
    brand: row.brand as DigitalCamera['brand'],
    model: row.model,
    category: row.category as CameraCategory,
    dailyRate: Number(row.daily_rate_php),
    securityDeposit: Number(row.security_deposit_php),
    status: row.status as CameraStatus,
    condition: row.condition as CameraCondition,
    specs: row.specs as CameraSpecs,
    description: row.description,
    imageUrl: row.image_url,
    packageIncludes: row.package_includes || [],
    maintenanceNotes: row.maintenance_notes || undefined,
    totalRentalsCount: row.total_rentals_count || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Public/Customer Query: List cameras with optional filtering and search.
 * Enforces RLS via authenticated Supabase server client.
 */
export async function getCameras(filters?: {
  category?: string;
  status?: string;
  brand?: string;
  search?: string;
}): Promise<CameraServiceResult<DigitalCamera[]>> {
  try {
    const supabase = await createClient();
    let query = supabase.from('digital_cameras').select('*').order('created_at', { ascending: false });

    if (filters?.category && filters.category !== 'ALL') {
      query = query.eq('category', filters.category);
    }
    if (filters?.status && filters.status !== 'ALL') {
      query = query.eq('status', filters.status);
    }
    if (filters?.brand && filters.brand !== 'ALL') {
      query = query.eq('brand', filters.brand);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, message: 'Failed to retrieve cameras catalog from database.', errors: [error.message] };
    }

    let cameras = (data as DigitalCameraRow[])
      .filter(r => !r.name.toLowerCase().includes('unauthorized') && !r.id.startsWith('CAM-X'))
      .map(mapRowToCamera);

    // Apply client-side text search if provided
    if (filters?.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      cameras = cameras.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.brand.toLowerCase().includes(q) ||
          c.model.toLowerCase().includes(q) ||
          c.serialNumber.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q)
      );
    }

    return { success: true, message: 'Cameras retrieved successfully.', data: cameras };
  } catch (err: any) {
    return { success: false, message: err.message || 'Error connecting to database.', errors: [err.message] };
  }
}

/**
 * Public/Customer Query: Get detailed camera record by inventory ID.
 */
export async function getCameraById(id: string): Promise<CameraServiceResult<DigitalCamera>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('digital_cameras')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return { success: false, message: `Camera with ID '${id}' not found.` };
    }

    return { success: true, message: 'Camera retrieved.', data: mapRowToCamera(data as DigitalCameraRow) };
  } catch (err: any) {
    return { success: false, message: err.message || 'Error fetching camera record.' };
  }
}

/**
 * Admin Mutation: Register a new digital camera into the fleet.
 * Enforces server-side `requireAdmin()`, input validation, and unique constraints.
 */
export async function createCamera(input: CameraInput): Promise<CameraServiceResult<DigitalCamera>> {
  // 1. Enforce Server-Side Admin Authorization
  await requireAdmin();

  // 2. Validate Input Data Server-Side
  const validation = validateCameraInput(input, false);
  if (!validation.isValid) {
    return {
      success: false,
      message: `Validation failed: ${validation.errors.join(' ')}`,
      errors: validation.errors
    };
  }

  try {
    const supabase = await createClient({ requireAuth: true });

    // Generate clean inventory ID if not provided (e.g. CAM-009)
    let inventoryId = input.id?.trim();
    if (!inventoryId) {
      const { count } = await supabase.from('digital_cameras').select('*', { count: 'exact', head: true });
      inventoryId = `CAM-${String((count || 0) + 1).padStart(3, '0')}`;
    }

    // Default specifications fallback
    const defaultSpecs = {
      sensor: 'High-Performance Sensor',
      megapixels: '24.0 MP',
      videoResolution: '4K 30p',
      isoRange: '100 - 25,600',
      lensMountOrKit: 'Kit Lens Included',
      screen: '3.0-inch LCD',
      connectivity: 'Wi-Fi & Bluetooth',
      batteryLife: 'Approx. 400 shots',
      weight: '500g',
      ...input.specs
    };

    const rowData = {
      id: inventoryId,
      serial_number: input.serialNumber.trim(),
      name: input.name.trim(),
      brand: input.brand.trim(),
      model: input.model.trim(),
      category: input.category,
      daily_rate_php: input.dailyRate,
      security_deposit_php: input.securityDeposit,
      status: input.status || 'AVAILABLE',
      condition: input.condition || 'Excellent',
      specs: defaultSpecs,
      description: input.description?.trim() || `${input.name} digital camera available for rent in Butuan City.`,
      image_url: input.imageUrl?.trim() || 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80',
      package_includes: input.packageIncludes || [
        'Camera Body',
        '2x Rechargeable Batteries',
        '1x 128GB SD Card',
        'Battery Charger',
        'Shoulder Bag'
      ],
      maintenance_notes: input.maintenanceNotes || null,
      total_rentals_count: 0
    };

    const { data, error } = await supabase
      .from('digital_cameras')
      .insert(rowData)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        // Unique violation (inventory ID primary key or serial number unique key)
        if (error.message.includes('serial_number') || error.message.includes('serial')) {
          return { success: false, message: `Serial number '${input.serialNumber}' is already registered to another camera.` };
        }
        if (error.message.includes('digital_cameras_pkey') || error.message.includes('id') || error.message.includes('Key (id)')) {
          return { success: false, message: `Camera inventory ID '${inventoryId}' already exists in inventory.` };
        }
        return { success: false, message: `Camera record already exists with matching unique identifiers.` };
      }
      return { success: false, message: `Database error: ${error.message}`, errors: [error.message] };
    }

    return {
      success: true,
      message: `Camera ${data.name} (${data.id}) successfully added to fleet.`,
      data: mapRowToCamera(data as DigitalCameraRow)
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'Server error creating camera record.' };
  }
}

/**
 * Admin Mutation: Update camera details and technical specifications.
 * Enforces server-side `requireAdmin()` and status lifecycle guardrails.
 */
export async function updateCamera(id: string, input: Partial<CameraInput>): Promise<CameraServiceResult<DigitalCamera>> {
  // 1. Enforce Server-Side Admin Authorization
  await requireAdmin();

  // 2. Validate Partial Input Data
  const validation = validateCameraInput(input, true);
  if (!validation.isValid) {
    return {
      success: false,
      message: `Validation failed: ${validation.errors.join(' ')}`,
      errors: validation.errors
    };
  }

  try {
    const supabase = await createClient({ requireAuth: true });

    // Check existing camera
    const { data: existing, error: fetchErr } = await supabase
      .from('digital_cameras')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) {
      return { success: false, message: `Camera '${id}' not found.` };
    }

    // Guardrail: Cannot manually flip a CHECKED_OUT camera directly to AVAILABLE
    if (existing.status === 'CHECKED_OUT' && input.status === 'AVAILABLE') {
      return {
        success: false,
        message: 'Cannot manually set status to AVAILABLE for a currently checked-out camera. Please process through the Return Inspection workflow.'
      };
    }

    const updates: Partial<DigitalCameraRow> = {
      updated_at: new Date().toISOString()
    };

    if (input.name !== undefined) updates.name = input.name.trim();
    if (input.brand !== undefined) updates.brand = input.brand.trim();
    if (input.model !== undefined) updates.model = input.model.trim();
    if (input.serialNumber !== undefined) updates.serial_number = input.serialNumber.trim();
    if (input.category !== undefined) updates.category = input.category;
    if (input.dailyRate !== undefined) updates.daily_rate_php = input.dailyRate;
    if (input.securityDeposit !== undefined) updates.security_deposit_php = input.securityDeposit;
    if (input.status !== undefined) updates.status = input.status;
    if (input.condition !== undefined) updates.condition = input.condition;
    if (input.description !== undefined) updates.description = input.description.trim();
    if (input.imageUrl !== undefined) updates.image_url = input.imageUrl.trim();
    if (input.specs !== undefined) updates.specs = { ...(existing.specs as any), ...input.specs };
    if (input.packageIncludes !== undefined) updates.package_includes = input.packageIncludes;
    if (input.maintenanceNotes !== undefined) updates.maintenance_notes = input.maintenanceNotes;

    const { data, error } = await supabase
      .from('digital_cameras')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        if (error.message.includes('serial_number') || error.message.includes('serial')) {
          return { success: false, message: `Serial number '${input.serialNumber}' is already in use by another camera.` };
        }
        return { success: false, message: `Camera inventory unique constraint violation.` };
      }
      return { success: false, message: `Database update error: ${error.message}`, errors: [error.message] };
    }

    return {
      success: true,
      message: `Camera ${data.name} (${data.id}) updated successfully.`,
      data: mapRowToCamera(data as DigitalCameraRow)
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'Server error updating camera record.' };
  }
}

/**
 * Admin Mutation: Set operational status (e.g. AVAILABLE, MAINTENANCE, DAMAGED).
 */
export async function setCameraStatus(
  id: string,
  status: CameraStatus,
  notes?: string
): Promise<CameraServiceResult<DigitalCamera>> {
  await requireAdmin();

  if (!status || !['AVAILABLE', 'RESERVED', 'CHECKED_OUT', 'MAINTENANCE', 'DAMAGED'].includes(status)) {
    return { success: false, message: `Invalid status '${status}'.` };
  }

  return await updateCamera(id, {
    status,
    maintenanceNotes: notes !== undefined ? notes : undefined
  });
}

/**
 * Admin Mutation: Set physical condition grade (Excellent, Good, Fair, Damaged).
 */
export async function setCameraCondition(
  id: string,
  condition: CameraCondition
): Promise<CameraServiceResult<DigitalCamera>> {
  await requireAdmin();

  if (!condition || !['Excellent', 'Good', 'Fair', 'Damaged'].includes(condition)) {
    return { success: false, message: `Invalid condition grade '${condition}'.` };
  }

  return await updateCamera(id, { condition });
}

/**
 * Admin Mutation: Decommission/delete a camera asset.
 * Enforces rule: Cannot delete a camera with an active rental.
 */
export async function deleteCamera(id: string): Promise<CameraServiceResult> {
  await requireAdmin();

  try {
    const supabase = await createClient({ requireAuth: true });

    // Check if camera has active reservations or rentals
    const { data: activeRentals, error: checkErr } = await supabase
      .from('reservations')
      .select('id, reference_no, status')
      .eq('camera_id', id)
      .in('status', ['PENDING_APPROVAL', 'APPROVED']);

    if (!checkErr && activeRentals && activeRentals.length > 0) {
      return {
        success: false,
        message: `Cannot delete camera: It has ${activeRentals.length} active reservation(s) pending or approved (${activeRentals.map(r => r.reference_no).join(', ')}).`
      };
    }

    const { error } = await supabase.from('digital_cameras').delete().eq('id', id);

    if (error) {
      return { success: false, message: `Failed to delete camera: ${error.message}` };
    }

    return { success: true, message: `Camera '${id}' decommissioned from fleet.` };
  } catch (err: any) {
    return { success: false, message: err.message || 'Server error deleting camera.' };
  }
}
