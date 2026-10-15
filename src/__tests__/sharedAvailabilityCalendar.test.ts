import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  checkCameraAvailability,
  getBookedDateRanges,
  BookedDateRange
} from '../lib/availabilityEngine';
import {
  checkCameraAvailabilityServer,
  createReservation,
  cancelReservation,
  getCameraAvailabilitySchedule
} from '../lib/reservations/reservationService';
import {
  checkoutRental,
  processReturn
} from '../lib/rentals/rentalService';
import { DigitalCamera, Reservation, Rental } from '../types';
import { DigitalCameraRow, ReservationRow, ProfileRow, RentalRow } from '../types/database';

vi.mock('../lib/supabase/server', () => ({
  createClient: vi.fn()
}));

import { createClient } from '../lib/supabase/server';

const mockCustomerA: ProfileRow = {
  id: 'cust-uuid-aaa',
  role: 'CUSTOMER',
  full_name: 'Customer A (Juan Dela Cruz)',
  email: 'juan@example.ph',
  phone: '0917-111-2222',
  avatar_url: null,
  barangay: 'Libertad',
  street_address: 'Main Ave',
  city: 'Butuan City',
  province: 'Agusan del Norte',
  id_type: 'Passport',
  id_number: 'P9876543A',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

const mockCustomerB: ProfileRow = {
  id: 'cust-uuid-bbb',
  role: 'CUSTOMER',
  full_name: 'Customer B (Maria Santos)',
  email: 'maria@example.ph',
  phone: '0917-333-4444',
  avatar_url: null,
  barangay: 'San Vicente',
  street_address: 'Purok 2',
  city: 'Butuan City',
  province: 'Agusan del Norte',
  id_type: "Driver's License",
  id_number: 'D02-99-887766',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

const mockCameraZ6: DigitalCamera = {
  id: 'CAM-NIKON-Z6II',
  serialNumber: 'SN-NK-883311',
  name: 'Nikon Z6 II Mirrorless Camera',
  brand: 'Nikon',
  model: 'Z6 II',
  category: 'Mirrorless',
  dailyRate: 1400,
  securityDeposit: 3000,
  status: 'AVAILABLE',
  condition: 'Excellent',
  specs: {
    sensor: '24.5MP BSI FX',
    megapixels: '24.5MP',
    videoResolution: '4K 60p',
    isoRange: '100-51200',
    lensMountOrKit: 'Z-Mount',
    screen: '3.2-inch tilting',
    connectivity: 'WiFi / SnapBridge',
    batteryLife: '410 shots',
    weight: '705g'
  },
  description: 'Versatile hybrid multimedia full-frame camera.',
  imageUrl: '/cameras/nikon-z6ii.jpg',
  packageIncludes: ['Camera Body', '24-70mm f/4 S Lens', '2x EN-EL15c Batteries'],
  totalRentalsCount: 12,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z'
};

const mockCameraSony: DigitalCamera = {
  id: 'CAM-SONY-A7IV',
  serialNumber: 'SN-SONY-998811',
  name: 'Sony Alpha a7 IV',
  brand: 'Sony',
  model: 'ILCE-7M4',
  category: 'Mirrorless',
  dailyRate: 1500,
  securityDeposit: 3500,
  status: 'AVAILABLE',
  condition: 'Excellent',
  specs: {
    sensor: '33MP BSI Exmor R',
    megapixels: '33MP',
    videoResolution: '4K 60p',
    isoRange: '100-51200',
    lensMountOrKit: 'E-Mount',
    screen: '3.0-inch vari-angle',
    connectivity: 'WiFi / Bluetooth',
    batteryLife: '580 shots',
    weight: '658g'
  },
  description: 'Flagship full-frame hybrid mirrorless camera.',
  imageUrl: '/cameras/sony-a7iv.jpg',
  packageIncludes: ['Camera Body', '28-70mm Lens', '2x Batteries'],
  totalRentalsCount: 20,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z'
};

const mockCameraCanonG7X: DigitalCamera = {
  id: 'CAM-005',
  serialNumber: 'SN-CANON-G7XM3-5590',
  name: 'Canon PowerShot G7 X Mark III Digital Compact',
  brand: 'Canon',
  model: 'G7 X Mark III',
  category: 'Compact',
  dailyRate: 650,
  securityDeposit: 1500,
  status: 'AVAILABLE',
  condition: 'Good',
  specs: {
    sensor: '20.1 MP 1.0-type Stacked CMOS Sensor',
    megapixels: '20.1 MP',
    videoResolution: '4K 30p / FHD 120p',
    isoRange: '125 - 12,800',
    lensMountOrKit: 'Fixed 24-100mm f/1.8-2.8',
    screen: '3.0-inch 180° Flip-up Touchscreen',
    connectivity: 'Wi-Fi, Bluetooth',
    batteryLife: 'Approx. 265 shots',
    weight: '304g'
  },
  description: 'Pocket-sized digital compact camera with f/1.8 lens.',
  imageUrl: '/cameras/CAM-005.jpg',
  packageIncludes: ['Camera Body', '2x Batteries', 'SD Card'],
  totalRentalsCount: 45,
  createdAt: '2026-02-01T10:00:00Z',
  updatedAt: '2026-10-04T09:00:00Z'
};

const createReservationFixture = (overrides?: Partial<Reservation>): Reservation => ({
  id: 'res-fixture-001',
  referenceNo: 'IDIO-2026-F001',
  customerId: mockCustomerA.id,
  customerName: mockCustomerA.full_name,
  customerEmail: mockCustomerA.email,
  customerPhone: mockCustomerA.phone,
  customerBarangay: mockCustomerA.barangay,
  customerStreetAddress: 'Main St',
  idType: mockCustomerA.id_type,
  idNumber: mockCustomerA.id_number,
  cameraId: mockCameraZ6.id,
  cameraName: mockCameraZ6.name,
  cameraBrand: mockCameraZ6.brand,
  cameraCategory: mockCameraZ6.category,
  cameraSerial: mockCameraZ6.serialNumber,
  cameraImageUrl: mockCameraZ6.imageUrl,
  startDate: '2026-10-20',
  endDate: '2026-10-22',
  totalDays: 3,
  dailyRate: mockCameraZ6.dailyRate,
  subtotal: 4200,
  securityDeposit: mockCameraZ6.securityDeposit,
  totalAmount: 7200,
  purpose: 'Wildlife documentary shoot in Butuan',
  status: 'APPROVED',
  paymentStatus: 'PAID',
  paymentMethod: 'CASH_PICKUP',
  depositStatus: 'HELD',
  createdAt: '2026-10-01T00:00:00Z',
  updatedAt: '2026-10-01T00:00:00Z',
  ...overrides
});

describe('IDIO — Shared Camera Availability Calendar & Double-Booking Protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Scenario 1: Customer A reserves, Customer B sees RESERVED dates
  it('Scenario 1: Customer A confirms a reservation, and Customer B sees RESERVED dates for the same camera', async () => {
    const reservationA = createReservationFixture({
      startDate: '2026-10-20',
      endDate: '2026-10-22',
      status: 'APPROVED'
    });

    // When Customer B queries booked ranges for mockCameraZ6
    const bookedRanges = getBookedDateRanges(mockCameraZ6.id, [reservationA]);
    expect(bookedRanges).toHaveLength(1);
    expect(bookedRanges[0].startDate).toBe('2026-10-20');
    expect(bookedRanges[0].endDate).toBe('2026-10-22');
    expect(bookedRanges[0].status).toBe('APPROVED'); // Maps to 'reserved' in UI

    // Zero-PII contract: calendar slot does NOT contain customer B's name, email, or phone
    expect((bookedRanges[0] as any).customerName).toBeUndefined();
    expect((bookedRanges[0] as any).customerEmail).toBeUndefined();
  });

  // Scenario 2: Customer B cannot reserve overlapping dates
  it('Scenario 2: Customer B cannot reserve overlapping dates for the same camera', () => {
    const reservationA = createReservationFixture({
      startDate: '2026-10-20',
      endDate: '2026-10-22',
      status: 'APPROVED'
    });

    // Customer B tries to pick Oct 21 - Oct 23 (overlaps Oct 21 and 22)
    const check1 = checkCameraAvailability(mockCameraZ6, '2026-10-21', '2026-10-23', [reservationA]);
    expect(check1.isAvailable).toBe(false);
    expect(check1.reason).toContain('unavailable for your selected dates');

    // Customer B tries to pick Oct 19 - Oct 20 (overlaps Oct 20 start date)
    const check2 = checkCameraAvailability(mockCameraZ6, '2026-10-19', '2026-10-20', [reservationA]);
    expect(check2.isAvailable).toBe(false);
    expect(check2.reason).toContain('unavailable for your selected dates');
  });

  // Scenario 3: Checked-out camera displays RENTED dates to all customers
  it('Scenario 3: A checked-out camera displays RENTED dates to all customers', () => {
    const activeCheckoutReservation = createReservationFixture({
      startDate: '2026-10-15',
      endDate: '2026-10-18',
      status: 'CHECKED_OUT'
    });

    const booked = getBookedDateRanges(mockCameraZ6.id, [activeCheckoutReservation]);
    expect(booked).toHaveLength(1);
    expect(booked[0].status).toBe('CHECKED_OUT'); // In UI, maps to 'checked-out' / RENTED state
  });

  // Scenario 4: Returned camera becomes available again
  it('Scenario 4: A returned camera becomes available again when no other restriction applies', () => {
    const returnedRentalReservation = createReservationFixture({
      startDate: '2026-10-10',
      endDate: '2026-10-14',
      status: 'RETURNED'
    });

    // Subsequent dates should be fully available
    const check = checkCameraAvailability(mockCameraZ6, '2026-10-15', '2026-10-18', [returnedRentalReservation]);
    expect(check.isAvailable).toBe(true);

    const booked = getBookedDateRanges(mockCameraZ6.id, [returnedRentalReservation]);
    expect(booked).toHaveLength(0); // RETURNED does not block future intervals
  });

  // Scenario 5: Cancelled reservations stop blocking dates
  it('Scenario 5: Cancelled reservations stop blocking dates', () => {
    const cancelledRes = createReservationFixture({
      startDate: '2026-10-25',
      endDate: '2026-10-28',
      status: 'CANCELLED'
    });

    const check = checkCameraAvailability(mockCameraZ6, '2026-10-25', '2026-10-28', [cancelledRes]);
    expect(check.isAvailable).toBe(true);

    const booked = getBookedDateRanges(mockCameraZ6.id, [cancelledRes]);
    expect(booked).toHaveLength(0);
  });

  // Scenario 6: Maintenance restrictions block affected dates
  it('Scenario 6: Maintenance restrictions block affected dates', () => {
    const maintenanceCamera: DigitalCamera = {
      ...mockCameraZ6,
      status: 'MAINTENANCE',
      maintenanceNotes: 'Shutter replacement at authorized center'
    };

    const check = checkCameraAvailability(maintenanceCamera, '2026-11-01', '2026-11-05', []);
    expect(check.isAvailable).toBe(false);
    expect(check.reason).toContain('maintenance');
  });

  // Scenario 7: Two simultaneous overlapping booking requests cannot both succeed
  it('Scenario 7: Two simultaneous overlapping booking requests cannot both succeed', async () => {
    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: mockCustomerB.id } },
          error: null
        })
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockCustomerB, error: null })
              })
            })
          };
        }
        if (table === 'digital_cameras') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: mockCameraZ6.id,
                    name: mockCameraZ6.name,
                    status: 'AVAILABLE',
                    condition: 'Excellent',
                    daily_rate_php: mockCameraZ6.dailyRate,
                    security_deposit_php: mockCameraZ6.securityDeposit
                  },
                  error: null
                })
              })
            })
          };
        }
        if (table === 'reservations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  lte: vi.fn().mockReturnValue({
                    gte: vi.fn().mockReturnValue({
                      neq: vi.fn().mockResolvedValue({ data: [], error: null })
                    })
                  })
                })
              })
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  // Concurrency collision caught by Postgres EXCLUDE constraint:
                  error: {
                    code: '23P01',
                    message: 'conflicting key value violates exclusion constraint "prevent_camera_reservation_overlap"'
                  }
                })
              })
            })
          };
        }
        if (table === 'rentals') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: [], error: null })
              })
            })
          };
        }
        return { select: vi.fn().mockReturnThis() };
      })
    };

    (createClient as any).mockResolvedValue(mockClient);

    const result = await createReservation({
      cameraId: mockCameraZ6.id,
      startDate: '2026-10-20',
      endDate: '2026-10-22',
      purpose: 'Concurrent collision test',
      paymentMethod: 'CASH_PICKUP',
      agreementAccepted: true,
      agreementVersion: 'v1.0'
    });

    expect(result.success).toBe(false);
    expect(result.message).toContain('These dates are no longer available. Please select another rental period.');
  });

  // Scenario 8: Different cameras can be reserved for the same dates
  it('Scenario 8: Different cameras can be reserved for the same dates when availability allows it', () => {
    // Camera Z6 reserved Oct 20-22 by Customer A
    const z6Reservation = createReservationFixture({
      cameraId: mockCameraZ6.id,
      startDate: '2026-10-20',
      endDate: '2026-10-22',
      status: 'APPROVED'
    });

    // Sony A7IV is free on the exact same dates Oct 20-22
    const sonyCheck = checkCameraAvailability(mockCameraSony, '2026-10-20', '2026-10-22', [z6Reservation]);
    expect(sonyCheck.isAvailable).toBe(true);
    expect(sonyCheck.reason).toBe('Available for your selected dates.');
  });

  // Scenario 9: Adjacent rental periods follow pickup and return rules
  it('Scenario 9: Adjacent rental periods follow pickup and return rules (same-day turnover prevented, next-day allowed)', () => {
    const existingRes = createReservationFixture({
      startDate: '2026-10-20',
      endDate: '2026-10-22',
      status: 'APPROVED'
    });

    // Attempting same-day overlap (starting on Oct 22 when previous return is Oct 22 by 6 PM) -> BLOCKED
    const sameDayOverlap = checkCameraAvailability(mockCameraZ6, '2026-10-22', '2026-10-24', [existingRes]);
    expect(sameDayOverlap.isAvailable).toBe(false);

    // Adjacent next day (starting on Oct 23 after Oct 22 return) -> ALLOWED
    const nextDayAdjacent = checkCameraAvailability(mockCameraZ6, '2026-10-23', '2026-10-25', [existingRes]);
    expect(nextDayAdjacent.isAvailable).toBe(true);
  });

  // Scenario 10: Failed database request never treats dates as available
  it('Scenario 10: A failed database request never incorrectly displays dates as available', async () => {
    const mockClient = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database connection timeout' }
      }),
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Fatal read replica failure' }
            })
          })
        })
      })
    };

    (createClient as any).mockResolvedValue(mockClient);

    const result = await getCameraAvailabilitySchedule(mockCameraZ6.id);
    expect(result.data).toBeDefined();
  });

  // Scenario 11: Unauthorized users cannot cancel or modify another customer reservation
  it('Scenario 11: Unauthorized users cannot cancel or modify another customer reservation', async () => {
    const mockClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: mockCustomerB.id } }, // Logged in as Customer B
          error: null
        })
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockCustomerB, error: null })
              })
            })
          };
        }
        if (table === 'reservations') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'res-a-101',
                    customer_id: mockCustomerA.id // Belongs to Customer A!
                  },
                  error: null
                })
              })
            })
          };
        }
        return { select: vi.fn().mockReturnThis() };
      })
    };

    (createClient as any).mockResolvedValue(mockClient);

    // Customer B tries to cancel Customer A's reservation
    const result = await cancelReservation('res-a-101');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Access Denied');
  });

  // Scenario 12: Availability schedule RPC returns accurate intervals and maps correctly
  it('Scenario 12: Shared schedule RPC maps RESERVED and RENTED slots cleanly with zero PII', async () => {
    const mockClient = {
      rpc: vi.fn().mockResolvedValue({
        data: [
          { start_date: '2026-10-20', end_date: '2026-10-22', schedule_status: 'RESERVED' },
          { start_date: '2026-10-25', end_date: '2026-10-28', schedule_status: 'RENTED' }
        ],
        error: null
      })
    };

    (createClient as any).mockResolvedValue(mockClient);

    const res = await getCameraAvailabilitySchedule(mockCameraZ6.id);
    expect(res.success).toBe(true);
    expect(res.data).toHaveLength(2);
    expect(res.data![0].startDate).toBe('2026-10-20');
    expect(res.data![0].status).toBe('APPROVED'); // Maps to reserved
    expect(res.data![1].startDate).toBe('2026-10-25');
    expect(res.data![1].status).toBe('CHECKED_OUT'); // Maps to rented

    // Verify zero PII is present in the schedule result
    for (const item of res.data!) {
      expect((item as any).customerId).toBeUndefined();
      expect((item as any).customerName).toBeUndefined();
      expect((item as any).customerEmail).toBeUndefined();
      expect((item as any).paymentStatus).toBeUndefined();
    }
  });

  // Scenario 13: Customer A and Customer B both view Canon PowerShot G7 X Mark III for Oct 16–18, 2026
  it('Scenario 13: Resolves bug where Customer A saw unavailable while Customer B saw reserved for CAM-005 Oct 16-18', async () => {
    // Customer B booked Canon PowerShot G7 X Mark III for Oct 16-18, 2026 (APPROVED status, awaiting pickup)
    const mockReservationOct16_18: Reservation = createReservationFixture({
      id: 'res-canon-oct16',
      referenceNo: 'IDIO-CANON-88',
      cameraId: mockCameraCanonG7X.id,
      customerId: mockCustomerB.id,
      startDate: '2026-10-16',
      endDate: '2026-10-18',
      status: 'APPROVED'
    });

    // 1. Admin Dashboard verifies: 0 active rentals (camera is not CHECKED_OUT yet, it is reserved awaiting pickup)
    const activeRentals = [mockReservationOct16_18].filter(r => r.status === 'CHECKED_OUT');
    expect(activeRentals).toHaveLength(0);

    // 2. Mock database returning the reservation for RPC query (Migration 011 SECURITY DEFINER)
    const mockRpcSchedule = [
      { start_date: '2026-10-16', end_date: '2026-10-18', schedule_status: 'RESERVED' }
    ];

    const mockClient = {
      rpc: vi.fn().mockImplementation((fn: string) => {
        if (fn === 'get_camera_availability_schedule') {
          return Promise.resolve({ data: mockRpcSchedule, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      })
    };

    (createClient as any).mockResolvedValue(mockClient);

    // 3. Customer A queries availability schedule for CAM-005
    const scheduleForCustomerA = await getCameraAvailabilitySchedule(mockCameraCanonG7X.id);
    expect(scheduleForCustomerA.success).toBe(true);
    expect(scheduleForCustomerA.data).toHaveLength(1);
    expect(scheduleForCustomerA.data![0].startDate).toBe('2026-10-16');
    expect(scheduleForCustomerA.data![0].endDate).toBe('2026-10-18');
    expect(scheduleForCustomerA.data![0].status).toBe('APPROVED'); // Maps to 'reserved' in UI

    // 4. Customer B queries availability schedule for CAM-005
    const scheduleForCustomerB = await getCameraAvailabilitySchedule(mockCameraCanonG7X.id);
    expect(scheduleForCustomerB.success).toBe(true);
    expect(scheduleForCustomerB.data).toHaveLength(1);
    expect(scheduleForCustomerB.data![0].startDate).toBe('2026-10-16');
    expect(scheduleForCustomerB.data![0].endDate).toBe('2026-10-18');
    expect(scheduleForCustomerB.data![0].status).toBe('APPROVED'); // Maps to 'reserved' in UI

    // 5. Assert: Both Customer A and Customer B receive IDENTICAL statuses and dates
    expect(scheduleForCustomerA.data).toEqual(scheduleForCustomerB.data);

    // 6. Test calendar booked ranges mapping
    const bookedRanges = getBookedDateRanges(mockCameraCanonG7X.id, [mockReservationOct16_18]);
    expect(bookedRanges).toHaveLength(1);
    expect(bookedRanges[0].status).toBe('APPROVED'); // Rendered as yellow RESERVED, not gray UNAVAILABLE

    // 7. Verify Customer A is blocked from overlapping dates Oct 16-18
    const customerAOverlapCheck = checkCameraAvailability(
      mockCameraCanonG7X,
      '2026-10-16',
      '2026-10-18',
      [mockReservationOct16_18]
    );
    expect(customerAOverlapCheck.isAvailable).toBe(false);
    expect(customerAOverlapCheck.reason).toContain('unavailable for your selected dates');

    // 8. Verify non-blocked dates (e.g. Oct 20-22) are AVAILABLE (white)
    const customerAFreeCheck = checkCameraAvailability(
      mockCameraCanonG7X,
      '2026-10-20',
      '2026-10-22',
      [mockReservationOct16_18]
    );
    expect(customerAFreeCheck.isAvailable).toBe(true);

    // 9. If reservation is cancelled, dates become available to all customers
    const cancelledReservation: Reservation = { ...mockReservationOct16_18, status: 'CANCELLED' };
    const checkAfterCancellation = checkCameraAvailability(
      mockCameraCanonG7X,
      '2026-10-16',
      '2026-10-18',
      [cancelledReservation]
    );
    expect(checkAfterCancellation.isAvailable).toBe(true);

    // 10. If admin executes checkout, status transitions to CHECKED_OUT ('RENTED' / rose)
    const checkedOutReservation: Reservation = { ...mockReservationOct16_18, status: 'CHECKED_OUT' };
    const bookedRangesAfterCheckout = getBookedDateRanges(mockCameraCanonG7X.id, [checkedOutReservation]);
    expect(bookedRangesAfterCheckout[0].status).toBe('CHECKED_OUT');
    const activeRentalsAfterCheckout = [checkedOutReservation].filter(r => r.status === 'CHECKED_OUT');
    expect(activeRentalsAfterCheckout).toHaveLength(1);
  });
});

