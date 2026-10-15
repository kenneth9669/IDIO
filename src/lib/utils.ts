import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPHP(amount: number): string {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function formatDateTime(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

export function calculateRentalDays(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 1;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // inclusive days
  return diffDays > 0 ? diffDays : 1;
}

/**
 * Adds an integer number of calendar days to a YYYY-MM-DD date string.
 * Uses Date.UTC to guarantee timezone-independent date arithmetic.
 */
export function addDays(dateStr: string, days: number): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().split('T')[0];
}

/**
 * Subtracts an integer number of calendar days from a YYYY-MM-DD date string.
 */
export function subtractDays(dateStr: string, days: number): string {
  return addDays(dateStr, -days);
}

/**
 * Calculates the buffer end date (2 calendar days after the agreed return date).
 * Example: agreed return Oct 22 -> buffer ends Oct 24.
 */
export function getBufferEndDate(endDate: string): string {
  return addDays(endDate, 2);
}

/**
 * Checks if a test date falls inclusively between start and end (YYYY-MM-DD).
 */
export function isDateWithinRange(testDate: string, startDate: string, endDate: string): boolean {
  return testDate >= startDate && testDate <= endDate;
}


export function generateReferenceCode(prefix = 'IDIO'): string {
  const randomNum = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${randomNum}`;
}

export const CAMERA_STUDIO_IMAGES: Record<string, string> = {
  'CAM-001': '/cameras/CAM-001.jpg',
  'CAM-002': '/cameras/CAM-002.jpg',
  'CAM-003': '/cameras/CAM-003.jpg',
  'CAM-004': '/cameras/CAM-004.jpg',
  'CAM-005': '/cameras/CAM-005.jpg',
  'CAM-006': '/cameras/CAM-006.jpg',
  'CAM-007': '/cameras/CAM-007.jpg',
  'CAM-008': '/cameras/CAM-008.jpg',
};

export function getCameraImageUrl(cameraId?: string, fallbackUrl?: string): string {
  if (cameraId && CAMERA_STUDIO_IMAGES[cameraId]) {
    return CAMERA_STUDIO_IMAGES[cameraId];
  }
  if (fallbackUrl && (fallbackUrl.startsWith('http') || fallbackUrl.startsWith('/'))) {
    return fallbackUrl;
  }
  return '/cameras/placeholder.jpg';
}
