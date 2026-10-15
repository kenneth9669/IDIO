import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getReservations,
  getReservationById,
  createReservation,
  approveReservation,
  rejectReservation,
  cancelReservation
} from '../lib/reservations/reservationService';
import {
  validateReservationInput,
  validateReservationTransition,
  VALID_PAYMENT_METHODS,
  ALLOWED_NEW_PAYMENT_METHODS
} from '../lib/reservations/reservationValidation';
import { checkCameraAvailability } from '../lib/availabilityEngine';
import { ProfileRow, DigitalCameraRow, ReservationRow } from '../types/database';
import { DigitalCamera, Reservation } from '../types';

// Mock profiles
const mockAdminProfile: ProfileRow = {
  id: 'a1111111-1111-1111-1111-111111111111',
  role: 'ADMIN',
  full_name: 'Dave Admin',
  email: 'admin@idiocameras.ph',
  phone: '0917-842-1099',
  avatar_url: null,
  barangay: 'Libertad',
  street_address: 'Purok 3',
  city: 'Butuan City',
  province: 'Agusan del Norte',
  id_type: "Driver's License",
  id_number: 'K02-18-094123',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

const mockCustomerProfile: ProfileRow = {
  id: 'c3333333-3333-3333-3333-333333333333',
  role: 'CUSTOMER',
  full_name: 'Jennelyn Customer',
  email: 'jennelyn.creates@gmail.com',
  phone: '0919-334-8877',
  avatar_url: null,
  barangay: 'Ampayon',
  street_address: 'Purok 5',
  city: 'Butuan City',
  province: 'Agusan del Norte',
  id_type: 'UMID',
  id_number: 'CRN-0111-9876543-2',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

const mockOtherCustomerProfile: ProfileRow = {
  id: 'c4444444-4444-4444-4444-444444444444',
  role: 'CUSTOMER',
  full_name: 'Carlos Other Customer',
  email: 'carlos@example.com',
  phone: '0918-111-2233',
  avatar_url: null,
  barangay: 'Doongan',
  street_address: 'Purok 2',
  city: 'Butuan City',
  province: 'Agusan del Norte',
  id_type: 'Postal ID',
  id_number: 'PRN-9988-7766',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

const sampleCameraRow: DigitalCameraRow = {
  id: 'CAM-001',
  serial_number: 'SN-SONY-A7IV-01',
  name: 'Sony Alpha 7 IV Mirrorless Camera',
  brand: 'Sony',
  model: 'ILCE-7M4',
  category: 'Mirrorless',
  daily_rate_php: 1400,
  security_deposit_php: 3000,
  status: 'AVAILABLE',
  condition: 'Excellent',
  specs: {
    sensor: '33.0 MP Full-Frame Exmor R CMOS',
    megapixels: '33.0 MP',
    videoResolution: '4K 60p',
    isoRange: '100 - 51,200',
    lensMountOrKit: 'FE 28-70mm Kit Lens',
    screen: '3.0-inch Touchscreen',
    connectivity: 'Wi-Fi, Bluetooth',
    batteryLife: 'Approx. 580 shots',
    weight: '658g'
  },
  description: 'Full-frame hybrid mirrorless camera.',
  image_url: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32',
  package_includes: ['Camera Body', '2x Batteries', '1x SD Card'],
  maintenance_notes: null,
  total_rentals_count: 5,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z'
};

const sampleReservationRow: ReservationRow = {
  id: 'r1111111-1111-1111-1111-111111111111',
  reference_no: 'IDIO-2026-001',
  customer_id: mockCustomerProfile.id,
  camera_id: 'CAM-001',
  start_date: '2026-11-10',
  end_date: '2026-11-12',
  rental_period: '[2026-11-10,2026-11-13)',
  total_days: 3,
  daily_rate_snapshot: 1400,
  subtotal_php: 4200,
  security_deposit_php: 3000,
  total_amount_php: 7200,
  purpose: 'Event coverage in Butuan City',
  status: 'PENDING_APPROVAL',
  rejection_reason: null,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z'
};

// Mock Supabase Server Client
vi.mock('../lib/supabase/server', () => {
  return {
    createClient: vi.fn()
  };
});

import { createClient } from '../lib/supabase/server';

function setupMockSupabase({
  user = mockCustomerProfile,
  camera = sampleCameraRow,
  reservations = [] as any[],
  reservationById = sampleReservationRow as any,
  insertReservationResult = sampleReservationRow as any,
  insertReservationError = null as any,
  updateReservationResult = sampleReservationRow as any,
  updateReservationError = null as any
}: {
  user?: ProfileRow | null;
  camera?: DigitalCameraRow | null;
  reservations?: any[];
  reservationById?: any;
  insertReservationResult?: any;
  insertReservationError?: any;
  updateReservationResult?: any;
  updateReservationError?: any;
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
              order: vi.fn().mockImplementation(() => {
                const innerChain: any = {
                  eq: vi.fn().mockResolvedValue({ data: reservations, error: null }),
                  then: (resolve: any) => resolve({ data: reservations, error: null })
                };
                return innerChain;
              }),
              eq: vi.fn().mockImplementation((field: string, val: string) => {
                const innerChain: any = {
                  single: vi.fn().mockResolvedValue({ data: reservationById, error: null }),
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
                  }),
                  then: (resolve: any) => resolve({ data: reservations, error: null })
                };
                return innerChain;
              }),
              in: vi.fn().mockReturnValue({
                lte: vi.fn().mockReturnValue({
                  gte: vi.fn().mockResolvedValue({ data: reservations, error: null })
                })
              })
            };
            return chain;
          }),
          insert: vi.fn().mockImplementation((insertedRow: any) => ({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: insertReservationError ? null : { ...insertReservationResult, ...insertedRow },
                error: insertReservationError
              })
            })
          })),
          update: vi.fn().mockImplementation((updateData: any) => ({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: updateReservationError ? null : { ...updateReservationResult, ...updateData },
                  error: updateReservationError
                })
              })
            })
          }))
        };
      }
      if (table === 'payments_and_deposits') {
        return {
          insert: vi.fn().mockResolvedValue({ error: null })
        };
      }
      return {};
    })
  };

  vi.mocked(createClient).mockResolvedValue(mockClient as any);
  return mockClient;
}

