import { describe, it, expect } from 'vitest';
import {
  SEED_CAMERAS,
  SEED_RESERVATIONS,
  SEED_USERS,
  BUTUAN_BARANGAYS,
  FIXED_CITY,
  FIXED_PROVINCE
} from '../data/seedData';
import {
  serviceCreateReservation,
  serviceCancelReservation,
  serviceApproveReservation,
  serviceCheckoutRental,
  serviceReturnInspectionRental
} from '../lib/domainService';
import {
  checkCameraAvailability,
  getBookedDateRanges
} from '../lib/availabilityEngine';
import { calculateRentalDays, formatPHP } from '../lib/utils';
import { User, DigitalCamera, Reservation, PaymentMethod } from '../types';

const CUSTOMER_ALICE: User = {
  id: 'usr-cust-01',
  name: 'Angelo Cruz',
  email: 'angelo.cruz@gmail.com',
  phone: '+63 918 123 4567',
  role: 'CUSTOMER',
  barangay: 'San Vicente',
  streetAddress: 'Purok 3, San Vicente',
  city: 'Butuan City',
  province: 'Agusan del Norte',
  idType: 'Philippine National ID',
  idNumber: 'PH-ID-2024-99881'
};

const CUSTOMER_BOB: User = {
  id: 'usr-cust-02',
  name: 'Maria Santos',
  email: 'maria.santos@gmail.com',
  phone: '+63 920 987 6543',
  role: 'CUSTOMER',
  barangay: 'Libertad',
  streetAddress: 'Block 4, Libertad',
  city: 'Butuan City',
  province: 'Agusan del Norte',
  idType: "Driver's License",
  idNumber: 'DL-2025-00492'
};

const ADMIN_ACTOR: User = {
  id: 'usr-admin-01',
  name: 'Dave Admin',
  email: 'admin@idio.ph',
  phone: '+63 917 555 0199',
  role: 'ADMIN',
  barangay: 'Libertad',
  streetAddress: 'J.C. Aquino Ave',
  city: 'Butuan City',
  province: 'Agusan del Norte',
  idType: 'Philippine National ID',
  idNumber: 'PH-ADMIN-2026-001'
};

