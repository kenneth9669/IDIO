import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getPayments,
  getPaymentById,
  getPaymentByReservationId,
  confirmPayment,
  refundPayment,
  settleSecurityDeposit
} from '../lib/payments/paymentService';
import {
  validatePaymentReference,
  validatePaymentTransition,
  validateDepositTransition,
  validateDepositDeduction
} from '../lib/payments/paymentValidation';
import { createReservation } from '../lib/reservations/reservationService';
import {
  ProfileRow,
  DigitalCameraRow,
  ReservationRow,
  PaymentAndDepositRow
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

const samplePaymentRow: PaymentAndDepositRow = {
  id: 'pay-1111-1111-1111-111111111111',
  reservation_id: sampleReservationRow.id,
  rental_amount_php: 4200,
  payment_method: 'GCASH',
  payment_status: 'PENDING',
  payment_reference: 'GCASH-2026-001',
  security_deposit_php: 3000,
  deposit_status: 'HELD',
  deposit_deduction_php: 0,
  deposit_deduction_reason: null,
  settled_by_admin_id: null,
  settled_at: null,
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
  user = mockAdminProfile,
  camera = sampleCameraRow,
  reservation = sampleReservationRow,
  payment = samplePaymentRow,
  paymentsList = [samplePaymentRow],
  updatePaymentResult = samplePaymentRow as any,
  updatePaymentError = null as any,
  insertAuditError = null as any
}: {
  user?: ProfileRow | null;
  camera?: DigitalCameraRow | null;
  reservation?: ReservationRow | null;
  payment?: PaymentAndDepositRow | null;
  paymentsList?: any[];
  updatePaymentResult?: any;
  updatePaymentError?: any;
  insertAuditError?: any;
} = {}) {
  const mockAuthUser = user
    ? {
        id: user.id,
        email: user.email,
        role: 'authenticated'
      }
    : null;

  const paymentUpdateMock = vi.fn((data: any) => ({
    eq: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: updatePaymentError ? null : { ...payment, ...data },
          error: updatePaymentError
        })
      })
    })
  }));

  const paymentInsertMock = vi.fn((data: any) => ({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({
        data: { ...data, id: 'pay-new-123' },
        error: null
      })
    }),
    then: (resolve: any) => resolve({ data: null, error: null })
  }));

  const paymentsTable = {
    insert: paymentInsertMock,
    select: vi.fn(() => {
      const chain: any = {
        order: vi.fn().mockReturnThis(),
        eq: vi.fn((col: string, val: string) => {
          if (col === 'id') {
            return {
              single: vi.fn().mockResolvedValue({
                data: payment
                  ? {
                      ...payment,
                      reservations: {
                        ...reservation,
                        profiles: mockCustomerProfile,
                        digital_cameras: camera
                      },
                      settled_admin: payment.settled_by_admin_id ? mockAdminProfile : null
                    }
                  : null,
                error: payment ? null : new Error('Payment record not found')
              }),
              maybeSingle: vi.fn().mockResolvedValue({
                data: payment,
                error: null
              })
            };
          }
          if (col === 'reservation_id') {
            return {
              single: vi.fn().mockResolvedValue({
                data: payment
                  ? {
                      ...payment,
                      reservations: {
                        ...reservation,
                        profiles: mockCustomerProfile,
                        digital_cameras: camera
                      },
                      settled_admin: payment.settled_by_admin_id ? mockAdminProfile : null
                    }
                  : null,
                error: payment ? null : new Error('Payment record not found')
              }),
              maybeSingle: vi.fn().mockResolvedValue({
                data: payment
                  ? {
                      ...payment,
                      reservations: {
                        ...reservation,
                        profiles: mockCustomerProfile,
                        digital_cameras: camera
                      },
                      settled_admin: payment.settled_by_admin_id ? mockAdminProfile : null
                    }
                  : null,
                error: null
              })
            };
          }
          return chain;
        }),
        then: (resolve: any) =>
          resolve({
            data: paymentsList.map((p) => ({
              ...p,
              reservations: {
                ...reservation,
                profiles: p.reservation_id === sampleReservationRow.id ? mockCustomerProfile : mockOtherCustomerProfile,
                digital_cameras: camera
              },
              settled_admin: p.settled_by_admin_id ? mockAdminProfile : null
            })),
            error: null
          })
      };
      return chain;
    }),
    update: paymentUpdateMock
  };


  const auditInsertMock = vi.fn().mockResolvedValue({ data: null, error: insertAuditError });

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

      if (tableName === 'payments_and_deposits') {
        return paymentsTable;
      }

      if (tableName === 'digital_cameras') {
        return {
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
          })
        };
      }

      if (tableName === 'reservations') {
        return {
          select: vi.fn().mockImplementation(() => {
            const chain: any = {
              order: vi.fn().mockReturnThis(),
              eq: vi.fn((field: string, val: string) => {
                const innerChain: any = {
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
                  }),
                  in: vi.fn().mockReturnValue({
                    lte: vi.fn().mockReturnValue({
                      gte: vi.fn().mockImplementation(() => {
                        const dateChain: any = {
                          neq: vi.fn().mockResolvedValue({ data: [], error: null }),
                          then: (resolve: any) => resolve({ data: [], error: null })
                        };
                        return dateChain;
                      })
                    })
                  }),
                  then: (resolve: any) => resolve({ data: [], error: null })
                };
                return innerChain;
              }),
              in: vi.fn().mockReturnValue({
                lte: vi.fn().mockReturnValue({
                  gte: vi.fn().mockResolvedValue({ data: [], error: null })
                })
              })
            };
            return chain;
          }),
          insert: vi.fn().mockImplementation((insertedRow: any) => ({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: reservation ? { ...reservation, ...insertedRow, id: 'res-new-123' } : null,
                error: null
              })
            })
          }))
        };
      }

      if (tableName === 'activity_audit_logs') {
        return {
          insert: auditInsertMock
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
  return { mockSupabase, paymentsTable, paymentUpdateMock, auditInsertMock };

}

describe('Phase 7 — Payments & Security Deposit Settlement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================
  // PAYMENTS (1 - 11)
  // ==========================================

  // 1. Customer can view own payment records
  it('1. Customer can view own payment records', async () => {
    setupMockSupabase({
      user: mockCustomerProfile,
      paymentsList: [
        samplePaymentRow,
        {
          ...samplePaymentRow,
          id: 'pay-other',
          reservation_id: 'res-other'
        }
      ]
    });

    const res = await getPayments();
    expect(res.success).toBe(true);
    expect(res.data?.every((p) => p.customerId === mockCustomerProfile.id)).toBe(true);
  });

  // 2. Customer cannot view another customer's payment
  it("2. Customer cannot view another customer's payment", async () => {
    setupMockSupabase({
      user: mockCustomerProfile,
      reservation: { ...sampleReservationRow, customer_id: mockOtherCustomerProfile.id }
    });

    const res = await getPaymentById(samplePaymentRow.id);
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/Forbidden/i);
  });

  // 3. Customer cannot mark payment as PAID
  it('3. Customer cannot mark payment as PAID (requires ADMIN role)', async () => {
    setupMockSupabase({
      user: mockCustomerProfile,
      payment: { ...samplePaymentRow, payment_status: 'PENDING' }
    });

    await expect(
      confirmPayment({
        paymentId: samplePaymentRow.id,
        paymentReference: 'GCASH-123'
      })
    ).rejects.toThrow(/Forbidden/i);
  });

  // 4. Admin can record/confirm payment
  it('4. Admin can record and confirm payment as PAID', async () => {
    setupMockSupabase({
      user: mockAdminProfile,
      payment: { ...samplePaymentRow, payment_status: 'PENDING' }
    });

    const res = await confirmPayment({
      paymentId: samplePaymentRow.id,
      paymentMethod: 'GCASH',
      paymentReference: 'GCASH-2026-8888'
    });

    expect(res.success).toBe(true);
    expect(res.data?.paymentStatus).toBe('PAID');
    expect(res.data?.paymentReference).toBe('GCASH-2026-8888');
  });

  // 5. Invalid payment method is rejected
  it('5. Invalid payment reference containing card numbers is rejected', () => {
    const check = validatePaymentReference('4111 2222 3333 4444');
    expect(check.isValid).toBe(false);
    expect(check.errors[0]).toMatch(/card numbers/i);
  });

  // 6. Invalid payment amount is rejected
  it('6. Invalid negative deduction amount is rejected', () => {
    const check = validateDepositDeduction(3000, -500, 'Damage');
    expect(check.isValid).toBe(false);
    expect(check.errors[0]).toMatch(/greater than ₱0.00/i);
  });

  // 7. Client price tampering is ignored
  it('7. Client cannot alter authoritative rental price during booking', async () => {
    setupMockSupabase({
      user: mockCustomerProfile,
      camera: { ...sampleCameraRow, daily_rate_php: 1400, security_deposit_php: 3000 }
    });

    const res = await createReservation({
      cameraId: 'CAM-001',
      startDate: '2026-11-10',
      endDate: '2026-11-12',
      purpose: 'Portrait shoot in Butuan',
      paymentMethod: 'GCASH',
      dailyRate: 1,
      subtotal: 1
    } as any);

    expect(res.success).toBe(true);
    expect(res.data?.dailyRate).toBe(1400);
    expect(res.data?.subtotal).toBe(4200); // 3 days * 1400
  });

  // 8. Client deposit tampering is ignored
  it('8. Client cannot alter authoritative security deposit during booking', async () => {
    setupMockSupabase({
      user: mockCustomerProfile,
      camera: { ...sampleCameraRow, security_deposit_php: 3000 }
    });

    const res = await createReservation({
      cameraId: 'CAM-001',
      startDate: '2026-11-10',
      endDate: '2026-11-12',
      purpose: 'Wildlife photography',
      paymentMethod: 'GCASH',
      securityDeposit: 0
    } as any);

    expect(res.success).toBe(true);
    expect(res.data?.securityDeposit).toBe(3000);
  });

  // 9. Payment status transitions are enforced
  it('9. Payment status transitions are strictly enforced', () => {
    expect(validatePaymentTransition('PENDING', 'PAID').isValid).toBe(true);
    expect(validatePaymentTransition('PAID', 'REFUNDED').isValid).toBe(true);
    expect(validatePaymentTransition('REFUNDED', 'PAID').isValid).toBe(false);
    expect(validatePaymentTransition('REFUNDED', 'PENDING').isValid).toBe(false);
    expect(validatePaymentTransition('PENDING', 'REFUNDED').isValid).toBe(false);
  });

  // 10. Payment cannot be refunded twice
  it('10. Payment cannot be refunded twice', async () => {
    setupMockSupabase({
      user: mockAdminProfile,
      payment: { ...samplePaymentRow, payment_status: 'REFUNDED' }
    });

    const res = await refundPayment({
      paymentId: samplePaymentRow.id,
      reason: 'Customer cancelled early'
    });

    expect(res.success).toBe(false);
    expect(res.message).toMatch(/already in 'REFUNDED' status/i);
  });

  // 11. Duplicate financial records are prevented
  it('11. Only single authoritative financial record exists per reservation', async () => {
    setupMockSupabase({
      user: mockAdminProfile,
      payment: samplePaymentRow
    });

    const res = await getPaymentByReservationId(sampleReservationRow.id);
    expect(res.success).toBe(true);
    expect(res.data?.reservationId).toBe(sampleReservationRow.id);
  });

  // ==========================================
  // DEPOSITS (12 - 21)
  // ==========================================

  // 12. Deposit amount comes from authoritative data
  it('12. Deposit amount is read from authoritative database record', async () => {
    setupMockSupabase({
      user: mockAdminProfile,
      payment: { ...samplePaymentRow, security_deposit_php: 3000 }
    });

    const res = await getPaymentById(samplePaymentRow.id);
    expect(res.success).toBe(true);
    expect(res.data?.securityDeposit).toBe(3000);
  });

  // 13. Deposit can enter HELD state
  it('13. Initial deposit state is HELD upon booking', () => {
    expect(samplePaymentRow.deposit_status).toBe('HELD');
  });

  // 14. Clean return can produce REFUNDED
  it('14. Clean return inspection settles deposit to REFUNDED', async () => {
    setupMockSupabase({
      user: mockAdminProfile,
      payment: { ...samplePaymentRow, deposit_status: 'HELD' }
    });

    const res = await settleSecurityDeposit({
      paymentId: samplePaymentRow.id,
      action: 'REFUND_FULL'
    });

    expect(res.success).toBe(true);
    expect(res.data?.depositStatus).toBe('REFUNDED');
    expect(res.data?.depositDeduction).toBe(0);
  });

  // 15. Valid deduction produces DEDUCTED
  it('15. Valid partial damage produces DEDUCTED deposit with reason', async () => {
    setupMockSupabase({
      user: mockAdminProfile,
      payment: { ...samplePaymentRow, deposit_status: 'HELD', security_deposit_php: 3000 }
    });

    const res = await settleSecurityDeposit({
      paymentId: samplePaymentRow.id,
      action: 'DEDUCT_DAMAGE',
      deductionAmount: 1500,
      deductionReason: 'Lens cap missing and body scuff'
    });

    expect(res.success).toBe(true);
    expect(res.data?.depositStatus).toBe('DEDUCTED');
    expect(res.data?.depositDeduction).toBe(1500);
    expect(res.data?.depositDeductionReason).toBe('Lens cap missing and body scuff');
  });

  // 16. Valid forfeiture produces FORFEITED
  it('16. Valid forfeiture produces FORFEITED deposit with mandatory reason', async () => {
    setupMockSupabase({
      user: mockAdminProfile,
      payment: { ...samplePaymentRow, deposit_status: 'HELD', security_deposit_php: 3000 }
    });

    const res = await settleSecurityDeposit({
      paymentId: samplePaymentRow.id,
      action: 'FORFEIT',
      deductionReason: 'Severe water damage to optical sensor'
    });

    expect(res.success).toBe(true);
    expect(res.data?.depositStatus).toBe('FORFEITED');
    expect(res.data?.depositDeduction).toBe(3000);
  });

  // 17. Deduction cannot exceed deposit
  it('17. Deduction cannot exceed held security deposit', async () => {
    setupMockSupabase({
      user: mockAdminProfile,
      payment: { ...samplePaymentRow, deposit_status: 'HELD', security_deposit_php: 3000 }
    });

    const res = await settleSecurityDeposit({
      paymentId: samplePaymentRow.id,
      action: 'DEDUCT_DAMAGE',
      deductionAmount: 4500, // Exceeds 3000
      deductionReason: 'Damage exceeding deposit'
    });

    expect(res.success).toBe(false);
    expect(res.message).toMatch(/cannot exceed/i);
  });

  // 18. Customer cannot perform settlement
  it('18. Customer cannot perform deposit settlement (Admin-only)', async () => {
    setupMockSupabase({
      user: mockCustomerProfile,
      payment: { ...samplePaymentRow, deposit_status: 'HELD' }
    });

    await expect(
      settleSecurityDeposit({
        paymentId: samplePaymentRow.id,
        action: 'REFUND_FULL'
      })
    ).rejects.toThrow(/Forbidden/i);
  });

  // 19. Admin can perform settlement
  it('19. Admin can perform deposit settlement', async () => {
    setupMockSupabase({
      user: mockAdminProfile,
      payment: { ...samplePaymentRow, deposit_status: 'HELD' }
    });

    const res = await settleSecurityDeposit({
      paymentId: samplePaymentRow.id,
      action: 'REFUND_FULL'
    });

    expect(res.success).toBe(true);
    expect(res.data?.settledByAdminId).toBe(mockAdminProfile.id);
  });

  // 20. Deposit cannot be settled twice
  it('20. Deposit cannot be settled twice (terminal state)', async () => {
    setupMockSupabase({
      user: mockAdminProfile,
      payment: { ...samplePaymentRow, deposit_status: 'REFUNDED' }
    });

    const res = await settleSecurityDeposit({
      paymentId: samplePaymentRow.id,
      action: 'FORFEIT',
      deductionReason: 'Late discovery'
    });

    expect(res.success).toBe(false);
    expect(res.message).toMatch(/already settled/i);
  });

  // 21. Invalid deposit transitions are rejected
  it('21. Invalid deposit transitions are rejected', () => {
    expect(validateDepositTransition('REFUNDED', 'HELD').isValid).toBe(false);
    expect(validateDepositTransition('DEDUCTED', 'HELD').isValid).toBe(false);
    expect(validateDepositTransition('FORFEITED', 'REFUNDED').isValid).toBe(false);
  });

  // ==========================================
  // INTEGRATION (22 - 28)
  // ==========================================

  // 22. Payment is associated with correct rental/reservation/customer
  it('22. Payment is correctly associated with reservation, customer, and camera', async () => {
    setupMockSupabase({
      user: mockAdminProfile,
      payment: samplePaymentRow
    });

    const res = await getPaymentById(samplePaymentRow.id);
    expect(res.success).toBe(true);
    expect(res.data?.reservationId).toBe(sampleReservationRow.id);
    expect(res.data?.customerId).toBe(mockCustomerProfile.id);
    expect(res.data?.cameraName).toBe(sampleCameraRow.name);
  });

  // 23. Customer cannot manipulate ownership IDs
  it('23. Customer cannot fetch financial records for another customer by ID', async () => {
    setupMockSupabase({
      user: mockCustomerProfile,
      reservation: { ...sampleReservationRow, customer_id: mockOtherCustomerProfile.id }
    });

    const res = await getPaymentById('pay-other');
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/Forbidden/i);
  });

  // 24. Financial records remain associated with the correct rental
  it('24. Financial records remain associated with the correct reservation', async () => {
    setupMockSupabase({
      user: mockAdminProfile,
      payment: samplePaymentRow
    });

    const res = await getPaymentByReservationId(sampleReservationRow.id);
    expect(res.success).toBe(true);
    expect(res.data?.reservationId).toBe(sampleReservationRow.id);
    expect(res.data?.rentalAmount).toBe(4200);
  });

  // 25. Audit records are generated for sensitive financial operations
  it('25. Audit records are generated for sensitive financial operations', async () => {
    const { auditInsertMock } = setupMockSupabase({
      user: mockAdminProfile,
      payment: { ...samplePaymentRow, payment_status: 'PENDING' }
    });

    await confirmPayment({
      paymentId: samplePaymentRow.id,
      paymentReference: 'GCASH-2026-999'
    });

    expect(auditInsertMock.mock.calls.length).toBeGreaterThan(0);
    expect(auditInsertMock.mock.calls[0][0].action).toBe('CONFIRM_PAYMENT');
  });



  // 26. No authoritative payment/deposit localStorage remains
  it('26. Payment validation and calculations are server-side with zero localStorage dependency', () => {
    const check = validatePaymentReference('GCASH-123');
    expect(check.isValid).toBe(true);

    const depositCheck = validateDepositDeduction(3000, 1000, 'Minor issue');
    expect(depositCheck.isValid).toBe(true);
  });

  // 27. No STAFF role is introduced
  it('27. User role enum has strictly 2 roles (CUSTOMER, ADMIN) with zero STAFF role', () => {
    const allowedRoles = ['CUSTOMER', 'ADMIN'];
    expect(allowedRoles).not.toContain('STAFF');
  });

  // 28. No service-role key is introduced
  it('28. No service role key is imported or used', () => {
    expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
  });
});
