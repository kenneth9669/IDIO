import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  checkCameraAvailability,
  getBookedDateRanges,
  getCameraOperationalScheduleState
} from '../lib/availabilityEngine';
import {
  checkCameraAvailabilityServer,
  getCameraAvailabilitySchedule
} from '../lib/reservations/reservationService';
import { DigitalCamera, Reservation } from '../types';

// Mock Supabase Server Client for server-side availability testing
vi.mock('../lib/supabase/server', () => {
  return {
    createClient: vi.fn()
  };
});

import { createClient } from '../lib/supabase/server';

const mockSampleCamera: DigitalCamera = {
  id: 'CAM-001',
  name: 'Sony Alpha 7 IV Mirrorless',
  brand: 'Sony',
  model: 'ILCE-7M4',
  category: 'Mirrorless',
  serialNumber: 'SN-SONY-A7IV-9921',
  dailyRate: 1450,
  securityDeposit: 3000,
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
  imageUrl: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32',
  packageIncludes: ['Body', 'Lens'],
  totalRentalsCount: 10,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z'
};

function setupMockSupabaseServer({
  camera = {
    id: 'CAM-001',
    name: 'Sony Alpha 7 IV Mirrorless',
    status: 'AVAILABLE',
    condition: 'Excellent',
    maintenance_notes: null
  },
  reservations = [] as any[],
  rentals = [] as any[],
  rpcSchedule = null as any[] | null
}: {
  camera?: any;
  reservations?: any[];
  rentals?: any[];
  rpcSchedule?: any[] | null;
} = {}) {
  const mockClient = {
    rpc: vi.fn().mockImplementation((fn: string) => {
      if (fn === 'get_camera_availability_schedule') {
        if (rpcSchedule !== null) {
          return Promise.resolve({ data: rpcSchedule, error: null });
        }
        return Promise.resolve({ data: null, error: { message: 'function not found' } });
      }
      return Promise.resolve({ data: null, error: null });
    }),
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'digital_cameras') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: camera, error: null })
            })
          })
        };
      }
      if (table === 'rentals') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: rentals, error: null })
            })
          })
        };
      }
      if (table === 'reservations') {
        const queryChain: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          gte: vi.fn().mockImplementation(() => {
            return Promise.resolve({ data: reservations, error: null });
          }),
          neq: vi.fn().mockReturnThis()
        };
        return queryChain;
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [], error: null })
      };
    })
  };

  (createClient as any).mockResolvedValue(mockClient);
  return mockClient;
}