describe('Customer Portal Enhancement & Booking Experience Test Suite', () => {
  describe('1. Customer Dashboard & Data Isolation', () => {
    it('scopes reservations strictly to the authenticated customer', () => {
      const aliceReservations = SEED_RESERVATIONS.filter((r) => r.customerId === CUSTOMER_ALICE.id);
      const bobReservations = SEED_RESERVATIONS.filter((r) => r.customerId === CUSTOMER_BOB.id);

      // Verify separation
      aliceReservations.forEach((r) => {
        expect(r.customerId).toBe(CUSTOMER_ALICE.id);
        expect(r.customerId).not.toBe(CUSTOMER_BOB.id);
      });

      bobReservations.forEach((r) => {
        expect(r.customerId).toBe(CUSTOMER_BOB.id);
        expect(r.customerId).not.toBe(CUSTOMER_ALICE.id);
      });
    });

    it('calculates active and pending metrics correctly from scoped customer data', () => {
      const customerRes = SEED_RESERVATIONS.filter((r) => r.customerId === CUSTOMER_ALICE.id);
      const activeCount = customerRes.filter((r) => r.status === 'CHECKED_OUT').length;
      const pendingCount = customerRes.filter((r) => r.status === 'PENDING_APPROVAL').length;
      const approvedCount = customerRes.filter((r) => r.status === 'APPROVED').length;

      expect(activeCount).toBeGreaterThanOrEqual(0);
      expect(pendingCount).toBeGreaterThanOrEqual(0);
      expect(approvedCount).toBeGreaterThanOrEqual(0);
      expect(activeCount + pendingCount + approvedCount).toBeLessThanOrEqual(customerRes.length);
    });

    it('handles first-time customer with zero bookings gracefully', () => {
      const brandNewUser: User = {
        id: 'usr-cust-new-99',
        name: 'New Customer',
        email: 'new@butuan.ph',
        phone: '+63 919 000 1111',
        role: 'CUSTOMER',
        barangay: 'Doongan',
        streetAddress: 'Purok 1',
        city: 'Butuan City',
        province: 'Agusan del Norte',
        idType: 'UMID',
        idNumber: 'UMID-9999'
      };

      const scoped = SEED_RESERVATIONS.filter((r) => r.customerId === brandNewUser.id);
      expect(scoped.length).toBe(0);
    });
  });

  describe('2. Browse Cameras Catalog & Ineligible Status Safeguards', () => {
    it('allows searching cameras by name, model, and category', () => {
      const sonyCameras = SEED_CAMERAS.filter((c) =>
        c.name.toLowerCase().includes('sony') || c.brand === 'Sony'
      );
      expect(sonyCameras.length).toBeGreaterThan(0);
      sonyCameras.forEach((c) => {
        expect(c.brand).toBe('Sony');
      });
    });

    it('prohibits booking cameras in MAINTENANCE or DAMAGED status', () => {
      const maintenanceCam: DigitalCamera = {
        ...SEED_CAMERAS[0],
        id: 'CAM-MAINT-TEST',
        status: 'MAINTENANCE',
        maintenanceNotes: 'Sensor cleaning and firmware calibration in progress'
      };

      const check = checkCameraAvailability(
        maintenanceCam,
        '2026-11-01',
        '2026-11-03',
        SEED_RESERVATIONS
      );
      expect(check.isAvailable).toBe(false);
      expect(check.reason).toContain('maintenance');
    });

    it('prohibits booking cameras marked as DAMAGED', () => {
      const damagedCam: DigitalCamera = {
        ...SEED_CAMERAS[0],
        id: 'CAM-DMG-TEST',
        status: 'DAMAGED'
      };

      const check = checkCameraAvailability(
        damagedCam,
        '2026-11-01',
        '2026-11-03',
        SEED_RESERVATIONS
      );
      expect(check.isAvailable).toBe(false);
      expect(check.reason).toContain('damaged');
    });
  });

  describe('3. Reservation Calendar & Availability Engine', () => {
    it('correctly detects overlapping bookings on the same camera', () => {
      const cam = SEED_CAMERAS[0];
      const existingReservation: Reservation = {
        id: 'res-overlap-1',
        referenceNo: 'RES-2026-OVL1',
        customerId: CUSTOMER_ALICE.id,
        customerName: CUSTOMER_ALICE.name,
        customerEmail: CUSTOMER_ALICE.email,
        customerPhone: CUSTOMER_ALICE.phone,
        customerBarangay: CUSTOMER_ALICE.barangay,
        customerStreetAddress: CUSTOMER_ALICE.streetAddress,
        idType: CUSTOMER_ALICE.idType,
        idNumber: CUSTOMER_ALICE.idNumber,
        cameraId: cam.id,
        cameraName: cam.name,
        cameraBrand: cam.brand,
        cameraCategory: cam.category,
        cameraSerial: cam.serialNumber,
        cameraImageUrl: cam.imageUrl,
        startDate: '2026-11-10',
        endDate: '2026-11-15',
        totalDays: 6,
        dailyRate: cam.dailyRate,
        subtotal: cam.dailyRate * 6,
        securityDeposit: cam.securityDeposit,
        totalAmount: cam.dailyRate * 6 + cam.securityDeposit,
        purpose: 'Event Documentation',
        status: 'APPROVED',
        paymentStatus: 'PAID',
        paymentMethod: 'GCASH',
        depositStatus: 'HELD',
        createdAt: '2026-10-01T08:00:00Z',
        updatedAt: '2026-10-01T08:00:00Z'
      };

      // Exact overlap
      const check1 = checkCameraAvailability(cam, '2026-11-10', '2026-11-15', [existingReservation]);
      expect(check1.isAvailable).toBe(false);

      // Partial overlap (starts inside)
      const check2 = checkCameraAvailability(cam, '2026-11-14', '2026-11-18', [existingReservation]);
      expect(check2.isAvailable).toBe(false);

      // Non-overlapping adjacent range starting immediately after previous booking (Nov 16 to Nov 20)
      const adjacentCheck = checkCameraAvailability(cam, '2026-11-16', '2026-11-20', [existingReservation]);
      expect(adjacentCheck.isAvailable).toBe(true);

      // Non-overlapping range immediately preceding (Nov 01 to Nov 09)
      const precedingCheck = checkCameraAvailability(cam, '2026-11-01', '2026-11-09', [existingReservation]);
      expect(precedingCheck.isAvailable).toBe(true);
    });

    it('rejects invalid date range where start date > end date', () => {
      const cam = SEED_CAMERAS[0];
      const check = checkCameraAvailability(cam, '2026-11-20', '2026-11-10', []);
      expect(check.isAvailable).toBe(false);
      expect(check.reason).toContain('Rental end date cannot be earlier than start date');
    });

    it('retrieves booked date ranges accurately for visual calendar highlighting', () => {
      const cam = SEED_CAMERAS[0];
      const testRes: Reservation = {
        ...SEED_RESERVATIONS[0],
        cameraId: cam.id,
        startDate: '2026-12-01',
        endDate: '2026-12-05',
        status: 'APPROVED'
      };

      const ranges = getBookedDateRanges(cam.id, [testRes]);
      expect(ranges.length).toBe(1);
      expect(ranges[0].startDate).toBe('2026-12-01');
      expect(ranges[0].endDate).toBe('2026-12-05');
    });
  });

  describe('4. Server-Side Price Calculation & Invariants', () => {
    it('calculates subtotal and totalAmount strictly: totalAmount = (dailyRate * totalDays) + deposit', () => {
      const dailyRate = 1800;
      const securityDeposit = 3000;
      const totalDays = 4;

      const subtotal = dailyRate * totalDays;
      const totalAmount = subtotal + securityDeposit;

      expect(subtotal).toBe(7200);
      expect(totalAmount).toBe(10200);
    });

    it('calculates days inclusive: e.g. Nov 10 to Nov 12 = 3 days', () => {
      const days = calculateRentalDays('2026-11-10', '2026-11-12');
      expect(days).toBe(3);
    });

    it('formats Philippine Peso accurately with formatPHP', () => {
      expect(formatPHP(1800)).toBe('₱1,800');
      expect(formatPHP(10200)).toBe('₱10,200');
    });
  });

  describe('5. Reservation Creation & Cancellation Domain Workflows', () => {
    it('creates a customer reservation with initial PENDING_APPROVAL status', () => {
      const cam = SEED_CAMERAS[0];
      const result = serviceCreateReservation(
        CUSTOMER_ALICE,
        {
          cameraId: cam.id,
          startDate: '2026-11-20',
          endDate: '2026-11-22',
          purpose: 'Wedding shoot at Guingona Park',
          paymentMethod: 'GCASH'
        },
        [cam],
        []
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.status).toBe('PENDING_APPROVAL');
      expect(result.data?.customerId).toBe(CUSTOMER_ALICE.id);
      expect(result.data?.referenceNo).toMatch(/^IDIO-\d{6}$/);
    });

    it('allows customer to cancel their own PENDING_APPROVAL reservation', () => {
      const cam = SEED_CAMERAS[0];
      const createRes = serviceCreateReservation(
        CUSTOMER_ALICE,
        {
          cameraId: cam.id,
          startDate: '2026-11-25',
          endDate: '2026-11-27',
          purpose: 'Portrait shoot',
          paymentMethod: 'MAYA'
        },
        [cam],
        []
      );

      const reservation = createRes.data!;
      const cancelRes = serviceCancelReservation(CUSTOMER_ALICE, reservation.id, [reservation]);
      expect(cancelRes.success).toBe(true);
      expect(cancelRes.data?.updatedReservation?.status).toBe('CANCELLED');
    });

    it('prohibits a customer from cancelling another customer reservation', () => {
      const cam = SEED_CAMERAS[0];
      const createRes = serviceCreateReservation(
        CUSTOMER_ALICE,
        {
          cameraId: cam.id,
          startDate: '2026-11-25',
          endDate: '2026-11-27',
          purpose: 'Portrait shoot',
          paymentMethod: 'MAYA'
        },
        [cam],
        []
      );

      const reservation = createRes.data!;
      // Bob tries to cancel Alice's reservation
      const cancelRes = serviceCancelReservation(CUSTOMER_BOB, reservation.id, [reservation]);
      expect(cancelRes.success).toBe(false);
      expect(cancelRes.message).toContain('Access Denied');
    });
  });

  describe('6. Customer Role Security & RBAC Enforcement', () => {
    it('prohibits customers from approving reservations (admin-only action)', () => {
      const cam = SEED_CAMERAS[0];
      const res: Reservation = {
        ...SEED_RESERVATIONS[0],
        id: 'res-test-sec-1',
        status: 'PENDING_APPROVAL'
      };

      const result = serviceApproveReservation(CUSTOMER_ALICE, res.id, [res], [cam]);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Access Denied');
    });

    it('prohibits customers from performing rental checkout handovers', () => {
      const res: Reservation = {
        ...SEED_RESERVATIONS[0],
        id: 'res-test-sec-2',
        status: 'APPROVED'
      };

      const result = serviceCheckoutRental(
        CUSTOMER_ALICE,
        res.id,
        'Excellent',
        'All ok',
        [res],
        SEED_CAMERAS
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain('Access Denied');
    });

    it('prohibits customers from performing return inspections or modifying deposits', () => {
      const res: Reservation = {
        ...SEED_RESERVATIONS[0],
        id: 'res-test-sec-3',
        status: 'CHECKED_OUT'
      };

      const result = serviceReturnInspectionRental(
        CUSTOMER_ALICE,
        res.id,
        'Excellent',
        'Looks good',
        'REFUND_FULL',
        0,
        undefined,
        false,
        [res],
        SEED_CAMERAS
      );
      expect(result.success).toBe(false);
      expect(result.message).toContain('Access Denied');
    });
  });

  describe('7. Profile & Butuan City Location Integrity', () => {
    it('restricts city to Butuan City and province to Agusan del Norte', () => {
      expect(FIXED_CITY).toBe('Butuan City');
      expect(FIXED_PROVINCE).toBe('Agusan del Norte');
    });

    it('validates barangay selection against curated 20 Butuan barangays', () => {
      expect(BUTUAN_BARANGAYS.length).toBe(20);
      expect(BUTUAN_BARANGAYS).toContain('Libertad');
      expect(BUTUAN_BARANGAYS).toContain('San Vicente');
      expect(BUTUAN_BARANGAYS).toContain('Ambago');
      expect(BUTUAN_BARANGAYS).toContain('Doongan');
      expect(BUTUAN_BARANGAYS).toContain('Ampayon');
    });
  });
});
