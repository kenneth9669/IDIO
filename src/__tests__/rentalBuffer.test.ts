import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkCameraAvailability, getBookedDateRanges } from '../lib/availabilityEngine';
import { calculateRentalDays, formatDate, addDays } from '../lib/utils';
import { DigitalCamera, Reservation } from '../types';
import { createReservation } from '../lib/reservations/reservationService';
import { CURRENT_AGREEMENT_VERSION } from '../data/rentalAgreement';
import { ProfileRow, DigitalCameraRow, ReservationRow } from '../types/database';

// Mock Supabase Server Client
vi.mock('../lib/supabase/server', () => {
  return {
    createClient: vi.fn()
  };
});

import { createClient } from '../lib/supabase/server';

// Mock customer profile
const mockCustomerProfile: ProfileRow = {
  id: 'c3333333-3333-3333-3333-333333333333',
  role: 'CUSTOMER',
  full_name: 'Maria Santos',
  email: 'maria@example.com',
  phone: '0917-123-4567',
  avatar_url: null,
  barangay: 'Libertad',
  street_address: 'Purok 4',
  city: 'Butuan City',
  province: 'Agusan del Norte',
  id_type: "Driver's License",
  id_number: 'D01-22-123456',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

// Mock camera row
const sampleCameraRow: DigitalCameraRow = {
  id: 'CAM-SONY-A7IV',
  serial_number: 'SN-SONY-998811',
  name: 'Sony Alpha a7 IV Mirrorless Camera',
  brand: 'Sony',
  model: 'ILCE-7M4',
  category: 'Mirrorless',
  daily_rate_php: 1500,
  security_deposit_php: 3000,
  status: 'AVAILABLE',
  condition: 'Excellent',
  specs: {} as any,
  description: 'Flagship full-frame hybrid camera.',
  image_url: '/cameras/sony-a7iv.jpg',
  package_includes: ['1x Camera Body', '1x Lens', '2x Batteries'],
  maintenance_notes: null,
  total_rentals_count: 5,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z'
};

// Mock reservation row
const sampleReservationRow: ReservationRow = {
  id: 'r1111111-1111-1111-1111-111111111111',
  reference_no: 'IDIO-2026-001',
  customer_id: mockCustomerProfile.id,
  camera_id: 'CAM-SONY-A7IV',
  start_date: '2026-10-20',
  end_date: '2026-10-22',
  rental_period: '[2026-10-20,2026-10-23)',
  blocked_period: undefined,
  agreement_version: 'v1.0',
  total_days: 3,
  daily_rate_snapshot: 1500,
  subtotal_php: 4500,
  security_deposit_php: 3000,
  total_amount_php: 7500,
  purpose: 'Commercial documentary shoot at Butuan National Museum',
  status: 'APPROVED',
  rejection_reason: null,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z'
};

function setupMockSupabase({
  user = mockCustomerProfile,
  camera = sampleCameraRow,
  reservations = [] as any[],
  insertReservationError = null as any
}: {
  user?: ProfileRow | null;
  camera?: DigitalCameraRow | null;
  reservations?: any[];
  insertReservationError?: any;
} = {}) {
  const mockClient = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: user ? { user: { id: user.id } } : { user: null },
        error: null
      })
    },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: user, error: null })
            })
          })
        };
      }
      if (table === 'digital_cameras') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: camera, error: null })
            })
          })
        };
      }
      if (table === 'reservations') {
        return {
          select: vi.fn().mockImplementation(() => {
            const chain: any = {
              eq: vi.fn().mockImplementation(() => {
                const innerChain: any = {
                  in: vi.fn().mockReturnValue({
                    lte: vi.fn().mockReturnValue({
                      gte: vi.fn().mockImplementation(() => {
                        const dateChain: any = {
                          neq: vi.fn().mockResolvedValue({ data: reservations, error: null }),
                          then: (resolve: any) => resolve({ data: reservations, error: null })
                        };
                        return dateChain;
                      })
                    })
                  })
                };
                return innerChain;
              })
            };
            return chain;
          }),
          insert: vi.fn().mockImplementation((payload: any) => {
            if (insertReservationError) {
              return {
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: null, error: insertReservationError })
                })
              };
            }
            return {
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    ...sampleReservationRow,
                    ...payload,
                    id: 'new-res-uuid-999',
                    created_at: new Date().toISOString()
                  },
                  error: null
                })
              })
            };
          })
        };
      }
      if (table === 'rental_agreement_acceptances') {
        return {
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
            })
          })
        };
      }
      if (table === 'payments') {
        return {
          insert: vi.fn().mockResolvedValue({ data: null, error: null })
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockResolvedValue({ data: null, error: null })
      };
    })
  };

  (createClient as any).mockResolvedValue(mockClient);
  return mockClient;
}

