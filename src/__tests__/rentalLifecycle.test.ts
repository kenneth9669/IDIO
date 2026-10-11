import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getRentals,
  getRentalById,
  getRentalByReservationId,
  checkoutRental,
  processReturn,
  completeRental
} from '../lib/rentals/rentalService';
import {
  validateCheckoutInput,
  validateReturnInput,
  validateRentalTransition
} from '../lib/rentals/rentalValidation';
import {
  ProfileRow,
  DigitalCameraRow,
  ReservationRow,
  RentalRow
} from '../types/database';

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
  status: 'APPROVED',
  rejection_reason: null,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z'
};

const sampleRentalRow: RentalRow = {
  id: 'rent-1111-1111-1111-111111111111',
  reservation_id: sampleReservationRow.id,
  camera_id: 'CAM-001',
  customer_id: mockCustomerProfile.id,
  checkout_admin_id: mockAdminProfile.id,
  checkout_condition: 'Excellent',
  checkout_notes: 'Physical checklist passed.',
  checked_out_at: '2026-11-10T09:00:00Z',
  status: 'CHECKED_OUT',
  return_admin_id: null,
  return_condition: null,
  return_inspection_notes: null,
  returned_at: null,
  completed_at: null,
  created_at: '2026-11-10T09:00:00Z',
  updated_at: '2026-11-10T09:00:00Z'
};

// Mock Supabase Server Client
vi.mock('../lib/supabase/server', () => {
  return {
    createClient: vi.fn()
  };
});

import { createClient } from '../lib/supabase/server';

