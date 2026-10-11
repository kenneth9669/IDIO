import { CameraCategory, CameraCondition, CameraStatus } from '../../types/database';

export const VALID_CATEGORIES: CameraCategory[] = ['Mirrorless', 'Compact', 'DSLR', 'Vlog & Creator'];
export const VALID_CONDITIONS: CameraCondition[] = ['Excellent', 'Good', 'Fair', 'Damaged'];
export const VALID_STATUSES: CameraStatus[] = ['AVAILABLE', 'RESERVED', 'CHECKED_OUT', 'MAINTENANCE', 'DAMAGED'];

export interface CameraInput {
  id?: string;
  serialNumber: string;
  name: string;
  brand: string;
  model: string;
  category: CameraCategory;
  dailyRate: number;
  securityDeposit: number;
  status: CameraStatus;
  condition: CameraCondition;
  description: string;
  imageUrl: string;
  specs?: {
    sensor?: string;
    megapixels?: string;
    videoResolution?: string;
    isoRange?: string;
    lensMountOrKit?: string;
    screen?: string;
    connectivity?: string;
    batteryLife?: string;
    weight?: string;
  };
  packageIncludes?: string[];
  maintenanceNotes?: string | null;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates camera input data server-side against database constraints and domain rules.
 */
export function validateCameraInput(input: Partial<CameraInput>, isUpdate = false): ValidationResult {
  const errors: string[] = [];

  // Required string validations (when creating, or when present on update)
  if (!isUpdate || input.name !== undefined) {
    if (!input.name || typeof input.name !== 'string' || !input.name.trim()) {
      errors.push('Camera name is required and cannot be empty.');
    } else if (input.name.trim().length > 200) {
      errors.push('Camera name cannot exceed 200 characters.');
    }
  }

  if (!isUpdate || input.brand !== undefined) {
    if (!input.brand || typeof input.brand !== 'string' || !input.brand.trim()) {
      errors.push('Camera brand is required.');
    } else if (input.brand.trim().length > 100) {
      errors.push('Camera brand cannot exceed 100 characters.');
    }
  }

  if (!isUpdate || input.model !== undefined) {
    if (!input.model || typeof input.model !== 'string' || !input.model.trim()) {
      errors.push('Camera model is required.');
    } else if (input.model.trim().length > 100) {
      errors.push('Camera model cannot exceed 100 characters.');
    }
  }

  if (!isUpdate || input.serialNumber !== undefined) {
    if (!input.serialNumber || typeof input.serialNumber !== 'string' || !input.serialNumber.trim()) {
      errors.push('Camera serial number is required.');
    } else if (input.serialNumber.trim().length > 100) {
      errors.push('Camera serial number cannot exceed 100 characters.');
    }
  }

  if (input.id !== undefined && input.id.trim().length > 30) {
    errors.push('Camera inventory ID cannot exceed 30 characters.');
  }

  // Enum validations
  if (!isUpdate || input.category !== undefined) {
    if (!input.category || !VALID_CATEGORIES.includes(input.category)) {
      errors.push(`Invalid camera category '${input.category}'. Allowed categories: ${VALID_CATEGORIES.join(', ')}.`);
    }
  }

  if (!isUpdate || input.condition !== undefined) {
    if (!input.condition || !VALID_CONDITIONS.includes(input.condition)) {
      errors.push(`Invalid camera condition grade '${input.condition}'. Allowed conditions: ${VALID_CONDITIONS.join(', ')}.`);
    }
  }

  if (!isUpdate || input.status !== undefined) {
    if (!input.status || !VALID_STATUSES.includes(input.status)) {
      errors.push(`Invalid operational status '${input.status}'. Allowed statuses: ${VALID_STATUSES.join(', ')}.`);
    }
  }

  // Numeric rate and deposit validations
  if (!isUpdate || input.dailyRate !== undefined) {
    if (typeof input.dailyRate !== 'number' || isNaN(input.dailyRate) || input.dailyRate <= 0) {
      errors.push('Daily rental rate (PHP) must be a positive number greater than ₱0.');
    }
  }

  if (!isUpdate || input.securityDeposit !== undefined) {
    if (typeof input.securityDeposit !== 'number' || isNaN(input.securityDeposit) || input.securityDeposit < 0) {
      errors.push('Security deposit (PHP) must be zero or a positive number.');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}