const makeTestCamera = (overrides?: Partial<DigitalCamera>): DigitalCamera => ({
  id: 'CAM-SONY-A7IV',
  serialNumber: 'SN-SONY-998811',
  name: 'Sony Alpha a7 IV Mirrorless Camera',
  brand: 'Sony',
  model: 'ILCE-7M4',
  category: 'Mirrorless',
  dailyRate: 1500,
  securityDeposit: 3000,
  status: 'AVAILABLE',
  condition: 'Excellent',
  specs: {} as any,
  description: 'Flagship full-frame hybrid camera.',
  imageUrl: '/cameras/sony-a7iv.jpg',
  packageIncludes: ['1x Camera Body', '1x 28-70mm Lens', '2x Batteries'],
  maintenanceNotes: undefined,
  totalRentalsCount: 12,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides
});

const makeTestReservation = (overrides?: Partial<Reservation>): Reservation => ({
  id: 'res-uuid-001',
  referenceNo: 'IDIO-RES-20261020-001',
  customerId: 'cust-uuid-101',
  customerName: 'Maria Santos',
  customerEmail: 'maria@example.com',
  customerPhone: '09171234567',
  customerBarangay: 'Libertad',
  customerStreetAddress: 'Purok 4',
  idType: "Driver's License",
  idNumber: 'D01-22-123456',
  cameraId: 'CAM-SONY-A7IV',
  cameraName: 'Sony Alpha a7 IV Mirrorless Camera',
  cameraBrand: 'Sony',
  cameraCategory: 'Mirrorless',
  cameraSerial: 'SN-SONY-998811',
  cameraImageUrl: '/cameras/sony-a7iv.jpg',
  startDate: '2026-10-20',
  endDate: '2026-10-22',
  totalDays: 3,
  dailyRate: 1500,
  subtotal: 4500,
  securityDeposit: 3000,
  totalAmount: 7500,
  purpose: 'Commercial documentary shoot at Butuan National Museum',
  status: 'APPROVED',
  paymentStatus: 'PENDING',
  paymentMethod: 'CASH_PICKUP',
  depositStatus: 'HELD',
  agreementVersion: 'v1.0',
  createdAt: '2026-10-15T08:00:00Z',
  updatedAt: '2026-10-15T08:00:00Z',
  ...overrides
});