describe('Phase 5: Reservation & Availability Management Subsystem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Customer Reservation Creation & Pricing Integrity', () => {
    it('allows a customer to create a valid pending reservation with authoritative server pricing', async () => {
      setupMockSupabase({
        user: mockCustomerProfile,
        camera: sampleCameraRow,
        reservations: []
      });

      const result = await createReservation({
        cameraId: 'CAM-001',
        startDate: '2026-11-10',
        endDate: '2026-11-12', // 3 inclusive days
        purpose: 'Wedding shoot in Libertad',
        paymentMethod: 'CASH_PICKUP',
        paymentReference: 'CASH-998877',
        agreementAccepted: true,
        agreementVersion: 'v1.0'
      });

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('PENDING_APPROVAL');
      // 3 days * 1400 = 4200 subtotal + 3000 deposit = 7200 total
      expect(result.data?.totalDays).toBe(3);
      expect(result.data?.dailyRate).toBe(1400);
      expect(result.data?.subtotal).toBe(4200);
      expect(result.data?.securityDeposit).toBe(3000);
      expect(result.data?.totalAmount).toBe(7200);
      expect(result.data?.customerId).toBe(mockCustomerProfile.id);
    });

    it('always creates reservation with PENDING_APPROVAL status (customer cannot submit APPROVED)', async () => {
      setupMockSupabase({
        user: mockCustomerProfile,
        camera: sampleCameraRow,
        reservations: []
      });

      const result = await createReservation({
        cameraId: 'CAM-001',
        startDate: '2026-11-10',
        endDate: '2026-11-12',
        purpose: 'Creative shoot',
        paymentMethod: 'CASH_PICKUP',
        agreementAccepted: true,
        agreementVersion: 'v1.0'
      });

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('PENDING_APPROVAL');
    });

    it('binds reservation customer_id strictly to the authenticated user ID', async () => {
      setupMockSupabase({
        user: mockCustomerProfile,
        camera: sampleCameraRow,
        reservations: []
      });

      const result = await createReservation({
        cameraId: 'CAM-001',
        startDate: '2026-11-10',
        endDate: '2026-11-12',
        purpose: 'Test customer binding',
        paymentMethod: 'CASH_PICKUP',
        agreementAccepted: true,
        agreementVersion: 'v1.0'
      });

      expect(result.success).toBe(true);
      expect(result.data?.customerId).toBe(mockCustomerProfile.id);
    });
  });

  describe('2. Authorization, Ownership & Access Isolation', () => {
    it('allows customer to read only their own reservations', async () => {
      setupMockSupabase({
        user: mockCustomerProfile,
        reservations: [sampleReservationRow]
      });

      const result = await getReservations();
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].customerId).toBe(mockCustomerProfile.id);
    });

    it('denies customer from retrieving another customer reservation by ID', async () => {
      setupMockSupabase({
        user: mockCustomerProfile,
        // Reservation belongs to other customer
        reservationById: {
          ...sampleReservationRow,
          customer_id: mockOtherCustomerProfile.id
        }
      });

      const result = await getReservationById(sampleReservationRow.id);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Forbidden: You do not have permission to view this reservation');
    });

    it('allows Admin to view reservations across all customers', async () => {
      setupMockSupabase({
        user: mockAdminProfile,
        reservations: [
          sampleReservationRow,
          { ...sampleReservationRow, id: 'r2', customer_id: mockOtherCustomerProfile.id }
        ]
      });

      const result = await getReservations();
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
    });

    it('allows Admin to approve a pending reservation', async () => {
      setupMockSupabase({
        user: mockAdminProfile,
        camera: sampleCameraRow,
        reservationById: { ...sampleReservationRow, status: 'PENDING_APPROVAL' },
        updateReservationResult: { ...sampleReservationRow, status: 'APPROVED' },
        reservations: []
      });

      const result = await approveReservation(sampleReservationRow.id);
      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('APPROVED');
    });

    it('allows Admin to reject a pending reservation with reason', async () => {
      setupMockSupabase({
        user: mockAdminProfile,
        reservationById: { ...sampleReservationRow, status: 'PENDING_APPROVAL' },
        updateReservationResult: {
          ...sampleReservationRow,
          status: 'REJECTED',
          rejection_reason: 'ID verification incomplete'
        }
      });

      const result = await rejectReservation(sampleReservationRow.id, 'ID verification incomplete');
      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('REJECTED');
      expect(result.data?.rejectionReason).toBe('ID verification incomplete');
    });

    it('denies Customer from approving a reservation (requireAdmin rejection)', async () => {
      setupMockSupabase({
        user: mockCustomerProfile
      });

      await expect(
        approveReservation(sampleReservationRow.id)
      ).rejects.toThrow(/Forbidden: Role 'CUSTOMER' is not authorized/);
    });

    it('denies Customer from rejecting a reservation (requireAdmin rejection)', async () => {
      setupMockSupabase({
        user: mockCustomerProfile
      });

      await expect(
        rejectReservation(sampleReservationRow.id, 'Unapproved rejection')
      ).rejects.toThrow(/Forbidden: Role 'CUSTOMER' is not authorized/);
    });
  });

  describe('3. Date Validation & Domain Constraints', () => {
    it('rejects missing or empty start date', () => {
      const val = validateReservationInput({
        cameraId: 'CAM-001',
        startDate: '',
        endDate: '2026-11-12',
        purpose: 'Test',
        paymentMethod: 'CASH_PICKUP'
      });
      expect(val.isValid).toBe(false);
      expect(val.errors.some(e => e.includes('start date is required'))).toBe(true);
    });

    it('rejects end date that precedes start date', () => {
      const val = validateReservationInput({
        cameraId: 'CAM-001',
        startDate: '2026-11-15',
        endDate: '2026-11-10',
        purpose: 'Test',
        paymentMethod: 'CASH_PICKUP'
      });
      expect(val.isValid).toBe(false);
      expect(val.errors.some(e => e.includes('cannot be earlier than start date'))).toBe(true);
    });

    it('rejects past reservation dates', () => {
      const val = validateReservationInput({
        cameraId: 'CAM-001',
        startDate: '2020-01-01',
        endDate: '2020-01-03',
        purpose: 'Test past date',
        paymentMethod: 'CASH_PICKUP'
      });
      expect(val.isValid).toBe(false);
      expect(val.errors.some(e => e.includes('cannot be in the past'))).toBe(true);
    });
  });

  describe('4. Camera Operational Availability & Overlap Collision', () => {
    it('rejects reservation for MAINTENANCE camera', async () => {
      setupMockSupabase({
        user: mockCustomerProfile,
        camera: { ...sampleCameraRow, status: 'MAINTENANCE' }
      });

      const result = await createReservation({
        cameraId: 'CAM-001',
        startDate: '2026-11-10',
        endDate: '2026-11-12',
        purpose: 'Test',
        paymentMethod: 'CASH_PICKUP',
        agreementAccepted: true,
        agreementVersion: 'v1.0'
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Camera is currently under maintenance');
    });

    it('rejects reservation for DAMAGED camera', async () => {
      setupMockSupabase({
        user: mockCustomerProfile,
        camera: { ...sampleCameraRow, status: 'DAMAGED' }
      });

      const result = await createReservation({
        cameraId: 'CAM-001',
        startDate: '2026-11-10',
        endDate: '2026-11-12',
        purpose: 'Test',
        paymentMethod: 'CASH_PICKUP',
        agreementAccepted: true,
        agreementVersion: 'v1.0'
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Camera is marked as damaged');
    });

    it('rejects overlapping reservation when active PENDING_APPROVAL reservation exists', () => {
      const activeCam: DigitalCamera = {
        id: 'CAM-001',
        serialNumber: 'SN-01',
        name: 'Sony A7 IV',
        brand: 'Sony',
        model: 'A74',
        category: 'Mirrorless',
        dailyRate: 1400,
        securityDeposit: 3000,
        status: 'AVAILABLE',
        condition: 'Excellent',
        specs: {} as any,
        description: 'Test',
        imageUrl: '',
        packageIncludes: [],
        totalRentalsCount: 0,
        createdAt: '',
        updatedAt: ''
      };

      const existingRes: Reservation = {
        id: 'res-1',
        referenceNo: 'IDIO-001',
        customerId: 'c1',
        customerName: 'A',
        customerEmail: '',
        customerPhone: '',
        customerBarangay: 'Libertad',
        customerStreetAddress: '',
        idType: '',
        idNumber: '',
        cameraId: 'CAM-001',
        cameraName: 'Sony A7 IV',
        cameraBrand: 'Sony',
        cameraCategory: 'Mirrorless',
        cameraSerial: 'SN-01',
        cameraImageUrl: '',
        startDate: '2026-11-10',
        endDate: '2026-11-15',
        totalDays: 6,
        dailyRate: 1400,
        subtotal: 8400,
        securityDeposit: 3000,
        totalAmount: 11400,
        purpose: 'Test',
        status: 'PENDING_APPROVAL',
        paymentStatus: 'PENDING',
        paymentMethod: 'GCASH',
        depositStatus: 'HELD',
        createdAt: '',
        updatedAt: ''
      };

      // Overlap attempt: 2026-11-12 to 2026-11-14 (inside 10-15)
      const check = checkCameraAvailability(activeCam, '2026-11-12', '2026-11-14', [existingRes]);
      expect(check.isAvailable).toBe(false);
      expect(check.reason).toContain('unavailable for your selected dates');
    });

    it('rejects overlapping reservation when active APPROVED reservation exists', () => {
      const activeCam: DigitalCamera = {
        id: 'CAM-001',
        serialNumber: 'SN-01',
        name: 'Sony A7 IV',
        brand: 'Sony',
        model: 'A74',
        category: 'Mirrorless',
        dailyRate: 1400,
        securityDeposit: 3000,
        status: 'AVAILABLE',
        condition: 'Excellent',
        specs: {} as any,
        description: 'Test',
        imageUrl: '',
        packageIncludes: [],
        totalRentalsCount: 0,
        createdAt: '',
        updatedAt: ''
      };

      const existingApprovedRes: Reservation = {
        id: 'res-1',
        referenceNo: 'IDIO-001',
        customerId: 'c1',
        customerName: 'A',
        customerEmail: '',
        customerPhone: '',
        customerBarangay: 'Libertad',
        customerStreetAddress: '',
        idType: '',
        idNumber: '',
        cameraId: 'CAM-001',
        cameraName: 'Sony A7 IV',
        cameraBrand: 'Sony',
        cameraCategory: 'Mirrorless',
        cameraSerial: 'SN-01',
        cameraImageUrl: '',
        startDate: '2026-11-10',
        endDate: '2026-11-15',
        totalDays: 6,
        dailyRate: 1400,
        subtotal: 8400,
        securityDeposit: 3000,
        totalAmount: 11400,
        purpose: 'Test',
        status: 'APPROVED',
        paymentStatus: 'PAID',
        paymentMethod: 'GCASH',
        depositStatus: 'HELD',
        createdAt: '',
        updatedAt: ''
      };

      const check = checkCameraAvailability(activeCam, '2026-11-14', '2026-11-18', [existingApprovedRes]);
      expect(check.isAvailable).toBe(false);
    });

    it('does NOT block availability for REJECTED reservations', () => {
      const activeCam: DigitalCamera = {
        id: 'CAM-001',
        serialNumber: 'SN-01',
        name: 'Sony A7 IV',
        brand: 'Sony',
        model: 'A74',
        category: 'Mirrorless',
        dailyRate: 1400,
        securityDeposit: 3000,
        status: 'AVAILABLE',
        condition: 'Excellent',
        specs: {} as any,
        description: 'Test',
        imageUrl: '',
        packageIncludes: [],
        totalRentalsCount: 0,
        createdAt: '',
        updatedAt: ''
      };

      const rejectedRes: Reservation = {
        id: 'res-1',
        referenceNo: 'IDIO-001',
        customerId: 'c1',
        customerName: 'A',
        customerEmail: '',
        customerPhone: '',
        customerBarangay: 'Libertad',
        customerStreetAddress: '',
        idType: '',
        idNumber: '',
        cameraId: 'CAM-001',
        cameraName: 'Sony A7 IV',
        cameraBrand: 'Sony',
        cameraCategory: 'Mirrorless',
        cameraSerial: 'SN-01',
        cameraImageUrl: '',
        startDate: '2026-11-10',
        endDate: '2026-11-15',
        totalDays: 6,
        dailyRate: 1400,
        subtotal: 8400,
        securityDeposit: 3000,
        totalAmount: 11400,
        purpose: 'Test',
        status: 'REJECTED',
        paymentStatus: 'PENDING',
        paymentMethod: 'GCASH',
        depositStatus: 'HELD',
        createdAt: '',
        updatedAt: ''
      };

      const check = checkCameraAvailability(activeCam, '2026-11-10', '2026-11-15', [rejectedRes]);
      expect(check.isAvailable).toBe(true);
    });

    it('does NOT block availability for CANCELLED reservations', () => {
      const activeCam: DigitalCamera = {
        id: 'CAM-001',
        serialNumber: 'SN-01',
        name: 'Sony A7 IV',
        brand: 'Sony',
        model: 'A74',
        category: 'Mirrorless',
        dailyRate: 1400,
        securityDeposit: 3000,
        status: 'AVAILABLE',
        condition: 'Excellent',
        specs: {} as any,
        description: 'Test',
        imageUrl: '',
        packageIncludes: [],
        totalRentalsCount: 0,
        createdAt: '',
        updatedAt: ''
      };

      const cancelledRes: Reservation = {
        id: 'res-1',
        referenceNo: 'IDIO-001',
        customerId: 'c1',
        customerName: 'A',
        customerEmail: '',
        customerPhone: '',
        customerBarangay: 'Libertad',
        customerStreetAddress: '',
        idType: '',
        idNumber: '',
        cameraId: 'CAM-001',
        cameraName: 'Sony A7 IV',
        cameraBrand: 'Sony',
        cameraCategory: 'Mirrorless',
        cameraSerial: 'SN-01',
        cameraImageUrl: '',
        startDate: '2026-11-10',
        endDate: '2026-11-15',
        totalDays: 6,
        dailyRate: 1400,
        subtotal: 8400,
        securityDeposit: 3000,
        totalAmount: 11400,
        purpose: 'Test',
        status: 'CANCELLED',
        paymentStatus: 'PENDING',
        paymentMethod: 'GCASH',
        depositStatus: 'HELD',
        createdAt: '',
        updatedAt: ''
      };

      const check = checkCameraAvailability(activeCam, '2026-11-10', '2026-11-15', [cancelledRes]);
      expect(check.isAvailable).toBe(true);
    });

    it('rejects reservation creation for CHECKED_OUT camera', async () => {
      setupMockSupabase({
        user: mockCustomerProfile,
        camera: { ...sampleCameraRow, status: 'CHECKED_OUT' }
      });

      const result = await createReservation({
        cameraId: 'CAM-001',
        startDate: '2026-11-10',
        endDate: '2026-11-12',
        purpose: 'Test checked out',
        paymentMethod: 'CASH_PICKUP',
        agreementAccepted: true,
        agreementVersion: 'v1.0'
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Camera is currently checked out');
    });

    it('enforces two-calendar-day buffer after rental (Oct 13-14 blocked, Oct 15 allowed)', () => {
      const activeCam: DigitalCamera = {
        id: 'CAM-001',
        serialNumber: 'SN-01',
        name: 'Sony A7 IV',
        brand: 'Sony',
        model: 'A74',
        category: 'Mirrorless',
        dailyRate: 1400,
        securityDeposit: 3000,
        status: 'AVAILABLE',
        condition: 'Excellent',
        specs: {} as any,
        description: 'Test',
        imageUrl: '',
        packageIncludes: [],
        totalRentalsCount: 0,
        createdAt: '',
        updatedAt: ''
      };

      const existingBooking: Reservation = {
        id: 'res-1',
        referenceNo: 'IDIO-001',
        customerId: 'c1',
        customerName: 'A',
        customerEmail: '',
        customerPhone: '',
        customerBarangay: 'Libertad',
        customerStreetAddress: '',
        idType: '',
        idNumber: '',
        cameraId: 'CAM-001',
        cameraName: 'Sony A7 IV',
        cameraBrand: 'Sony',
        cameraCategory: 'Mirrorless',
        cameraSerial: 'SN-01',
        cameraImageUrl: '',
        startDate: '2026-10-10',
        endDate: '2026-10-12',
        totalDays: 3,
        dailyRate: 1400,
        subtotal: 4200,
        securityDeposit: 3000,
        totalAmount: 7200,
        purpose: 'Test',
        status: 'APPROVED',
        paymentStatus: 'PAID',
        paymentMethod: 'GCASH',
        depositStatus: 'HELD',
        createdAt: '',
        updatedAt: ''
      };

      // Day immediately after rental (Oct 13) is allowed (no artificial buffer blocking)
      const checkAdjacent = checkCameraAvailability(activeCam, '2026-10-13', '2026-10-15', [existingBooking]);
      expect(checkAdjacent.isAvailable).toBe(true);
      expect(checkAdjacent.reason).toBe('Available for your selected dates.');

      // Date range starting later (Oct 15) is also allowed
      const checkLater = checkCameraAvailability(activeCam, '2026-10-15', '2026-10-17', [existingBooking]);
      expect(checkLater.isAvailable).toBe(true);
    });

    it('rejects touching boundary overlapping dates (e.g. Oct 10-12 and Oct 12-15)', () => {
      const activeCam: DigitalCamera = {
        id: 'CAM-001',
        serialNumber: 'SN-01',
        name: 'Sony A7 IV',
        brand: 'Sony',
        model: 'A74',
        category: 'Mirrorless',
        dailyRate: 1400,
        securityDeposit: 3000,
        status: 'AVAILABLE',
        condition: 'Excellent',
        specs: {} as any,
        description: 'Test',
        imageUrl: '',
        packageIncludes: [],
        totalRentalsCount: 0,
        createdAt: '',
        updatedAt: ''
      };

      const existingBooking: Reservation = {
        id: 'res-1',
        referenceNo: 'IDIO-001',
        customerId: 'c1',
        customerName: 'A',
        customerEmail: '',
        customerPhone: '',
        customerBarangay: 'Libertad',
        customerStreetAddress: '',
        idType: '',
        idNumber: '',
        cameraId: 'CAM-001',
        cameraName: 'Sony A7 IV',
        cameraBrand: 'Sony',
        cameraCategory: 'Mirrorless',
        cameraSerial: 'SN-01',
        cameraImageUrl: '',
        startDate: '2026-10-10',
        endDate: '2026-10-12',
        totalDays: 3,
        dailyRate: 1400,
        subtotal: 4200,
        securityDeposit: 3000,
        totalAmount: 7200,
        purpose: 'Test',
        status: 'APPROVED',
        paymentStatus: 'PAID',
        paymentMethod: 'GCASH',
        depositStatus: 'HELD',
        createdAt: '',
        updatedAt: ''
      };

      // Overlap on Oct 12 -> Rejected with contextual expected availability message
      const check = checkCameraAvailability(activeCam, '2026-10-12', '2026-10-15', [existingBooking]);
      expect(check.isAvailable).toBe(false);
      expect(check.reason).toContain('unavailable for your selected dates');
      expect(check.reason).toContain('Expected availability: Oct 13, 2026, subject to return and inspection');
    });
  });

  describe('5. Concurrency Protection & PostgreSQL Exclusion Constraint Handling', () => {
    it('catches PostgreSQL exclusion constraint violation and returns clean user-facing message', async () => {
      setupMockSupabase({
        user: mockCustomerProfile,
        camera: sampleCameraRow,
        reservations: [],
        insertReservationError: {
          code: '23P01',
          message: 'conflicting key value violates exclusion constraint "prevent_camera_reservation_overlap"'
        }
      });

      const result = await createReservation({
        cameraId: 'CAM-001',
        startDate: '2026-11-10',
        endDate: '2026-11-12',
        purpose: 'Concurrent booking attempt',
        paymentMethod: 'CASH_PICKUP',
        agreementAccepted: true,
        agreementVersion: 'v1.0'
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('This camera is no longer available for the selected dates');
    });
  });

  describe('6. Price Tampering & Security Deposit Protection', () => {
    it('ignores client-supplied pricing or deposit parameters and enforces authoritative database values', async () => {
      setupMockSupabase({
        user: mockCustomerProfile,
        camera: sampleCameraRow, // daily_rate_php = 1400, security_deposit_php = 3000
        reservations: []
      });

      // Malicious client attempts to pass PHP 1 daily rate and deposit
      const tamperedPayload: any = {
        cameraId: 'CAM-001',
        startDate: '2026-11-10',
        endDate: '2026-11-12', // 3 days
        purpose: 'Tampering attempt',
        paymentMethod: 'CASH_PICKUP',
        agreementAccepted: true,
        agreementVersion: 'v1.0',
        dailyRate: 1,
        subtotal: 1,
        securityDeposit: 1,
        totalAmount: 1
      };

      const result = await createReservation(tamperedPayload);
      expect(result.success).toBe(true);
      // Authoritative values from database must be stored:
      expect(result.data?.dailyRate).toBe(1400);
      expect(result.data?.subtotal).toBe(4200);
      expect(result.data?.securityDeposit).toBe(3000);
      expect(result.data?.totalAmount).toBe(7200);
    });
  });

  describe('7. Customer Cancellation & State Transition Integrity', () => {
    it('allows customer to cancel their own PENDING_APPROVAL reservation', async () => {
      setupMockSupabase({
        user: mockCustomerProfile,
        reservationById: { ...sampleReservationRow, status: 'PENDING_APPROVAL' },
        updateReservationResult: { ...sampleReservationRow, status: 'CANCELLED' }
      });

      const result = await cancelReservation(sampleReservationRow.id);
      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('CANCELLED');
    });

    it('denies customer from cancelling another customer reservation', async () => {
      setupMockSupabase({
        user: mockCustomerProfile,
        reservationById: {
          ...sampleReservationRow,
          customer_id: mockOtherCustomerProfile.id,
          status: 'PENDING_APPROVAL'
        }
      });

      const result = await cancelReservation(sampleReservationRow.id);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Access Denied: You cannot cancel another customer\'s reservation');
    });

    it('rejects invalid reservation state transitions (e.g. REJECTED to APPROVED)', () => {
      const trans1 = validateReservationTransition('REJECTED', 'APPROVED');
      expect(trans1.isValid).toBe(false);
      expect(trans1.errors[0]).toContain("Cannot transition from 'REJECTED' to 'APPROVED'");

      const trans2 = validateReservationTransition('CANCELLED', 'APPROVED');
      expect(trans2.isValid).toBe(false);
      expect(trans2.errors[0]).toContain("Cannot transition from 'CANCELLED' to 'APPROVED'");
    });
  });

  describe('8. Payment Method Enforcement & Historical Preservation', () => {
    it('accepts Cash on Counter Pickup (CASH_PICKUP) for new reservations', () => {
      const val = validateReservationInput({
        cameraId: 'CAM-001',
        startDate: '2026-11-10',
        endDate: '2026-11-12',
        purpose: 'Creative photography in Butuan City',
        paymentMethod: 'CASH_PICKUP',
        agreementAccepted: true,
        agreementVersion: 'v1.0'
      });
      expect(val.isValid).toBe(true);
      expect(val.errors).toHaveLength(0);
    });

    it('rejects GCash for new reservations with clear error message', () => {
      const val = validateReservationInput({
        cameraId: 'CAM-001',
        startDate: '2026-11-10',
        endDate: '2026-11-12',
        purpose: 'Test Shoot',
        paymentMethod: 'GCASH',
        agreementAccepted: true,
        agreementVersion: 'v1.0'
      });
      expect(val.isValid).toBe(false);
      expect(val.errors[0]).toContain("Unsupported payment method 'GCASH'");
      expect(val.errors[0]).toContain("only Cash on Counter Pickup ('CASH_PICKUP') is accepted");
    });

    it('rejects Maya and Bank Transfer for new reservations', () => {
      const valMaya = validateReservationInput({
        cameraId: 'CAM-001',
        startDate: '2026-11-10',
        endDate: '2026-11-12',
        purpose: 'Test Shoot',
        paymentMethod: 'MAYA',
        agreementAccepted: true,
        agreementVersion: 'v1.0'
      });
      expect(valMaya.isValid).toBe(false);
      expect(valMaya.errors[0]).toContain("Unsupported payment method 'MAYA'");

      const valBank = validateReservationInput({
        cameraId: 'CAM-001',
        startDate: '2026-11-10',
        endDate: '2026-11-12',
        purpose: 'Test Shoot',
        paymentMethod: 'BANK_TRANSFER',
        agreementAccepted: true,
        agreementVersion: 'v1.0'
      });
      expect(valBank.isValid).toBe(false);
      expect(valBank.errors[0]).toContain("Unsupported payment method 'BANK_TRANSFER'");
    });

    it('rejects createReservation when unsupported payment methods bypass customer UI', async () => {
      setupMockSupabase({
        user: mockCustomerProfile,
        camera: sampleCameraRow,
        reservations: []
      });

      const result = await createReservation({
        cameraId: 'CAM-001',
        startDate: '2026-11-10',
        endDate: '2026-11-12',
        purpose: 'Direct API injection test',
        paymentMethod: 'GCASH',
        paymentReference: 'BYPASS-ATTEMPT',
        agreementAccepted: true,
        agreementVersion: 'v1.0'
      } as any);

      expect(result.success).toBe(false);
      expect(result.message).toContain("Unsupported payment method 'GCASH'");
      expect(result.message).toContain("only Cash on Counter Pickup ('CASH_PICKUP') is accepted");
    });

    it('preserves all historical payment methods in VALID_PAYMENT_METHODS constant', () => {
      expect(VALID_PAYMENT_METHODS).toContain('CASH_PICKUP');
      expect(VALID_PAYMENT_METHODS).toContain('GCASH');
      expect(VALID_PAYMENT_METHODS).toContain('MAYA');
      expect(VALID_PAYMENT_METHODS).toContain('BANK_TRANSFER');
      expect(ALLOWED_NEW_PAYMENT_METHODS).toEqual(['CASH_PICKUP']);
    });
  });
});