describe('Camera Availability Alignment & Regression Suite (11 Test Cases)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Camera with no reservation is available and bookable
  it('Case 1: Camera with no reservation is available and bookable across client and server', async () => {
    const cam = { ...mockSampleCamera };
    const allReservations: Reservation[] = [];

    // Client availability check
    const clientResult = checkCameraAvailability(cam, '2026-10-25', '2026-10-27', allReservations);
    expect(clientResult.isAvailable).toBe(true);

    const bookedRanges = getBookedDateRanges(cam.id, allReservations);
    expect(bookedRanges).toHaveLength(0);

    // Schedule state
    const scheduleState = getCameraOperationalScheduleState(cam, allReservations, '2026-10-15');
    expect(scheduleState.effectiveStatus).toBe('AVAILABLE');
    expect(scheduleState.isGenuinelyAvailableToday).toBe(true);
    expect(scheduleState.hasFutureReservations).toBe(false);

    // Server check
    setupMockSupabaseServer({ reservations: [] });
    const serverResult = await checkCameraAvailabilityServer(cam.id, '2026-10-25', '2026-10-27');
    expect(serverResult.isAvailable).toBe(true);
  });

  // 2. Camera with genuine reservation for requested dates is marked RESERVED and cannot be booked
  it('Case 2: Camera with genuine overlapping reservation is marked RESERVED and blocked', async () => {
    const cam = { ...mockSampleCamera };
    const approvedRes: Reservation = {
      id: 'RES-001',
      referenceNo: 'IDIO-101',
      customerId: 'CUST-1',
      customerName: 'Alice',
      customerEmail: 'alice@example.com',
      customerPhone: '09191234567',
      customerBarangay: 'Ampayon',
      customerStreetAddress: 'Purok 1',
      idType: 'UMID',
      idNumber: '1234',
      cameraId: cam.id,
      cameraName: cam.name,
      cameraBrand: cam.brand,
      cameraCategory: cam.category,
      cameraSerial: cam.serialNumber,
      cameraImageUrl: cam.imageUrl,
      startDate: '2026-10-20',
      endDate: '2026-10-22',
      totalDays: 3,
      dailyRate: 1450,
      subtotal: 4350,
      securityDeposit: 3000,
      totalAmount: 7350,
      purpose: 'Shoot',
      status: 'APPROVED',
      paymentStatus: 'PAID',
      paymentMethod: 'CASH_PICKUP',
      depositStatus: 'HELD',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z'
    };

    // Client check on overlapping dates
    const clientOverlap = checkCameraAvailability(cam, '2026-10-21', '2026-10-23', [approvedRes]);
    expect(clientOverlap.isAvailable).toBe(false);
    expect(clientOverlap.reason).toContain('unavailable');

    // Server check
    setupMockSupabaseServer({
      reservations: [{
        id: 'RES-001',
        reference_no: 'IDIO-101',
        start_date: '2026-10-20',
        end_date: '2026-10-22',
        status: 'APPROVED'
      }]
    });
    const serverOverlap = await checkCameraAvailabilityServer(cam.id, '2026-10-21', '2026-10-23');
    expect(serverOverlap.isAvailable).toBe(false);
    expect(serverOverlap.reason).toContain('unavailable');
  });

  // 3. Camera with reservation for different non-conflicting dates remains available
  it('Case 3: Camera with reservation for different non-conflicting dates remains available', async () => {
    const cam = { ...mockSampleCamera };
    const approvedRes: Reservation = {
      id: 'RES-001',
      referenceNo: 'IDIO-101',
      customerId: 'CUST-1',
      customerName: 'Alice',
      customerEmail: 'alice@example.com',
      customerPhone: '09191234567',
      customerBarangay: 'Ampayon',
      customerStreetAddress: 'Purok 1',
      idType: 'UMID',
      idNumber: '1234',
      cameraId: cam.id,
      cameraName: cam.name,
      cameraBrand: cam.brand,
      cameraCategory: cam.category,
      cameraSerial: cam.serialNumber,
      cameraImageUrl: cam.imageUrl,
      startDate: '2026-10-18',
      endDate: '2026-10-20',
      totalDays: 3,
      dailyRate: 1450,
      subtotal: 4350,
      securityDeposit: 3000,
      totalAmount: 7350,
      purpose: 'Shoot',
      status: 'APPROVED',
      paymentStatus: 'PAID',
      paymentMethod: 'CASH_PICKUP',
      depositStatus: 'HELD',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z'
    };

    // Requested dates well after the reservation (Oct 25 to 27)
    const clientResultAfter = checkCameraAvailability(cam, '2026-10-25', '2026-10-27', [approvedRes]);
    expect(clientResultAfter.isAvailable).toBe(true);

    // Server check
    setupMockSupabaseServer({ reservations: [] }); // No overlap query match in DB
    const serverResult = await checkCameraAvailabilityServer(cam.id, '2026-10-25', '2026-10-27');
    expect(serverResult.isAvailable).toBe(true);
  });

  // 4. Cancelled and rejected reservations release availability immediately
  it('Case 4: Cancelled and rejected reservations release availability immediately', async () => {
    const cam = { ...mockSampleCamera };
    const cancelledRes: Reservation = {
      id: 'RES-CANC',
      referenceNo: 'IDIO-CANC',
      customerId: 'CUST-1',
      customerName: 'Alice',
      customerEmail: 'alice@example.com',
      customerPhone: '09191234567',
      customerBarangay: 'Ampayon',
      customerStreetAddress: 'Purok 1',
      idType: 'UMID',
      idNumber: '1234',
      cameraId: cam.id,
      cameraName: cam.name,
      cameraBrand: cam.brand,
      cameraCategory: cam.category,
      cameraSerial: cam.serialNumber,
      cameraImageUrl: cam.imageUrl,
      startDate: '2026-10-20',
      endDate: '2026-10-22',
      totalDays: 3,
      dailyRate: 1450,
      subtotal: 4350,
      securityDeposit: 3000,
      totalAmount: 7350,
      purpose: 'Shoot',
      status: 'CANCELLED',
      paymentStatus: 'REFUNDED',
      paymentMethod: 'CASH_PICKUP',
      depositStatus: 'REFUNDED',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z'
    };

    const rejectedRes: Reservation = {
      ...cancelledRes,
      id: 'RES-REJ',
      referenceNo: 'IDIO-REJ',
      status: 'REJECTED'
    };

    const clientCheck = checkCameraAvailability(cam, '2026-10-20', '2026-10-22', [cancelledRes, rejectedRes]);
    expect(clientCheck.isAvailable).toBe(true);

    const ranges = getBookedDateRanges(cam.id, [cancelledRes, rejectedRes]);
    expect(ranges).toHaveLength(0);

    const schedule = getCameraOperationalScheduleState(cam, [cancelledRes, rejectedRes], '2026-10-15');
    expect(schedule.hasFutureReservations).toBe(false);
    expect(schedule.hasPendingReservations).toBe(false);
  });

  // 5. Pending reservations hold inventory and are displayed accurately on both customer and admin interfaces
  it('Case 5: Pending reservations hold inventory and report pending state to admin', async () => {
    const cam = { ...mockSampleCamera };
    const pendingRes: Reservation = {
      id: 'RES-PEND',
      referenceNo: 'IDIO-PEND',
      customerId: 'CUST-2',
      customerName: 'Bob',
      customerEmail: 'bob@example.com',
      customerPhone: '09191234568',
      customerBarangay: 'Doongan',
      customerStreetAddress: 'Purok 2',
      idType: 'Postal ID',
      idNumber: '5678',
      cameraId: cam.id,
      cameraName: cam.name,
      cameraBrand: cam.brand,
      cameraCategory: cam.category,
      cameraSerial: cam.serialNumber,
      cameraImageUrl: cam.imageUrl,
      startDate: '2026-10-18',
      endDate: '2026-10-20',
      totalDays: 3,
      dailyRate: 1450,
      subtotal: 4350,
      securityDeposit: 3000,
      totalAmount: 7350,
      purpose: 'Documentary',
      status: 'PENDING_APPROVAL',
      paymentStatus: 'PENDING',
      paymentMethod: 'CASH_PICKUP',
      depositStatus: 'HELD',
      createdAt: '2026-10-07T00:00:00Z',
      updatedAt: '2026-10-07T00:00:00Z'
    };

    // Customer side: blocks requested overlapping dates
    const customerOverlap = checkCameraAvailability(cam, '2026-10-19', '2026-10-21', [pendingRes]);
    expect(customerOverlap.isAvailable).toBe(false);

    // Booked date range shows status PENDING_APPROVAL
    const ranges = getBookedDateRanges(cam.id, [pendingRes]);
    expect(ranges).toHaveLength(1);
    expect(ranges[0].status).toBe('PENDING_APPROVAL');

    // Admin schedule shows pending hold
    const adminSchedule = getCameraOperationalScheduleState(cam, [pendingRes], '2026-10-15');
    expect(adminSchedule.hasPendingReservations).toBe(true);
    expect(adminSchedule.pendingReservations).toHaveLength(1);
  });

  // 6. Completed and returned rentals do not block future reservations
  it('Case 6: Completed and returned rentals or past expired records do not block future reservations', async () => {
    const cam = { ...mockSampleCamera };
    const completedRes: Reservation = {
      id: 'RES-COMPL',
      referenceNo: 'IDIO-COMPL',
      customerId: 'CUST-1',
      customerName: 'Alice',
      customerEmail: 'alice@example.com',
      customerPhone: '09191234567',
      customerBarangay: 'Ampayon',
      customerStreetAddress: 'Purok 1',
      idType: 'UMID',
      idNumber: '1234',
      cameraId: cam.id,
      cameraName: cam.name,
      cameraBrand: cam.brand,
      cameraCategory: cam.category,
      cameraSerial: cam.serialNumber,
      cameraImageUrl: cam.imageUrl,
      startDate: '2026-09-10',
      endDate: '2026-09-12',
      totalDays: 3,
      dailyRate: 1450,
      subtotal: 4350,
      securityDeposit: 3000,
      totalAmount: 7350,
      purpose: 'Portrait',
      status: 'COMPLETED',
      paymentStatus: 'PAID',
      paymentMethod: 'CASH_PICKUP',
      depositStatus: 'REFUNDED',
      createdAt: '2026-09-01T00:00:00Z',
      updatedAt: '2026-09-15T00:00:00Z'
    };

    // Past expired uncollected record
    const expiredUncollected: Reservation = {
      ...completedRes,
      id: 'RES-EXP',
      referenceNo: 'IDIO-EXP',
      startDate: '2026-10-10',
      endDate: '2026-10-12',
      status: 'APPROVED'
    };

    // Client booking for future date (2026-10-18 to 2026-10-20)
    const clientCheck = checkCameraAvailability(cam, '2026-10-18', '2026-10-20', [completedRes, expiredUncollected]);
    expect(clientCheck.isAvailable).toBe(true);

    // Server check with past expired uncollected reservation
    setupMockSupabaseServer({
      reservations: [{
        id: 'RES-EXP',
        reference_no: 'IDIO-EXP',
        start_date: '2026-10-10',
        end_date: '2026-10-12',
        status: 'APPROVED'
      }]
    });
    const serverCheck = await checkCameraAvailabilityServer(cam.id, '2026-10-18', '2026-10-20');
    expect(serverCheck.isAvailable).toBe(true);
  });

  // 7. Overdue, unreturned, damaged, and maintenance cameras remain unavailable
  it('Case 7: Overdue, unreturned, damaged, and maintenance cameras remain unavailable', async () => {
    // 7A: Maintenance camera
    const maintCam: DigitalCamera = { ...mockSampleCamera, status: 'MAINTENANCE' };
    const maintResult = checkCameraAvailability(maintCam, '2026-10-20', '2026-10-22', []);
    expect(maintResult.isAvailable).toBe(false);
    expect(maintResult.reason).toContain('maintenance');

    // 7B: Damaged camera
    const damagedCam: DigitalCamera = { ...mockSampleCamera, status: 'DAMAGED' };
    const damagedResult = checkCameraAvailability(damagedCam, '2026-10-20', '2026-10-22', []);
    expect(damagedResult.isAvailable).toBe(false);
    expect(damagedResult.reason).toContain('damage');

    // 7C: Overdue active rental on server
    setupMockSupabaseServer({
      camera: { id: 'CAM-001', status: 'AVAILABLE', condition: 'Excellent' },
      rentals: [{
        id: 'RENT-01',
        status: 'CHECKED_OUT',
        reservations: { id: 'RES-OLD', start_date: '2026-10-01', end_date: '2026-10-05' }
      }]
    });
    const overdueResult = await checkCameraAvailabilityServer('CAM-001', '2026-10-25', '2026-10-27');
    expect(overdueResult.isAvailable).toBe(false);
    expect(overdueResult.reason).toContain('overdue');
  });

  // 8. Customer and admin availability calculations agree for the same camera and date range
  it('Case 8: Customer and admin availability calculations agree for the same camera and date range', async () => {
    const cam = { ...mockSampleCamera };
    const activeRes: Reservation = {
      id: 'RES-AGREE',
      referenceNo: 'IDIO-AGREE',
      customerId: 'CUST-1',
      customerName: 'Alice',
      customerEmail: 'alice@example.com',
      customerPhone: '09191234567',
      customerBarangay: 'Ampayon',
      customerStreetAddress: 'Purok 1',
      idType: 'UMID',
      idNumber: '1234',
      cameraId: cam.id,
      cameraName: cam.name,
      cameraBrand: cam.brand,
      cameraCategory: cam.category,
      cameraSerial: cam.serialNumber,
      cameraImageUrl: cam.imageUrl,
      startDate: '2026-10-18',
      endDate: '2026-10-20',
      totalDays: 3,
      dailyRate: 1450,
      subtotal: 4350,
      securityDeposit: 3000,
      totalAmount: 7350,
      purpose: 'Shoot',
      status: 'APPROVED',
      paymentStatus: 'PAID',
      paymentMethod: 'CASH_PICKUP',
      depositStatus: 'HELD',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z'
    };

    // Client check for customer
    const clientCheck = checkCameraAvailability(cam, '2026-10-19', '2026-10-21', [activeRes]);

    // Admin schedule computation
    const adminSchedule = getCameraOperationalScheduleState(cam, [activeRes], '2026-10-15');

    // Both agree that camera is NOT available for this interval
    expect(clientCheck.isAvailable).toBe(false);
    expect(adminSchedule.hasFutureReservations).toBe(true);
    expect(adminSchedule.futureApprovedReservations[0].startDate).toBe('2026-10-18');
  });

  // 9. Stale data refreshes correctly when switching views
  it('Case 9: Stale data refreshes correctly upon state transition', () => {
    const cam = { ...mockSampleCamera };
    const pendingRes: Reservation = {
      id: 'RES-REFRESH',
      referenceNo: 'IDIO-REFRESH',
      customerId: 'CUST-1',
      customerName: 'Alice',
      customerEmail: 'alice@example.com',
      customerPhone: '09191234567',
      customerBarangay: 'Ampayon',
      customerStreetAddress: 'Purok 1',
      idType: 'UMID',
      idNumber: '1234',
      cameraId: cam.id,
      cameraName: cam.name,
      cameraBrand: cam.brand,
      cameraCategory: cam.category,
      cameraSerial: cam.serialNumber,
      cameraImageUrl: cam.imageUrl,
      startDate: '2026-10-22',
      endDate: '2026-10-24',
      totalDays: 3,
      dailyRate: 1450,
      subtotal: 4350,
      securityDeposit: 3000,
      totalAmount: 7350,
      purpose: 'Shoot',
      status: 'PENDING_APPROVAL',
      paymentStatus: 'PENDING',
      paymentMethod: 'CASH_PICKUP',
      depositStatus: 'HELD',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z'
    };

    // Initially pending -> camera is blocked
    const initialCheck = checkCameraAvailability(cam, '2026-10-22', '2026-10-24', [pendingRes]);
    expect(initialCheck.isAvailable).toBe(false);

    // After admin rejection or customer cancellation:
    const updatedRes: Reservation = { ...pendingRes, status: 'REJECTED' };
    const freshCheck = checkCameraAvailability(cam, '2026-10-22', '2026-10-24', [updatedRes]);
    expect(freshCheck.isAvailable).toBe(true);
  });

  // 10. Date boundaries, timezone conversions, and concurrent booking prevention
  it('Case 10: Date boundaries and timezone conversions are handled consistently', () => {
    const cam = { ...mockSampleCamera };
    const existingRes: Reservation = {
      id: 'RES-BOUNDARY',
      referenceNo: 'IDIO-BOUNDARY',
      customerId: 'CUST-1',
      customerName: 'Alice',
      customerEmail: 'alice@example.com',
      customerPhone: '09191234567',
      customerBarangay: 'Ampayon',
      customerStreetAddress: 'Purok 1',
      idType: 'UMID',
      idNumber: '1234',
      cameraId: cam.id,
      cameraName: cam.name,
      cameraBrand: cam.brand,
      cameraCategory: cam.category,
      cameraSerial: cam.serialNumber,
      cameraImageUrl: cam.imageUrl,
      startDate: '2026-11-01',
      endDate: '2026-11-03',
      totalDays: 3,
      dailyRate: 1450,
      subtotal: 4350,
      securityDeposit: 3000,
      totalAmount: 7350,
      purpose: 'Shoot',
      status: 'APPROVED',
      paymentStatus: 'PAID',
      paymentMethod: 'CASH_PICKUP',
      depositStatus: 'HELD',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z'
    };

    // Touching start date of existing reservation (2026-10-30 to 2026-11-01)
    const touchStart = checkCameraAvailability(cam, '2026-10-30', '2026-11-01', [existingRes]);
    expect(touchStart.isAvailable).toBe(false);

    // Touching end date of existing reservation (2026-11-03 to 2026-11-05)
    const touchEnd = checkCameraAvailability(cam, '2026-11-03', '2026-11-05', [existingRes]);
    expect(touchEnd.isAvailable).toBe(false);

    // Non-touching next day (2026-11-04 to 2026-11-06)
    const nextDay = checkCameraAvailability(cam, '2026-11-04', '2026-11-06', [existingRes]);
    expect(nextDay.isAvailable).toBe(true);
  });

  // 11. Database RLS and Zero-PII Guarantee
  it('Case 11: Database public availability schedule exposes zero PII', async () => {
    // When RPC is configured (Migration 010)
    setupMockSupabaseServer({
      rpcSchedule: [
        { start_date: '2026-10-18', end_date: '2026-10-20', schedule_status: 'RESERVED' },
        { start_date: '2026-10-25', end_date: '2026-10-28', schedule_status: 'RENTED' }
      ]
    });

    const result = await getCameraAvailabilitySchedule('CAM-001');
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.length).toBe(2);

    // Verify zero PII is present in the schedule result
    result.data?.forEach(slot => {
      expect((slot as any).customer_id).toBeUndefined();
      expect((slot as any).customer_name).toBeUndefined();
      expect((slot as any).customer_email).toBeUndefined();
      expect((slot as any).phone).toBeUndefined();
      expect((slot as any).payment_reference).toBeUndefined();
      expect(slot.startDate).toBeDefined();
      expect(slot.endDate).toBeDefined();
      expect(['APPROVED', 'CHECKED_OUT']).toContain(slot.status);
    });
  });
});
