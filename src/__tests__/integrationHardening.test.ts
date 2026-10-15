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
  serviceApproveReservation,
  serviceRejectReservation,
  serviceCancelReservation,
  serviceCheckoutRental,
  serviceReturnInspectionRental,
  validateRole,
  validateOwnershipOrAdmin,
  validateStateTransition
} from '../lib/domainService';
import {
  checkCameraAvailability,
  getBookedDateRanges
} from '../lib/availabilityEngine';
import { calculateRentalDays, formatPHP, generateReferenceCode } from '../lib/utils';
import { User, DigitalCamera, Reservation, Rental, PaymentAndDeposit } from '../types';

// Actors
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
  name: 'Dave Admin (Owner)',
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

describe('IDIO Integration Hardening & End-to-End Rental Lifecycle Suite', () => {
  describe('Phase 1: Customer Discovery & Booking Initiation', () => {
    it('customer browses fleet and verifies only valid cameras are available', () => {
      const activeCameras = SEED_CAMERAS.filter((c) => c.status === 'AVAILABLE');
      expect(activeCameras.length).toBeGreaterThan(0);

      // Verify no maintenance or damaged cameras are marked as available
      activeCameras.forEach((cam) => {
        expect(cam.status).not.toBe('MAINTENANCE');
        expect(cam.status).not.toBe('DAMAGED');
      });
    });

    it('creates a new reservation with server-enforced pricing calculations', () => {
      const camera = SEED_CAMERAS.find((c) => c.id === 'CAM-001') || SEED_CAMERAS[0];
      const startDate = '2026-11-01';
      const endDate = '2026-11-03';

      const createResult = serviceCreateReservation(
        CUSTOMER_ALICE,
        {
          cameraId: camera.id,
          startDate,
          endDate,
          purpose: 'Pre-nuptial photo session at Masao Beach',
          paymentMethod: 'GCASH'
        },
        [camera],
        []
      );

      expect(createResult.success).toBe(true);
      const res = createResult.data!;

      // Verify server math
      const expectedDays = 3; // Nov 1, 2, 3 = 3 days inclusive
      const expectedSubtotal = camera.dailyRate * expectedDays;
      const expectedTotal = expectedSubtotal + camera.securityDeposit;

      expect(res.totalDays).toBe(expectedDays);
      expect(res.subtotal).toBe(expectedSubtotal);
      expect(res.securityDeposit).toBe(camera.securityDeposit);
      expect(res.totalAmount).toBe(expectedTotal);
      expect(res.status).toBe('PENDING_APPROVAL');
      expect(res.customerId).toBe(CUSTOMER_ALICE.id);
    });

    it('prevents concurrent overlapping reservations for the same camera', () => {
      const camera = SEED_CAMERAS[0];
      const activeReservation: Reservation = {
        id: 'res-concurrent-1',
        referenceNo: 'IDIO-112233',
        customerId: CUSTOMER_ALICE.id,
        customerName: CUSTOMER_ALICE.name,
        customerEmail: CUSTOMER_ALICE.email,
        customerPhone: CUSTOMER_ALICE.phone,
        customerBarangay: CUSTOMER_ALICE.barangay,
        customerStreetAddress: CUSTOMER_ALICE.streetAddress,
        idType: CUSTOMER_ALICE.idType,
        idNumber: CUSTOMER_ALICE.idNumber,
        cameraId: camera.id,
        cameraName: camera.name,
        cameraBrand: camera.brand,
        cameraCategory: camera.category,
        cameraSerial: camera.serialNumber,
        cameraImageUrl: camera.imageUrl,
        startDate: '2026-11-10',
        endDate: '2026-11-15',
        totalDays: 6,
        dailyRate: camera.dailyRate,
        subtotal: camera.dailyRate * 6,
        securityDeposit: camera.securityDeposit,
        totalAmount: camera.dailyRate * 6 + camera.securityDeposit,
        purpose: 'Corporate event',
        status: 'PENDING_APPROVAL',
        paymentStatus: 'PAID',
        paymentMethod: 'GCASH',
        depositStatus: 'HELD',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Customer Bob attempts to reserve overlapping dates (Nov 12 - 14)
      const bobResult = serviceCreateReservation(
        CUSTOMER_BOB,
        {
          cameraId: camera.id,
          startDate: '2026-11-12',
          endDate: '2026-11-14',
          purpose: 'Travel vlog',
          paymentMethod: 'MAYA'
        },
        [camera],
        [activeReservation]
      );

      expect(bobResult.success).toBe(false);
      expect(bobResult.message).toContain('unavailable for your selected dates');
    });
  });

  describe('Phase 2: Admin Approval & Counter Dispatch Lifecycle', () => {
    it('admin approves pending reservation after verifying customer details', () => {
      const camera = SEED_CAMERAS[0];
      const pendingRes: Reservation = {
        id: 'res-to-approve-1',
        referenceNo: 'IDIO-778899',
        customerId: CUSTOMER_ALICE.id,
        customerName: CUSTOMER_ALICE.name,
        customerEmail: CUSTOMER_ALICE.email,
        customerPhone: CUSTOMER_ALICE.phone,
        customerBarangay: CUSTOMER_ALICE.barangay,
        customerStreetAddress: CUSTOMER_ALICE.streetAddress,
        idType: CUSTOMER_ALICE.idType,
        idNumber: CUSTOMER_ALICE.idNumber,
        cameraId: camera.id,
        cameraName: camera.name,
        cameraBrand: camera.brand,
        cameraCategory: camera.category,
        cameraSerial: camera.serialNumber,
        cameraImageUrl: camera.imageUrl,
        startDate: '2026-11-20',
        endDate: '2026-11-22',
        totalDays: 3,
        dailyRate: camera.dailyRate,
        subtotal: camera.dailyRate * 3,
        securityDeposit: camera.securityDeposit,
        totalAmount: camera.dailyRate * 3 + camera.securityDeposit,
        purpose: 'Portrait shoot',
        status: 'PENDING_APPROVAL',
        paymentStatus: 'PAID',
        paymentMethod: 'GCASH',
        depositStatus: 'HELD',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const approveResult = serviceApproveReservation(
        ADMIN_ACTOR,
        pendingRes.id,
        [pendingRes],
        [camera]
      );

      expect(approveResult.success).toBe(true);
      expect(approveResult.data?.updatedReservation.status).toBe('APPROVED');
    });

    it('admin conducts counter checkout inspection and hands over equipment', () => {
      const camera = SEED_CAMERAS[0];
      const approvedRes: Reservation = {
        id: 'res-to-checkout-1',
        referenceNo: 'IDIO-445566',
        customerId: CUSTOMER_ALICE.id,
        customerName: CUSTOMER_ALICE.name,
        customerEmail: CUSTOMER_ALICE.email,
        customerPhone: CUSTOMER_ALICE.phone,
        customerBarangay: CUSTOMER_ALICE.barangay,
        customerStreetAddress: CUSTOMER_ALICE.streetAddress,
        idType: CUSTOMER_ALICE.idType,
        idNumber: CUSTOMER_ALICE.idNumber,
        cameraId: camera.id,
        cameraName: camera.name,
        cameraBrand: camera.brand,
        cameraCategory: camera.category,
        cameraSerial: camera.serialNumber,
        cameraImageUrl: camera.imageUrl,
        startDate: '2026-11-20',
        endDate: '2026-11-22',
        totalDays: 3,
        dailyRate: camera.dailyRate,
        subtotal: camera.dailyRate * 3,
        securityDeposit: camera.securityDeposit,
        totalAmount: camera.dailyRate * 3 + camera.securityDeposit,
        purpose: 'Portrait shoot',
        status: 'APPROVED',
        paymentStatus: 'PAID',
        paymentMethod: 'GCASH',
        depositStatus: 'HELD',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const checkoutResult = serviceCheckoutRental(
        ADMIN_ACTOR,
        approvedRes.id,
        'Excellent',
        'Kit verified complete: camera body, kit lens, 1x battery, 128GB SD card, neck strap',
        [approvedRes],
        [camera]
      );

      expect(checkoutResult.success).toBe(true);
      expect(checkoutResult.data?.updatedReservation.status).toBe('CHECKED_OUT');
      expect(checkoutResult.data?.updatedCamera.status).toBe('CHECKED_OUT');
    });
  });

  describe('Phase 3: Return Inspection & Deposit Settlement', () => {
    it('admin processes equipment return with full deposit refund on pristine condition', () => {
      const camera: DigitalCamera = { ...SEED_CAMERAS[0], status: 'CHECKED_OUT' };
      const checkedOutRes: Reservation = {
        id: 'res-to-return-1',
        referenceNo: 'IDIO-991122',
        customerId: CUSTOMER_ALICE.id,
        customerName: CUSTOMER_ALICE.name,
        customerEmail: CUSTOMER_ALICE.email,
        customerPhone: CUSTOMER_ALICE.phone,
        customerBarangay: CUSTOMER_ALICE.barangay,
        customerStreetAddress: CUSTOMER_ALICE.streetAddress,
        idType: CUSTOMER_ALICE.idType,
        idNumber: CUSTOMER_ALICE.idNumber,
        cameraId: camera.id,
        cameraName: camera.name,
        cameraBrand: camera.brand,
        cameraCategory: camera.category,
        cameraSerial: camera.serialNumber,
        cameraImageUrl: camera.imageUrl,
        startDate: '2026-11-20',
        endDate: '2026-11-22',
        totalDays: 3,
        dailyRate: camera.dailyRate,
        subtotal: camera.dailyRate * 3,
        securityDeposit: camera.securityDeposit,
        totalAmount: camera.dailyRate * 3 + camera.securityDeposit,
        purpose: 'Portrait shoot',
        status: 'CHECKED_OUT',
        paymentStatus: 'PAID',
        paymentMethod: 'GCASH',
        depositStatus: 'HELD',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const returnResult = serviceReturnInspectionRental(
        ADMIN_ACTOR,
        checkedOutRes.id,
        'Excellent',
        'Optical sensor clean, mechanical shutter tested, all accessories accounted for.',
        'REFUND_FULL',
        0,
        undefined,
        false,
        [checkedOutRes],
        [camera]
      );

      expect(returnResult.success).toBe(true);
      expect(returnResult.data?.updatedReservation.status).toBe('COMPLETED');
      expect(returnResult.data?.updatedReservation.depositStatus).toBe('REFUNDED');
      expect(returnResult.data?.updatedCamera.status).toBe('AVAILABLE');
    });

    it('admin processes equipment return with damage deduction when camera condition is degraded', () => {
      const camera: DigitalCamera = { ...SEED_CAMERAS[0], status: 'CHECKED_OUT' };
      const checkedOutRes: Reservation = {
        id: 'res-to-return-dmg',
        referenceNo: 'IDIO-991133',
        customerId: CUSTOMER_BOB.id,
        customerName: CUSTOMER_BOB.name,
        customerEmail: CUSTOMER_BOB.email,
        customerPhone: CUSTOMER_BOB.phone,
        customerBarangay: CUSTOMER_BOB.barangay,
        customerStreetAddress: CUSTOMER_BOB.streetAddress,
        idType: CUSTOMER_BOB.idType,
        idNumber: CUSTOMER_BOB.idNumber,
        cameraId: camera.id,
        cameraName: camera.name,
        cameraBrand: camera.brand,
        cameraCategory: camera.category,
        cameraSerial: camera.serialNumber,
        cameraImageUrl: camera.imageUrl,
        startDate: '2026-11-20',
        endDate: '2026-11-22',
        totalDays: 3,
        dailyRate: camera.dailyRate,
        subtotal: camera.dailyRate * 3,
        securityDeposit: 3000,
        totalAmount: camera.dailyRate * 3 + 3000,
        purpose: 'Field shoot',
        status: 'CHECKED_OUT',
        paymentStatus: 'PAID',
        paymentMethod: 'MAYA',
        depositStatus: 'HELD',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const deductionAmount = 1200;
      const deductionReason = 'Scratched UV filter and chipped lens cap';

      const returnResult = serviceReturnInspectionRental(
        ADMIN_ACTOR,
        checkedOutRes.id,
        'Fair',
        'Filter damaged, sensor fine. Camera flagged for routine maintenance.',
        'DEDUCT_DAMAGE',
        deductionAmount,
        deductionReason,
        true, // flag maintenance
        [checkedOutRes],
        [camera]
      );

      expect(returnResult.success).toBe(true);
      expect(returnResult.data?.updatedReservation.status).toBe('COMPLETED');
      expect(returnResult.data?.updatedReservation.depositStatus).toBe('DEDUCTED');
      expect(returnResult.data?.updatedReservation.depositDeduction).toBe(deductionAmount);
      expect(returnResult.data?.updatedCamera.status).toBe('MAINTENANCE');
    });
  });

  describe('Phase 4: Security Invariants & Role Boundaries', () => {
    it('customer cannot access admin actions', () => {
      const check = validateRole(CUSTOMER_ALICE, ['ADMIN'], 'Admin Counter Dispatch');
      expect(check.success).toBe(false);
      expect(check.message).toContain('Access Denied');
    });

    it('customer cannot modify another customer resource', () => {
      const check = validateOwnershipOrAdmin(CUSTOMER_ALICE, CUSTOMER_BOB.id, 'Edit Profile');
      expect(check.success).toBe(false);
      expect(check.message).toContain('Access Denied');
    });

    it('admin has elevated access across customer resources', () => {
      const check = validateOwnershipOrAdmin(ADMIN_ACTOR, CUSTOMER_BOB.id, 'Counter Verification');
      expect(check.success).toBe(true);
    });

    it('enforces finite state transitions (e.g. COMPLETED cannot transition to CHECKED_OUT)', () => {
      const invalid = validateStateTransition('COMPLETED', 'CHECKED_OUT');
      expect(invalid.success).toBe(false);
      expect(invalid.message).toContain('Invalid State Transition');
    });
  });
});