describe('IDIO — Camera Availability & Non-Conflicting Multiple Rentals', () => {
  describe('1. Multiple Non-Conflicting Rentals for Same Physical Camera', () => {
    const cam = makeTestCamera();
    // Customer A rents Camera A from October 20–22:
    const customerAReservation = makeTestReservation({
      customerId: 'cust-a',
      customerName: 'Customer A',
      referenceNo: 'RES-CUST-A-001',
      startDate: '2026-10-20',
      endDate: '2026-10-22',
      status: 'APPROVED'
    });

    it('allows Customer B to rent Camera A immediately following Customer A (October 23–25)', () => {
      // Customer B requests Oct 23–25:
      const checkCustomerB = checkCameraAvailability(cam, '2026-10-23', '2026-10-25', [customerAReservation]);
      expect(checkCustomerB.isAvailable).toBe(true);
      expect(checkCustomerB.reason).toBe('Available for your selected dates.');
    });

    it('allows Customer D to rent Camera A immediately preceding Customer A (October 17–19)', () => {
      // Preceding non-overlapping booking:
      const checkCustomerD = checkCameraAvailability(cam, '2026-10-17', '2026-10-19', [customerAReservation]);
      expect(checkCustomerD.isAvailable).toBe(true);
      expect(checkCustomerD.reason).toBe('Available for your selected dates.');
    });

    it('prevents Customer C from renting Camera A on dates overlapping Customer A (October 21–23)', () => {
      // Overlaps Customer A on Oct 21 and Oct 22:
      const checkCustomerC = checkCameraAvailability(cam, '2026-10-21', '2026-10-23', [customerAReservation]);
      expect(checkCustomerC.isAvailable).toBe(false);
      expect(checkCustomerC.reason).toContain('unavailable for your selected dates');
      expect(checkCustomerC.reason).toContain('Expected availability: Oct 23, 2026, subject to return and inspection.');
    });

    it('prevents overlapping booking on boundary day (October 22)', () => {
      // Starting on Customer A return date (Oct 22):
      const boundaryCheck = checkCameraAvailability(cam, '2026-10-22', '2026-10-24', [customerAReservation]);
      expect(boundaryCheck.isAvailable).toBe(false);
      expect(boundaryCheck.reason).toContain('unavailable for your selected dates');
    });

    it('prevents booking fully containing existing rental (October 19–25)', () => {
      const enclosingCheck = checkCameraAvailability(cam, '2026-10-19', '2026-10-25', [customerAReservation]);
      expect(enclosingCheck.isAvailable).toBe(false);
      expect(enclosingCheck.reason).toContain('unavailable for your selected dates');
    });

    it('allows both Customer A and Customer B reservations simultaneously and calculates calendar intervals accurately', () => {
      const customerBReservation = makeTestReservation({
        id: 'res-b-999',
        customerId: 'cust-b',
        customerName: 'Customer B',
        referenceNo: 'RES-CUST-B-002',
        startDate: '2026-10-23',
        endDate: '2026-10-25',
        status: 'APPROVED'
      });

      const allActive = [customerAReservation, customerBReservation];
      const ranges = getBookedDateRanges(cam.id, allActive);
      expect(ranges).toHaveLength(2);
      expect(ranges[0].startDate).toBe('2026-10-20');
      expect(ranges[0].endDate).toBe('2026-10-22');
      expect(ranges[1].startDate).toBe('2026-10-23');
      expect(ranges[1].endDate).toBe('2026-10-25');

      // Date after both (Oct 26) is available:
      const postBoth = checkCameraAvailability(cam, '2026-10-26', '2026-10-28', allActive);
      expect(postBoth.isAvailable).toBe(true);

      // Date in between is nonexistent since 22->23 is contiguous
    });
  });

  describe('2. Privacy Protection & Zero PII Exposure', () => {
    const cam = makeTestCamera();
    const sensitiveReservation = makeTestReservation({
      customerId: 'private-cust-uuid',
      customerName: 'Secret VIP Customer',
      customerEmail: 'vip@private.org',
      customerPhone: '0917-999-8888',
      referenceNo: 'CONFIDENTIAL-REF-777',
      startDate: '2026-10-20',
      endDate: '2026-10-22',
      status: 'APPROVED'
    });

    it('never leaks other customer name, phone, email, or private reference number in availability reason', () => {
      const result = checkCameraAvailability(cam, '2026-10-21', '2026-10-24', [sensitiveReservation]);
      expect(result.isAvailable).toBe(false);

      // Must not leak PII
      expect(result.reason).not.toContain('Secret VIP Customer');
      expect(result.reason).not.toContain('vip@private.org');
      expect(result.reason).not.toContain('0917-999-8888');
      expect(result.reason).not.toContain('CONFIDENTIAL-REF-777');

      // Must contain contextual guidance with expected availability date
      expect(result.reason).toBe(
        'This camera is unavailable for your selected dates. Expected availability: Oct 23, 2026, subject to return and inspection.'
      );
    });
  });

  describe('3. Overdue & Operational Status Safeguards', () => {
    const cam = makeTestCamera();

    it('keeps overdue checked-out camera strictly unavailable until returned and inspected', () => {
      // Overdue rental (ended in past relative to today, still CHECKED_OUT)
      const overdueRes = makeTestReservation({
        startDate: '2026-01-01',
        endDate: '2026-01-05',
        status: 'CHECKED_OUT'
      });

      const result = checkCameraAvailability(cam, '2026-11-01', '2026-11-03', [overdueRes]);
      expect(result.isAvailable).toBe(false);
      expect(result.reason).toContain('Availability has not yet been confirmed');
    });

    it('rejects reservation for MAINTENANCE camera with contextual message', () => {
      const maintenanceCam = makeTestCamera({ status: 'MAINTENANCE' });
      const result = checkCameraAvailability(maintenanceCam, '2026-11-01', '2026-11-03', []);
      expect(result.isAvailable).toBe(false);
      expect(result.reason).toBe('This camera is currently unavailable due to maintenance.');
    });

    it('rejects reservation for DAMAGED camera with contextual message', () => {
      const damagedCam = makeTestCamera({ status: 'DAMAGED' });
      const result = checkCameraAvailability(damagedCam, '2026-11-01', '2026-11-03', []);
      expect(result.isAvailable).toBe(false);
      expect(result.reason).toContain('damaged');
    });

    it('does not block dates when previous reservation is CANCELLED or REJECTED', () => {
      const cancelled = makeTestReservation({ status: 'CANCELLED', startDate: '2026-10-20', endDate: '2026-10-22' });
      const rejected = makeTestReservation({ status: 'REJECTED', startDate: '2026-10-20', endDate: '2026-10-22' });

      expect(checkCameraAvailability(cam, '2026-10-20', '2026-10-22', [cancelled]).isAvailable).toBe(true);
      expect(checkCameraAvailability(cam, '2026-10-20', '2026-10-22', [rejected]).isAvailable).toBe(true);
    });
  });

  describe('4. Concurrency Protection & Transaction Feedback', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('catches PostgreSQL exclusion constraint violation and returns clean contextual error', async () => {
      setupMockSupabase({
        user: mockCustomerProfile,
        camera: sampleCameraRow,
        reservations: [],
        insertReservationError: {
          code: '23P01',
          message: 'conflicting key value violates exclusion constraint "prevent_camera_reservation_overlap"'
        }
      });

      const submission = {
        cameraId: 'CAM-SONY-A7IV',
        startDate: '2026-10-20',
        endDate: '2026-10-22',
        purpose: 'Creative portrait session in Butuan City',
        paymentMethod: 'CASH_PICKUP' as const,
        agreementAccepted: true,
        agreementVersion: CURRENT_AGREEMENT_VERSION
      };

      const result = await createReservation(submission);
      expect(result.success).toBe(false);
      expect(result.message).toContain('This camera is no longer available for the selected dates');
    });

    it('calculates rental duration and charges accurately for contractual days without artificial buffer inflation', () => {
      const days = calculateRentalDays('2026-10-20', '2026-10-22');
      expect(days).toBe(3); // Oct 20, 21, 22
      const cam = makeTestCamera();
      const subtotal = cam.dailyRate * days;
      expect(subtotal).toBe(4500); // 3 * 1500
    });
  });
});
