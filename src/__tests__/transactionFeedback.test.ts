import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DigitalCamera, Reservation, PaymentAndDeposit, Rental } from '../types';
import { checkCameraAvailability } from '../lib/availabilityEngine';
import {
  approveReservation,
  rejectReservation,
  cancelReservation,
  checkCameraAvailabilityServer
} from '../lib/reservations/reservationService';
import {
  checkoutRental,
  processReturn,
  completeRental
} from '../lib/rentals/rentalService';
import {
  confirmPayment,
  settleSecurityDeposit,
  refundPayment
} from '../lib/payments/paymentService';
import { ProfileRow, DigitalCameraRow, ReservationRow, PaymentAndDepositRow, RentalRow } from '../types/database';

vi.mock('../lib/supabase/server', () => {
  return {
    createClient: vi.fn()
  };
});

import { createClient } from '../lib/supabase/server';

const mockAdminProfile: ProfileRow = {
  id: 'admin-uuid-001',
  role: 'ADMIN',
  full_name: 'Admin Dave',
  email: 'admin@idiocameras.ph',
  phone: '0917-000-0001',
  avatar_url: null,
  barangay: 'Libertad',
  street_address: 'Main St',
  city: 'Butuan City',
  province: 'Agusan del Norte',
  id_type: 'Passport',
  id_number: 'P1234567A',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

const mockCustomerProfile: ProfileRow = {
  id: 'cust-uuid-101',
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
  status: 'PENDING_APPROVAL',
  rejection_reason: null,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-01T00:00:00Z'
};

describe('IDIO — Transaction Feedback & Authoritative Server Outcomes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Reservation Approval & Rejection Outcomes', () => {
    it('approves a pending reservation and returns authoritative success message', async () => {
      const mockClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: mockAdminProfile.id } },
            error: null
          })
        },
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'profiles') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockAdminProfile, error: null })
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
                      ...sampleReservationRow,
                      profiles: mockCustomerProfile,
                      digital_cameras: sampleCameraRow,
                      payments_and_deposits: []
                    },
                    error: null
                  }),
                  in: vi.fn().mockReturnValue({
                    lte: vi.fn().mockReturnValue({
                      gte: vi.fn().mockReturnValue({
                        neq: vi.fn().mockResolvedValue({ data: [], error: null })
                      })
                    })
                  })
                })
              }),
              update: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: {
                        ...sampleReservationRow,
                        status: 'APPROVED'
                      },
                      error: null
                    })
                  })
                })
              })
            };
          }
          if (table === 'digital_cameras') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: sampleCameraRow, error: null })
                })
              })
            };
          }
          return { select: vi.fn().mockReturnThis() };
        })
      };

      (createClient as any).mockResolvedValue(mockClient);

      const result = await approveReservation(sampleReservationRow.id);
      expect(result.success).toBe(true);
      expect(result.message).toContain('approved for pickup');
      expect(result.data?.status).toBe('APPROVED');
    });

    it('rejects a pending reservation, stores the rejection reason, and returns clear feedback', async () => {
      const rejectionReason = 'Customer ID document expired. Please update and reapply.';
      const mockClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: mockAdminProfile.id } },
            error: null
          })
        },
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'profiles') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockAdminProfile, error: null })
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
                      ...sampleReservationRow,
                      profiles: mockCustomerProfile,
                      digital_cameras: sampleCameraRow,
                      payments_and_deposits: []
                    },
                    error: null
                  })
                })
              }),
              update: vi.fn().mockImplementation((payload: any) => {
                expect(payload.status).toBe('REJECTED');
                expect(payload.rejection_reason).toBe(rejectionReason);
                return {
                  eq: vi.fn().mockReturnValue({
                    select: vi.fn().mockReturnValue({
                      single: vi.fn().mockResolvedValue({
                        data: {
                          ...sampleReservationRow,
                          status: 'REJECTED',
                          rejection_reason: rejectionReason
                        },
                        error: null
                      })
                    })
                  })
                };
              })
            };
          }
          return { select: vi.fn().mockReturnThis() };
        })
      };

      (createClient as any).mockResolvedValue(mockClient);

      const result = await rejectReservation(sampleReservationRow.id, rejectionReason);
      expect(result.success).toBe(true);
      expect(result.message).toContain('rejected');
      expect(result.data?.status).toBe('REJECTED');
      expect(result.data?.rejectionReason).toBe(rejectionReason);
    });

    it('fails when rejection reason is empty and returns validation error', async () => {
      const mockClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: mockAdminProfile.id } },
            error: null
          })
        },
        from: vi.fn().mockImplementation((table: string) => ({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockAdminProfile, error: null })
            })
          })
        }))
      };

      (createClient as any).mockResolvedValue(mockClient);

      const result = await rejectReservation(sampleReservationRow.id, '   ');
      expect(result.success).toBe(false);
      expect(result.message).toContain('Rejection reason is required');
    });
  });

  describe('2. Customer Cancellation UI Outcomes', () => {
    it('customer successfully cancels their own pending reservation', async () => {
      const mockClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: mockCustomerProfile.id } },
            error: null
          })
        },
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'profiles') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockCustomerProfile, error: null })
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
                      ...sampleReservationRow,
                      customer_id: mockCustomerProfile.id
                    },
                    error: null
                  })
                })
              }),
              update: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: {
                        ...sampleReservationRow,
                        status: 'CANCELLED'
                      },
                      error: null
                    })
                  })
                })
              })
            };
          }
          return { select: vi.fn().mockReturnThis() };
        })
      };

      (createClient as any).mockResolvedValue(mockClient);

      const result = await cancelReservation(sampleReservationRow.id);
      expect(result.success).toBe(true);
      expect(result.message).toContain('has been cancelled');
      expect(result.data?.status).toBe('CANCELLED');
    });

    it('customer cannot cancel another customer reservation', async () => {
      const mockClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'other-cust-999' } },
            error: null
          })
        },
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'profiles') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { ...mockCustomerProfile, id: 'other-cust-999' },
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
                  single: vi.fn().mockResolvedValue({
                    data: {
                      ...sampleReservationRow,
                      customer_id: mockCustomerProfile.id // Belongs to original customer
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

      const result = await cancelReservation(sampleReservationRow.id);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Access Denied');
    });
  });

  describe('3. Payment & Deposit Transaction Outcomes (Zero False Successes)', () => {
    it('returns authoritative error when confirming payment for non-existent record', async () => {
      const mockClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: mockAdminProfile.id } },
            error: null
          })
        },
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'profiles') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockAdminProfile, error: null })
                })
              })
            };
          }
          if (table === 'payments_and_deposits') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } })
                })
              })
            };
          }
          return { select: vi.fn().mockReturnThis() };
        })
      };

      (createClient as any).mockResolvedValue(mockClient);

      const result = await confirmPayment({ paymentId: 'bad-id', paymentReference: 'REF-123' });
      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });

    it('rejects deposit settlement deduction exceeding total deposit amount with clean feedback', async () => {
      const mockClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: mockAdminProfile.id } },
            error: null
          })
        },
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'profiles') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: mockAdminProfile, error: null })
                })
              })
            };
          }
          if (table === 'payments_and_deposits') {
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: {
                      id: 'pay-001',
                      deposit_status: 'HELD',
                      security_deposit_php: 3000
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

      const result = await settleSecurityDeposit({
        paymentId: 'pay-001',
        action: 'DEDUCT_DAMAGE',
        deductionAmount: 5000, // Exceeds deposit of 3000
        deductionReason: 'Broken filter'
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('cannot exceed held security deposit');
    });
  });
});
