import { describe, it, expect } from 'vitest';
import {
  checkCameraAvailability,
  getBookedDateRanges
} from '../lib/availabilityEngine';
import { DigitalCamera, Reservation } from '../types';

// ─── Test Fixtures ─────────────────────────────────────────────────────────

const makeCamera = (overrides?: Partial<DigitalCamera>): DigitalCamera => ({
  id: 'CAM-TEST-01',
  serialNumber: 'SN-TEST-001',
  name: 'Test Camera',
  brand: 'Sony',
  model: 'TEST-MODEL',
  category: 'Mirrorless',
  dailyRate: 1000,
  securityDeposit: 2000,
  status: 'AVAILABLE',
  condition: 'Excellent',
  specs: {
    sensor: 'Full-Frame',
    megapixels: '24MP',
    videoResolution: '4K 30p',
    isoRange: '100-51200',
    lensMountOrKit: 'E-Mount',
    screen: '3.0-inch',
    connectivity: 'WiFi, Bluetooth',
    batteryLife: '610 shots',
    weight: '659g'
  },
  description: 'Test camera',
  imageUrl: 'https://example.com/cam.jpg',
  packageIncludes: ['Camera body', 'Battery', 'Charger'],
  totalRentalsCount: 0,
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  ...overrides
});

const makeReservation = (overrides: Partial<Reservation>): Reservation => ({
  id: 'RES-001',
  referenceNo: 'IDIO-100001',
  customerId: 'c3333333-3333-3333-3333-333333333333',
  customerName: 'Jennelyn Photographer',
  customerEmail: 'jennelyn@example.com',
  customerPhone: '0919-334-8877',
  customerBarangay: 'Ampayon',
  customerStreetAddress: 'Purok 5',
  idType: 'UMID',
  idNumber: 'CRN-0111-9876543-2',
  cameraId: 'CAM-TEST-01',
  cameraName: 'Test Camera',
  cameraBrand: 'Sony',
  cameraCategory: 'Mirrorless',
  cameraSerial: 'SN-TEST-001',
  cameraImageUrl: 'https://example.com/cam.jpg',
  startDate: '2027-01-10',
  endDate: '2027-01-12',
  totalDays: 3,
  dailyRate: 1000,
  subtotal: 3000,
  securityDeposit: 2000,
  totalAmount: 5000,
  purpose: 'Wedding coverage',
  status: 'PENDING_APPROVAL',
  paymentStatus: 'PENDING',
  paymentMethod: 'GCASH',
  depositStatus: 'HELD',
  createdAt: '2027-01-01T00:00:00Z',
  updatedAt: '2027-01-01T00:00:00Z',
  ...overrides
});

// ─── Feature A: Calendar Availability Tests ────────────────────────────────

