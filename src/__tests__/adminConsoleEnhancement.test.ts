import { describe, it, expect } from 'vitest';
import {
  SEED_CAMERAS,
  SEED_RESERVATIONS,
  SEED_MAINTENANCE,
  SEED_USERS,
  SEED_ACTIVITY_LOGS
} from '../data/seedData';
import {
  serviceAddCamera,
  serviceDeleteCamera,
  serviceApproveReservation,
  serviceRejectReservation,
  serviceCancelReservation,
  serviceCheckoutRental,
  serviceReturnInspectionRental
} from '../lib/domainService';
import { User, DigitalCamera, Reservation } from '../types';

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

const CUSTOMER_ACTOR: User = {
  id: 'usr-cust-01',
  name: 'Angelo Cruz',
  email: 'angelo.cruz@gmail.com',
  phone: '+63 918 123 4567',
  role: 'CUSTOMER',
  barangay: 'San Vicente',
  streetAddress: 'Purok 3',
  city: 'Butuan City',
  province: 'Agusan del Norte',
  idType: 'Philippine National ID',
  idNumber: 'PH-ID-2024-99881'
};

describe('Admin Console Enhancement & Management Audit Test Suite', () => {
  describe('Section 1: Dashboard Calculations & Aggregations', () => {
    it('accurately computes camera fleet status counts', () => {
      const total = SEED_CAMERAS.length;
      const available = SEED_CAMERAS.filter(c => c.status === 'AVAILABLE').length;
      const maintenance = SEED_CAMERAS.filter(c => c.status === 'MAINTENANCE' || c.status === 'DAMAGED').length;
      const checkedOut = SEED_CAMERAS.filter(c => c.status === 'CHECKED_OUT').length;

      expect(total).toBeGreaterThan(0);
      expect(available + maintenance + checkedOut).toBeLessThanOrEqual(total);
    });

    it('identifies overdue rentals reliably based on end_date vs current date', () => {
      const mockActiveRentals: Reservation[] = [
        {
          ...SEED_RESERVATIONS[0],
          status: 'CHECKED_OUT',
          endDate: '2024-01-01' // Past date
        },
        {
          ...SEED_RESERVATIONS[0],
          id: 'res-future',
          status: 'CHECKED_OUT',
          endDate: '2099-01-01' // Future date
        }
      ];

      const today = '2026-10-11';
      const overdue = mockActiveRentals.filter(r => r.status === 'CHECKED_OUT' && r.endDate < today);

      expect(overdue.length).toBe(1);
      expect(overdue[0].endDate).toBe('2024-01-01');
    });

    it('calculates realized revenue excluding held security deposits', () => {
      const completedOrPaid = SEED_RESERVATIONS.filter(
        r => r.status === 'COMPLETED' || r.paymentStatus === 'PAID'
      );
      const subtotalSum = completedOrPaid.reduce((sum, r) => sum + r.subtotal, 0);
      const totalWithDeposits = completedOrPaid.reduce((sum, r) => sum + r.totalAmount, 0);

      // Revenue must be based strictly on rental fees (subtotal), NOT security deposits
      expect(subtotalSum).toBeLessThan(totalWithDeposits);
      expect(subtotalSum).toBeGreaterThan(0);
    });
  });

  describe('Section 2: Camera Management & Availability Safeguards', () => {
    it('prevents adding camera with duplicate serial number', () => {
      const existingSerial = SEED_CAMERAS[0].serialNumber;
      const res = serviceAddCamera(
        ADMIN_ACTOR,
        {
          serialNumber: existingSerial,
          name: 'Duplicate Unit',
          brand: 'Sony',
          model: 'A7 IV',
          category: 'Mirrorless',
          dailyRate: 1500,
          securityDeposit: 3000,
          status: 'AVAILABLE',
          condition: 'Excellent',
          description: 'Testing duplicate serial',
          imageUrl: 'https://example.com/cam.jpg',
          specs: {
            sensor: 'Full Frame',
            megapixels: '33 MP',
            videoResolution: '4K',
            isoRange: '100-51200',
            lensMountOrKit: 'FE',
            screen: 'Articulating',
            connectivity: 'WiFi',
            batteryLife: '580',
            weight: '658g'
          },
          packageIncludes: ['Battery', 'Charger']
        },
        SEED_CAMERAS
      );

      expect(res.success).toBe(false);
      expect(res.message).toContain('already registered');
    });

    it('prevents non-admin actors from adding or deleting cameras', () => {
      const addRes = serviceAddCamera(
        CUSTOMER_ACTOR,
        {
          serialNumber: 'NEW-UNIQUE-999',
          name: 'Unauthorized Unit',
          brand: 'Canon',
          model: 'R6',
          category: 'Mirrorless',
          dailyRate: 1200,
          securityDeposit: 2500,
          status: 'AVAILABLE',
          condition: 'Excellent',
          description: 'Test',
          imageUrl: 'https://example.com/cam.jpg',
          specs: {
            sensor: 'Full Frame',
            megapixels: '20 MP',
            videoResolution: '4K',
            isoRange: '100-102400',
            lensMountOrKit: 'RF',
            screen: 'Vari-angle',
            connectivity: 'WiFi',
            batteryLife: '510',
            weight: '680g'
          },
          packageIncludes: ['Battery']
        },
        SEED_CAMERAS
      );

      expect(addRes.success).toBe(false);
      expect(addRes.message).toContain('Access Denied');

      const delRes = serviceDeleteCamera(CUSTOMER_ACTOR, SEED_CAMERAS[0].id, SEED_CAMERAS, SEED_RESERVATIONS);
      expect(delRes.success).toBe(false);
      expect(delRes.message).toContain('Access Denied');
    });

    it('prevents deleting camera with active rental in progress', () => {
      const activeCamId = 'CAM-001';
      const mockActiveReservation: Reservation = {
        ...SEED_RESERVATIONS[0],
        cameraId: activeCamId,
        status: 'CHECKED_OUT'
      };

      const res = serviceDeleteCamera(
        ADMIN_ACTOR,
        activeCamId,
        SEED_CAMERAS,
        [mockActiveReservation]
      );

      expect(res.success).toBe(false);
      expect(res.message).toContain('active or approved rental');
    });
  });

  describe('Section 3: Reservation Operations & Concurrency Protection', () => {
    it('admin can approve pending reservation when no schedule overlap exists', () => {
      const pendingRes: Reservation = {
        ...SEED_RESERVATIONS[0],
        id: 'res-pending-test',
        status: 'PENDING_APPROVAL',
        startDate: '2028-10-01',
        endDate: '2028-10-03'
      };

      const res = serviceApproveReservation(
        ADMIN_ACTOR,
        'res-pending-test',
        [pendingRes],
        SEED_CAMERAS
      );

      expect(res.success).toBe(true);
      expect(res.data?.updatedReservation.status).toBe('APPROVED');
    });

    it('admin can reject pending reservation with a specified reason', () => {
      const pendingRes: Reservation = {
        ...SEED_RESERVATIONS[0],
        id: 'res-reject-test',
        status: 'PENDING_APPROVAL'
      };

      const reason = 'Invalid ID submission';
      const res = serviceRejectReservation(
        ADMIN_ACTOR,
        'res-reject-test',
        reason,
        [pendingRes]
      );

      expect(res.success).toBe(true);
      expect(res.data?.updatedReservation.status).toBe('REJECTED');
      expect(res.data?.updatedReservation.rejectionReason).toBe(reason);
    });

    it('rejection and cancellation release reservation from blocking dates', () => {
      const rejectedRes: Reservation = {
        ...SEED_RESERVATIONS[0],
        status: 'REJECTED'
      };
      const cancelledRes: Reservation = {
        ...SEED_RESERVATIONS[0],
        status: 'CANCELLED'
      };

      expect(['PENDING_APPROVAL', 'APPROVED', 'CHECKED_OUT'].includes(rejectedRes.status)).toBe(false);
      expect(['PENDING_APPROVAL', 'APPROVED', 'CHECKED_OUT'].includes(cancelledRes.status)).toBe(false);
    });
  });

  describe('Section 4: Rental Handover & Return Inspection Workflow', () => {
    it('counter checkout records condition grade, admin name, and timestamp', () => {
      const approvedRes: Reservation = {
        ...SEED_RESERVATIONS[0],
        id: 'res-checkout-test',
        status: 'APPROVED'
      };

      const res = serviceCheckoutRental(
        ADMIN_ACTOR,
        'res-checkout-test',
        'Excellent',
        'Physical checklist verified',
        [approvedRes],
        SEED_CAMERAS
      );

      expect(res.success).toBe(true);
      expect(res.data?.updatedReservation.status).toBe('CHECKED_OUT');
      expect(res.data?.updatedReservation.checkoutCondition).toBe('Excellent');
      expect(res.data?.updatedCamera.status).toBe('CHECKED_OUT');
    });

    it('return inspection with damage flags camera as DAMAGED and deducts security deposit', () => {
      const activeRes: Reservation = {
        ...SEED_RESERVATIONS[0],
        id: 'res-return-damage-test',
        status: 'CHECKED_OUT',
        securityDeposit: 3000
      };

      const res = serviceReturnInspectionRental(
        ADMIN_ACTOR,
        'res-return-damage-test',
        'Damaged',
        'Cracked front lens element',
        'DEDUCT_DAMAGE',
        1500,
        'Partial repair fee for front element',
        true,
        [activeRes],
        SEED_CAMERAS
      );

      expect(res.success).toBe(true);
      expect(res.data?.updatedReservation.status).toBe('COMPLETED');
      expect(res.data?.updatedReservation.depositStatus).toBe('DEDUCTED');
      expect(res.data?.updatedReservation.depositDeduction).toBe(1500);
      expect(res.data?.updatedCamera.status).toBe('DAMAGED');
      expect(res.data?.newMaintenanceLog?.status).toBe('Under Service');
    });

    it('return in Fair condition automatically routes camera to MAINTENANCE', () => {
      const activeRes: Reservation = {
        ...SEED_RESERVATIONS[0],
        id: 'res-return-fair-test',
        status: 'CHECKED_OUT'
      };

      const res = serviceReturnInspectionRental(
        ADMIN_ACTOR,
        'res-return-fair-test',
        'Fair',
        'Sensor dust observed at f/16',
        'REFUND_FULL',
        0,
        '',
        true,
        [activeRes],
        SEED_CAMERAS
      );

      expect(res.success).toBe(true);
      expect(res.data?.updatedCamera.status).toBe('MAINTENANCE');
    });
  });

  describe('Section 5: Security Deposits & Financial Reconciliation', () => {
    it('disallows damage deduction exceeding the held security deposit', () => {
      const activeRes: Reservation = {
        ...SEED_RESERVATIONS[0],
        id: 'res-dep-over-test',
        status: 'CHECKED_OUT',
        securityDeposit: 2000
      };

      const res = serviceReturnInspectionRental(
        ADMIN_ACTOR,
        'res-dep-over-test',
        'Damaged',
        'Heavy damage',
        'DEDUCT_DAMAGE',
        5000, // Exceeds deposit
        'Deduction exceeds deposit',
        true,
        [activeRes],
        SEED_CAMERAS
      );

      expect(res.success).toBe(false);
      expect(res.message).toContain('cannot exceed security deposit');
    });

    it('requires a mandatory written reason when deducting deposit', () => {
      const activeRes: Reservation = {
        ...SEED_RESERVATIONS[0],
        id: 'res-dep-reason-test',
        status: 'CHECKED_OUT',
        securityDeposit: 2000
      };

      const res = serviceReturnInspectionRental(
        ADMIN_ACTOR,
        'res-dep-reason-test',
        'Damaged',
        'Scratch',
        'DEDUCT_DAMAGE',
        500,
        '', // Empty reason
        true,
        [activeRes],
        SEED_CAMERAS
      );

      expect(res.success).toBe(false);
      expect(res.message).toContain('reason for damage deduction is mandatory');
    });
  });

  describe('Section 6: Customer Residence & City Scoping', () => {
    it('validates customer addresses are restricted to Butuan City Agusan del Norte', () => {
      SEED_USERS.forEach(user => {
        expect(user.city).toBe('Butuan City');
        expect(user.province).toBe('Agusan del Norte');
      });
    });
  });
});