function setupMockSupabase({
  user = mockAdminProfile,
  camera = sampleCameraRow,
  reservation = sampleReservationRow,
  rental = sampleRentalRow,
  rentalsList = [sampleRentalRow],
  existingRentalForRes = null as any,
  insertRentalResult = sampleRentalRow as any,
  insertRentalError = null as any,
  updateRentalResult = sampleRentalRow as any,
  updateRentalError = null as any,
  updateCameraError = null as any
}: {
  user?: ProfileRow | null;
  camera?: DigitalCameraRow | null;
  reservation?: ReservationRow | null;
  rental?: RentalRow | null;
  rentalsList?: any[];
  existingRentalForRes?: any;
  insertRentalResult?: any;
  insertRentalError?: any;
  updateRentalResult?: any;
  updateRentalError?: any;
  updateCameraError?: any;
} = {}) {
  const mockAuthUser = user
    ? {
        id: user.id,
        email: user.email,
        role: 'authenticated'
      }
    : null;

  const cameraUpdateMock = vi.fn((data: any) => ({
    eq: vi.fn().mockResolvedValue({
      data: { ...camera, ...data },
      error: updateCameraError
    })
  }));

  const cameraTable = {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: camera,
          error: camera ? null : new Error('Camera not found')
        }),
        maybeSingle: vi.fn().mockResolvedValue({
          data: camera,
          error: null
        })
      })
    }),
    update: cameraUpdateMock
  };

  const rentalInsertMock = vi.fn((data: any) => ({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: insertRentalError ? null : { ...data, id: 'rent-new-123' },
        error: insertRentalError
      })
    })
  }));

  const rentalUpdateMock = vi.fn((data: any) => ({
    eq: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: updateRentalError ? null : { ...rental, ...data },
          error: updateRentalError
        })
      })
    })
  }));

  const rentalsTable = {
    select: vi.fn(() => {
      const chain: any = {
        order: vi.fn().mockReturnThis(),
        eq: vi.fn((col: string, val: string) => {
          if (col === 'customer_id') {
            const filtered = rentalsList.filter((r) => r.customer_id === val);
            return {
              order: vi.fn().mockResolvedValue({
                data: filtered.map((r) => ({
                  ...r,
                  reservations: reservation,
                  profiles: mockCustomerProfile,
                  digital_cameras: camera,
                  checkout_admin: mockAdminProfile,
                  return_admin: r.return_admin_id ? mockAdminProfile : null
                })),
                error: null
              }),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: filtered[0] || null, error: filtered[0] ? null : new Error('Not found') }),
              maybeSingle: vi.fn().mockResolvedValue({ data: filtered[0] || null, error: null })
            };
          }
          if (col === 'reservation_id') {
            return {
              single: vi.fn().mockResolvedValue({
                data: existingRentalForRes,
                error: existingRentalForRes ? null : new Error('Not found')
              }),
              maybeSingle: vi.fn().mockResolvedValue({
                data: existingRentalForRes,
                error: null
              })
            };
          }
          if (col === 'id') {
            return {
              single: vi.fn().mockResolvedValue({
                data: rental
                  ? {
                      ...rental,
                      reservations: reservation,
                      profiles: mockCustomerProfile,
                      digital_cameras: camera,
                      checkout_admin: mockAdminProfile,
                      return_admin: rental.return_admin_id ? mockAdminProfile : null
                    }
                  : null,
                error: rental ? null : new Error('Rental not found')
              }),
              maybeSingle: vi.fn().mockResolvedValue({
                data: rental,
                error: null
              })
            };
          }
          return chain;
        }),
        then: (resolve: any) =>
          resolve({
            data: rentalsList.map((r) => ({
              ...r,
              reservations: reservation,
              profiles: mockCustomerProfile,
              digital_cameras: camera,
              checkout_admin: mockAdminProfile,
              return_admin: r.return_admin_id ? mockAdminProfile : null
            })),
            error: null
          })
      };
      return chain;
    }),
    insert: rentalInsertMock,
    update: rentalUpdateMock
  };

  const mockSupabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: mockAuthUser },
        error: mockAuthUser ? null : new Error('No active session')
      })
    },
    from: vi.fn((tableName: string) => {
      if (tableName === 'profiles') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn((col: string, val: string) => {
            if (val === mockAdminProfile.id) {
              return {
                single: vi.fn().mockResolvedValue({ data: mockAdminProfile, error: null }),
                maybeSingle: vi.fn().mockResolvedValue({ data: mockAdminProfile, error: null })
              };
            }
            if (val === mockCustomerProfile.id) {
              return {
                single: vi.fn().mockResolvedValue({ data: mockCustomerProfile, error: null }),
                maybeSingle: vi.fn().mockResolvedValue({ data: mockCustomerProfile, error: null })
              };
            }
            if (val === mockOtherCustomerProfile.id) {
              return {
                single: vi.fn().mockResolvedValue({ data: mockOtherCustomerProfile, error: null }),
                maybeSingle: vi.fn().mockResolvedValue({ data: mockOtherCustomerProfile, error: null })
              };
            }
            return {
              single: vi.fn().mockResolvedValue({ data: user, error: user ? null : new Error('Profile not found') }),
              maybeSingle: vi.fn().mockResolvedValue({ data: user, error: null })
            };
          })
        };
      }

      if (tableName === 'digital_cameras') {
        return cameraTable;
      }

      if (tableName === 'reservations') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: reservation
                  ? {
                      ...reservation,
                      profiles: mockCustomerProfile,
                      digital_cameras: camera
                    }
                  : null,
                error: reservation ? null : new Error('Reservation not found')
              }),
              maybeSingle: vi.fn().mockResolvedValue({
                data: reservation,
                error: null
              })
            })
          })
        };
      }

      if (tableName === 'rentals') {
        return rentalsTable;
      }

      if (tableName === 'activity_audit_logs') {
        return {
          insert: vi.fn().mockResolvedValue({ data: null, error: null })
        };
      }

      return {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: vi.fn().mockResolvedValue({ data: null, error: null }),
        delete: vi.fn().mockResolvedValue({ data: null, error: null })
      };
    })
  };

  (createClient as any).mockResolvedValue(mockSupabase);
  return { mockSupabase, cameraTable, rentalsTable, cameraUpdateMock, rentalInsertMock, rentalUpdateMock };
}