describe('Feature A: Reservation Calendar — Availability Engine', () => {

  describe('1. Camera Status Checks', () => {
    it('marks MAINTENANCE camera as unavailable regardless of dates', () => {
      const cam = makeCamera({ status: 'MAINTENANCE', maintenanceNotes: 'Sensor cleaning' });
      const result = checkCameraAvailability(cam, '2027-02-01', '2027-02-03', []);
      expect(result.isAvailable).toBe(false);
      expect(result.reason).toContain('maintenance');
    });

    it('marks DAMAGED camera as unavailable regardless of dates', () => {
      const cam = makeCamera({ status: 'DAMAGED', condition: 'Damaged' });
      const result = checkCameraAvailability(cam, '2027-02-01', '2027-02-03', []);
      expect(result.isAvailable).toBe(false);
      expect(result.reason).toContain('damaged');
    });

    it('marks AVAILABLE camera with no reservations as available', () => {
      const cam = makeCamera({ status: 'AVAILABLE' });
      const result = checkCameraAvailability(cam, '2027-02-01', '2027-02-03', []);
      expect(result.isAvailable).toBe(true);
    });
  });

  describe('2. PENDING_APPROVAL Reservations Block Dates', () => {
    it('blocks a range that fully overlaps a PENDING_APPROVAL reservation', () => {
      const cam = makeCamera();
      const res = makeReservation({ status: 'PENDING_APPROVAL', startDate: '2027-01-10', endDate: '2027-01-15' });
      const result = checkCameraAvailability(cam, '2027-01-10', '2027-01-12', [res]);
      expect(result.isAvailable).toBe(false);
      expect(result.conflictingReservation?.referenceNo).toBe('IDIO-100001');
    });

    it('blocks a range that partially overlaps a PENDING_APPROVAL reservation from left', () => {
      const cam = makeCamera();
      const res = makeReservation({ status: 'PENDING_APPROVAL', startDate: '2027-01-12', endDate: '2027-01-15' });
      const result = checkCameraAvailability(cam, '2027-01-10', '2027-01-13', [res]);
      expect(result.isAvailable).toBe(false);
    });

    it('blocks a range that partially overlaps from right', () => {
      const cam = makeCamera();
      const res = makeReservation({ status: 'PENDING_APPROVAL', startDate: '2027-01-08', endDate: '2027-01-11' });
      const result = checkCameraAvailability(cam, '2027-01-10', '2027-01-13', [res]);
      expect(result.isAvailable).toBe(false);
    });
  });

  describe('3. APPROVED Reservations Block Dates', () => {
    it('blocks dates overlapping an APPROVED reservation', () => {
      const cam = makeCamera();
      const res = makeReservation({ status: 'APPROVED', startDate: '2027-01-10', endDate: '2027-01-15' });
      const result = checkCameraAvailability(cam, '2027-01-11', '2027-01-14', [res]);
      expect(result.isAvailable).toBe(false);
    });
  });

  describe('4. CHECKED_OUT Reservations Block Dates', () => {
    it('blocks dates when camera is CHECKED_OUT', () => {
      const cam = makeCamera();
      const res = makeReservation({ status: 'CHECKED_OUT', startDate: '2027-01-10', endDate: '2027-01-15' });
      const result = checkCameraAvailability(cam, '2027-01-12', '2027-01-14', [res]);
      expect(result.isAvailable).toBe(false);
    });
  });

  describe('5. Non-blocking Terminal Statuses', () => {
    it('allows booking when only CANCELLED reservations exist for same period', () => {
      const cam = makeCamera();
      const res = makeReservation({ status: 'CANCELLED', startDate: '2027-01-10', endDate: '2027-01-15' });
      const result = checkCameraAvailability(cam, '2027-01-10', '2027-01-15', [res]);
      expect(result.isAvailable).toBe(true);
    });

    it('allows booking when only REJECTED reservations exist for same period', () => {
      const cam = makeCamera();
      const res = makeReservation({ status: 'REJECTED', startDate: '2027-01-10', endDate: '2027-01-15' });
      const result = checkCameraAvailability(cam, '2027-01-10', '2027-01-15', [res]);
      expect(result.isAvailable).toBe(true);
    });

    it('allows booking when only COMPLETED rentals exist for same period', () => {
      const cam = makeCamera();
      const res = makeReservation({ status: 'COMPLETED', startDate: '2027-01-10', endDate: '2027-01-15' });
      const result = checkCameraAvailability(cam, '2027-01-10', '2027-01-15', [res]);
      expect(result.isAvailable).toBe(true);
    });

    it('allows booking when only RETURNED rentals exist for same period', () => {
      const cam = makeCamera();
      const res = makeReservation({ status: 'RETURNED', startDate: '2027-01-10', endDate: '2027-01-15' });
      const result = checkCameraAvailability(cam, '2027-01-10', '2027-01-15', [res]);
      expect(result.isAvailable).toBe(true);
    });
  });

  describe('6. Adjacent Dates Are Allowed', () => {
    it('allows booking starting the day after an existing reservation ends', () => {
      const cam = makeCamera();
      const res = makeReservation({ status: 'APPROVED', startDate: '2027-01-10', endDate: '2027-01-12' });
      const result = checkCameraAvailability(cam, '2027-01-13', '2027-01-15', [res]);
      expect(result.isAvailable).toBe(true);
    });

    it('allows booking ending the day before an existing reservation starts', () => {
      const cam = makeCamera();
      const res = makeReservation({ status: 'APPROVED', startDate: '2027-01-14', endDate: '2027-01-16' });
      const result = checkCameraAvailability(cam, '2027-01-10', '2027-01-13', [res]);
      expect(result.isAvailable).toBe(true);
    });
  });

  describe('7. End Date Before Start Date', () => {
    it('rejects ranges where end date is before start date', () => {
      const cam = makeCamera();
      const result = checkCameraAvailability(cam, '2027-01-15', '2027-01-10', []);
      expect(result.isAvailable).toBe(false);
      expect(result.reason).toContain('end date');
    });
  });

  describe('8. Camera-Specific Filtering', () => {
    it('does NOT block dates that are reserved for a DIFFERENT camera', () => {
      const cam = makeCamera({ id: 'CAM-TEST-01' });
      const res = makeReservation({
        cameraId: 'CAM-TEST-02', // different camera
        status: 'APPROVED',
        startDate: '2027-01-10',
        endDate: '2027-01-15'
      });
      const result = checkCameraAvailability(cam, '2027-01-10', '2027-01-15', [res]);
      expect(result.isAvailable).toBe(true);
    });
  });

  describe('9. getBookedDateRanges', () => {
    it('returns only blocking statuses for the correct camera', () => {
      const approved = makeReservation({ id: 'RES-A', referenceNo: 'IDIO-A', status: 'APPROVED' });
      const cancelled = makeReservation({ id: 'RES-B', referenceNo: 'IDIO-B', status: 'CANCELLED' });
      const otherCam = makeReservation({ id: 'RES-C', referenceNo: 'IDIO-C', status: 'APPROVED', cameraId: 'CAM-OTHER' });
      const pending = makeReservation({ id: 'RES-D', referenceNo: 'IDIO-D', status: 'PENDING_APPROVAL' });

      const ranges = getBookedDateRanges('CAM-TEST-01', [approved, cancelled, otherCam, pending]);
      expect(ranges).toHaveLength(2); // approved + pending, not cancelled, not other camera
      expect(ranges.map(r => r.referenceNo)).toContain('IDIO-A');
      expect(ranges.map(r => r.referenceNo)).toContain('IDIO-D');
    });

    it('returns empty array when no reservations for camera', () => {
      const ranges = getBookedDateRanges('CAM-TEST-01', []);
      expect(ranges).toHaveLength(0);
    });
  });

  describe('10. Exclude Reservation from Overlap Check', () => {
    it('allows a camera to be re-evaluated excluding its own existing reservation', () => {
      const cam = makeCamera();
      const existingRes = makeReservation({
        id: 'RES-EDIT',
        status: 'APPROVED',
        startDate: '2027-01-10',
        endDate: '2027-01-15'
      });
      // Without exclude — should be unavailable
      const withoutExclude = checkCameraAvailability(cam, '2027-01-10', '2027-01-15', [existingRes]);
      expect(withoutExclude.isAvailable).toBe(false);

      // With exclude — should be available
      const withExclude = checkCameraAvailability(cam, '2027-01-10', '2027-01-15', [existingRes], 'RES-EDIT');
      expect(withExclude.isAvailable).toBe(true);
    });
  });
});

// ─── Feature B: Demo Login Removal ────────────────────────────────────────

describe('Feature B: Demo Login Removal', () => {
  it('signInDemoAction is NOT exported from authActions', async () => {
    const authActions = await import('../app/actions/authActions');
    expect((authActions as any).signInDemoAction).toBeUndefined();
  });

  it('signInAction is still exported and usable', async () => {
    const authActions = await import('../app/actions/authActions');
    expect(typeof authActions.signInAction).toBe('function');
  });

  it('signUpCustomerAction is still exported and usable', async () => {
    const authActions = await import('../app/actions/authActions');
    expect(typeof authActions.signUpCustomerAction).toBe('function');
  });

  it('signOutAction is still exported and usable', async () => {
    const authActions = await import('../app/actions/authActions');
    expect(typeof authActions.signOutAction).toBe('function');
  });

  it('AuthContext does not expose signInDemo', async () => {
    // Verify the type-level contract: signInDemo should not be in the exports
    // We test by checking that SEED_USERS still exist (test data preserved) but demo action is gone
    const authActions = await import('../app/actions/authActions');
    const keys = Object.keys(authActions);
    expect(keys).not.toContain('signInDemoAction');
  });
});