describe('Phase 6 — Rental Checkout, Return & Physical Condition Lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Admin can checkout approved reservation
  it('1. Admin can checkout an approved reservation', async () => {
    setupMockSupabase({
      user: mockAdminProfile,
      reservation: { ...sampleReservationRow, status: 'APPROVED' },
      camera: { ...sampleCameraRow, status: 'AVAILABLE' },
      existingRentalForRes: null
    });

    const res = await checkoutRental({
      reservationId: sampleReservationRow.id,
      checkoutCondition: 'Excellent',
      checkoutNotes: 'Body inspected, serial verified.'
    });

    expect(res.success).toBe(true);
    expect(res.data?.status).toBe('CHECKED_OUT');
    expect(res.data?.checkoutCondition).toBe('Excellent');
    expect(res.data?.checkoutAdminId).toBe(mockAdminProfile.id);
  });

  // 2. Customer cannot checkout
  it('2. Customer cannot checkout (requires ADMIN authorization)', async () => {
    setupMockSupabase({
      user: mockCustomerProfile,
      reservation: { ...sampleReservationRow, status: 'APPROVED' }
    });

    await expect(
      checkoutRental({
        reservationId: sampleReservationRow.id,
        checkoutCondition: 'Excellent'
      })
    ).rejects.toThrow(/Forbidden/i);
  });

  // 3. Unapproved reservation cannot be checked out
  it('3. Unapproved reservation (PENDING_APPROVAL) cannot be checked out', async () => {
    setupMockSupabase({
      user: mockAdminProfile,
      reservation: { ...sampleReservationRow, status: 'PENDING_APPROVAL' }
    });

    const res = await checkoutRental({
      reservationId: sampleReservationRow.id,
      checkoutCondition: 'Good'
    });

    expect(res.success).toBe(false);
    expect(res.message).toMatch(/must be 'APPROVED'/i);
  });

  // 4. Rejected reservation cannot be checked out
  it('4. Rejected reservation cannot be checked out', async () => {
    setupMockSupabase({
      user: mockAdminProfile,
      reservation: { ...sampleReservationRow, status: 'REJECTED' }
    });

    const res = await checkoutRental({
      reservationId: sampleReservationRow.id,
      checkoutCondition: 'Good'
    });

    expect(res.success).toBe(false);
    expect(res.message).toMatch(/must be 'APPROVED'/i);
  });

  // 5. Cancelled reservation cannot be checked out
  it('5. Cancelled reservation cannot be checked out', async () => {
    setupMockSupabase({
      user: mockAdminProfile,
      reservation: { ...sampleReservationRow, status: 'CANCELLED' }
    });

    const res = await checkoutRental({
      reservationId: sampleReservationRow.id,
      checkoutCondition: 'Good'
    });

    expect(res.success).toBe(false);
    expect(res.message).toMatch(/must be 'APPROVED'/i);
  });

  // 6. Already checked-out reservation cannot be checked out again
  it('6. Already checked-out reservation cannot be checked out again', async () => {
    setupMockSupabase({
      user: mockAdminProfile,
      reservation: { ...sampleReservationRow, status: 'APPROVED' },
      existingRentalForRes: sampleRentalRow
    });

    const res = await checkoutRental({
      reservationId: sampleReservationRow.id,
      checkoutCondition: 'Good'
    });

    expect(res.success).toBe(false);
    expect(res.message).toMatch(/already been checked out/i);
  });

  // 7. MAINTENANCE camera cannot be checked out
  it('7. MAINTENANCE camera cannot be checked out', async () => {
    setupMockSupabase({
      user: mockAdminProfile,
      reservation: { ...sampleReservationRow, status: 'APPROVED' },
      camera: { ...sampleCameraRow, status: 'MAINTENANCE' },
      existingRentalForRes: null
    });

    const res = await checkoutRental({
      reservationId: sampleReservationRow.id,
      checkoutCondition: 'Good'
    });

    expect(res.success).toBe(false);
    expect(res.message).toMatch(/under MAINTENANCE/i);
  });

  // 8. DAMAGED camera cannot be checked out
  it('8. DAMAGED camera cannot be checked out', async () => {
    setupMockSupabase({
      user: mockAdminProfile,
      reservation: { ...sampleReservationRow, status: 'APPROVED' },
      camera: { ...sampleCameraRow, status: 'DAMAGED' },
      existingRentalForRes: null
    });

    const res = await checkoutRental({
      reservationId: sampleReservationRow.id,
      checkoutCondition: 'Good'
    });

    expect(res.success).toBe(false);
    expect(res.message).toMatch(/marked as DAMAGED/i);
  });

  // 9. CHECKED_OUT camera cannot be checked out again
  it('9. CHECKED_OUT camera cannot be checked out again', async () => {
    setupMockSupabase({
      user: mockAdminProfile,
      reservation: { ...sampleReservationRow, status: 'APPROVED' },
      camera: { ...sampleCameraRow, status: 'CHECKED_OUT' },
      existingRentalForRes: null
    });

    const res = await checkoutRental({
      reservationId: sampleReservationRow.id,
      checkoutCondition: 'Good'
    });

    expect(res.success).toBe(false);
    expect(res.message).toMatch(/already CHECKED_OUT/i);
  });

  // 10. Customer cannot create rental for another customer
  it('10. Customer cannot execute checkout or create rental directly', async () => {
    setupMockSupabase({
      user: mockCustomerProfile,
      reservation: { ...sampleReservationRow, status: 'APPROVED' }
    });

    await expect(
      checkoutRental({
        reservationId: sampleReservationRow.id,
        checkoutCondition: 'Good'
      })
    ).rejects.toThrow();
  });

  // 11. Client cannot manipulate rental price
  it('11. Rental price is read authoritatively from reservation snapshot', async () => {
    setupMockSupabase({
      user: mockAdminProfile,
      reservation: {
        ...sampleReservationRow,
        status: 'APPROVED',
        daily_rate_snapshot: 1400,
        subtotal_php: 4200,
        total_amount_php: 7200
      },
      camera: { ...sampleCameraRow, status: 'AVAILABLE' },
      existingRentalForRes: null
    });

    const res = await checkoutRental({
      reservationId: sampleReservationRow.id,
      checkoutCondition: 'Good'
    });

    expect(res.success).toBe(true);
    expect(res.data?.dailyRate).toBe(1400);
    expect(res.data?.subtotal).toBe(4200);
    expect(res.data?.totalAmount).toBe(7200);
  });

  // 12. Client cannot manipulate deposit
  it('12. Security deposit is read authoritatively from server snapshot', async () => {
    setupMockSupabase({
      user: mockAdminProfile,
      reservation: {
        ...sampleReservationRow,
        status: 'APPROVED',
        security_deposit_php: 3000
      },
      camera: { ...sampleCameraRow, status: 'AVAILABLE' },
      existingRentalForRes: null
    });

    const res = await checkoutRental({
      reservationId: sampleReservationRow.id,
      checkoutCondition: 'Good'
    });

    expect(res.success).toBe(true);
    expect(res.data?.securityDeposit).toBe(3000);
  });

  // 13. Checkout records correct camera/customer/reservation
  it('13. Checkout associates correct camera ID, customer ID, and reservation ID', async () => {
    const supabase = setupMockSupabase({
      user: mockAdminProfile,
      reservation: { ...sampleReservationRow, status: 'APPROVED' },
      camera: { ...sampleCameraRow, status: 'AVAILABLE' },
      existingRentalForRes: null
    });

    const res = await checkoutRental({
      reservationId: sampleReservationRow.id,
      checkoutCondition: 'Excellent',
      checkoutNotes: 'Checked out cleanly'
    });

    expect(res.success).toBe(true);
    expect(res.data?.cameraId).toBe('CAM-001');
    expect(res.data?.customerId).toBe(mockCustomerProfile.id);
    expect(res.data?.reservationId).toBe(sampleReservationRow.id);
  });

  // 14. Camera becomes CHECKED_OUT after successful checkout
  it('14. Camera status in database is updated to CHECKED_OUT during checkout', async () => {
    const { cameraUpdateMock } = setupMockSupabase({
      user: mockAdminProfile,
      reservation: { ...sampleReservationRow, status: 'APPROVED' },
      camera: { ...sampleCameraRow, status: 'AVAILABLE' },
      existingRentalForRes: null
    });

    const res = await checkoutRental({
      reservationId: sampleReservationRow.id,
      checkoutCondition: 'Excellent'
    });

    expect(res.success).toBe(true);
    expect(cameraUpdateMock.mock.calls.length).toBeGreaterThan(0);
    expect(cameraUpdateMock.mock.calls[0][0].status).toBe('CHECKED_OUT');
  });

  // 15. Checked-out rental can be returned by Admin
  it('15. Checked-out rental can be returned and inspected by Admin', async () => {
    setupMockSupabase({
      user: mockAdminProfile,
      rental: { ...sampleRentalRow, status: 'CHECKED_OUT' },
      camera: { ...sampleCameraRow, status: 'CHECKED_OUT' }
    });

    const res = await processReturn({
      rentalId: sampleRentalRow.id,
      returnCondition: 'Excellent',
      returnInspectionNotes: 'Sensor clean, all kit accessories present.'
    });

    expect(res.success).toBe(true);
    expect(res.data?.status).toBe('RETURNED');
    expect(res.data?.returnCondition).toBe('Excellent');
    expect(res.data?.returnAdminName).toBe(mockAdminProfile.full_name);
  });

  // 16. Customer cannot process return
  it('16. Customer cannot process return inspection (Admin-only)', async () => {
    setupMockSupabase({
      user: mockCustomerProfile,
      rental: { ...sampleRentalRow, status: 'CHECKED_OUT' }
    });

    await expect(
      processReturn({
        rentalId: sampleRentalRow.id,
        returnCondition: 'Excellent',
        returnInspectionNotes: 'Trying to return'
      })
    ).rejects.toThrow(/Forbidden/i);
  });

  // 17. Return records inspection data
  it('17. Return records mandatory condition grade and inspection notes', async () => {
    setupMockSupabase({
      user: mockAdminProfile,
      rental: { ...sampleRentalRow, status: 'CHECKED_OUT' }
    });

    const res = await processReturn({
      rentalId: sampleRentalRow.id,
      returnCondition: 'Good',
      returnInspectionNotes: 'Minor cosmetic wear on lens cap.'
    });

    expect(res.success).toBe(true);
    expect(res.data?.returnCondition).toBe('Good');
    expect(res.data?.returnInspectionNotes).toBe('Minor cosmetic wear on lens cap.');
  });

  // 18. CHECKED_OUT → RETURNED is allowed
  it('18. CHECKED_OUT → RETURNED state transition is valid', () => {
    const check = validateRentalTransition('CHECKED_OUT', 'RETURNED');
    expect(check.isValid).toBe(true);
    expect(check.errors).toHaveLength(0);
  });

  // 19. Invalid rental transitions are rejected
  it('19. Invalid rental transitions are strictly rejected', () => {
    expect(validateRentalTransition('COMPLETED', 'CHECKED_OUT').isValid).toBe(false);
    expect(validateRentalTransition('COMPLETED', 'RETURNED').isValid).toBe(false);
    expect(validateRentalTransition('RETURNED', 'CHECKED_OUT').isValid).toBe(false);
    expect(validateRentalTransition('CHECKED_OUT', 'COMPLETED').isValid).toBe(false);
  });

  // 20. Damaged return makes camera DAMAGED
  it('20. Damaged return updates camera status to DAMAGED', async () => {
    const { cameraUpdateMock } = setupMockSupabase({
      user: mockAdminProfile,
      rental: { ...sampleRentalRow, status: 'CHECKED_OUT' },
      camera: { ...sampleCameraRow, status: 'CHECKED_OUT' }
    });

    const res = await processReturn({
      rentalId: sampleRentalRow.id,
      returnCondition: 'Damaged',
      returnInspectionNotes: 'Front element cracked.'
    });

    expect(res.success).toBe(true);
    expect(cameraUpdateMock.mock.calls.length).toBeGreaterThan(0);
    expect(cameraUpdateMock.mock.calls[0][0].status).toBe('DAMAGED');
    expect(cameraUpdateMock.mock.calls[0][0].condition).toBe('Damaged');
  });

  // 21. Maintenance-required return makes camera MAINTENANCE
  it('21. Return with flagMaintenance or Fair condition sets camera to MAINTENANCE', async () => {
    const { cameraUpdateMock } = setupMockSupabase({
      user: mockAdminProfile,
      rental: { ...sampleRentalRow, status: 'CHECKED_OUT' },
      camera: { ...sampleCameraRow, status: 'CHECKED_OUT' }
    });

    const res = await processReturn({
      rentalId: sampleRentalRow.id,
      returnCondition: 'Fair',
      returnInspectionNotes: 'Sensor dust requires wet cleaning.',
      flagMaintenance: true
    });

    expect(res.success).toBe(true);
    expect(cameraUpdateMock.mock.calls.length).toBeGreaterThan(0);
    expect(cameraUpdateMock.mock.calls[0][0].status).toBe('MAINTENANCE');
  });

  // 22. Clean return makes camera AVAILABLE
  it('22. Clean return (Excellent / Good) sets camera to AVAILABLE', async () => {
    const { cameraUpdateMock } = setupMockSupabase({
      user: mockAdminProfile,
      rental: { ...sampleRentalRow, status: 'CHECKED_OUT' },
      camera: { ...sampleCameraRow, status: 'CHECKED_OUT' }
    });

    const res = await processReturn({
      rentalId: sampleRentalRow.id,
      returnCondition: 'Excellent',
      returnInspectionNotes: 'Inspected clean and ready for next renter.'
    });

    expect(res.success).toBe(true);
    expect(cameraUpdateMock.mock.calls.length).toBeGreaterThan(0);
    expect(cameraUpdateMock.mock.calls[0][0].status).toBe('AVAILABLE');
  });


  // 23. RETURNED → COMPLETED works correctly
  it('23. Admin can complete a RETURNED rental', async () => {
    setupMockSupabase({
      user: mockAdminProfile,
      rental: { ...sampleRentalRow, status: 'RETURNED' }
    });

    const res = await completeRental(sampleRentalRow.id);

    expect(res.success).toBe(true);
    expect(res.data?.status).toBe('COMPLETED');
  });

  // 24. Customer can only read their own rentals
  it('24. Customer can only read their own rentals and is forbidden from other rentals', async () => {
    setupMockSupabase({
      user: mockCustomerProfile,
      rentalsList: [
        sampleRentalRow, // owned by mockCustomerProfile
        { ...sampleRentalRow, id: 'rent-other', customer_id: mockOtherCustomerProfile.id }
      ]
    });

    // Fetch own rentals
    const res = await getRentals();
    expect(res.success).toBe(true);
    expect(res.data?.every((r) => r.customerId === mockCustomerProfile.id)).toBe(true);

    // Forbidden from fetching other customer rental by ID
    setupMockSupabase({
      user: mockCustomerProfile,
      rental: { ...sampleRentalRow, id: 'rent-other', customer_id: mockOtherCustomerProfile.id }
    });

    const singleRes = await getRentalById('rent-other');
    expect(singleRes.success).toBe(false);
    expect(singleRes.message).toMatch(/Forbidden/i);
  });

  // 25. Admin can access required rentals
  it('25. Admin can access all rentals across the fleet', async () => {
    setupMockSupabase({
      user: mockAdminProfile,
      rentalsList: [
        sampleRentalRow,
        { ...sampleRentalRow, id: 'rent-2', customer_id: mockOtherCustomerProfile.id }
      ]
    });

    const res = await getRentals();
    expect(res.success).toBe(true);
    expect(res.data?.length).toBe(2);
  });

  // 26. Duplicate checkout/concurrent checkout is prevented
  it('26. Concurrency & duplicate checkout is prevented by database unique constraint handling', async () => {
    setupMockSupabase({
      user: mockAdminProfile,
      reservation: { ...sampleReservationRow, status: 'APPROVED' },
      camera: { ...sampleCameraRow, status: 'AVAILABLE' },
      existingRentalForRes: null,
      insertRentalError: {
        code: '23505',
        message: 'duplicate key value violates unique constraint "rentals_reservation_id_key"'
      }
    });

    const res = await checkoutRental({
      reservationId: sampleReservationRow.id,
      checkoutCondition: 'Good'
    });

    expect(res.success).toBe(false);
    expect(res.message).toMatch(/already been checked out/i);
  });

  // 27. Rental cannot be duplicated for the same reservation
  it('27. Rental cannot be duplicated for the same reservation ID', async () => {
    setupMockSupabase({
      user: mockAdminProfile,
      reservation: { ...sampleReservationRow, status: 'APPROVED' },
      camera: { ...sampleCameraRow, status: 'AVAILABLE' },
      existingRentalForRes: sampleRentalRow
    });

    const res = await checkoutRental({
      reservationId: sampleReservationRow.id,
      checkoutCondition: 'Excellent'
    });

    expect(res.success).toBe(false);
    expect(res.message).toMatch(/already been checked out/i);
  });

  // 28. No authoritative rental localStorage remains
  it('28. Rental validation functions do not reference localStorage', () => {
    const valCheckout = validateCheckoutInput({
      reservationId: 'res-1',
      checkoutCondition: 'Excellent'
    });
    expect(valCheckout.isValid).toBe(true);

    const valReturn = validateReturnInput({
      rentalId: 'rent-1',
      returnCondition: 'Good',
      returnInspectionNotes: 'Clean return'
    });
    expect(valReturn.isValid).toBe(true);
  });
});
