import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CURRENT_AGREEMENT_VERSION,
  CURRENT_AGREEMENT_ID,
  CANONICAL_AGREEMENT_SECTIONS,
  getCanonicalAgreementText,
  generateReservationAgreementSnapshot
} from '../data/rentalAgreement';
import {
  generateAgreementHash,
  recordAgreementAcceptance,
  getAgreementAcceptance
} from '../lib/agreements/agreementService';
import { validateReservationInput } from '../lib/reservations/reservationValidation';
import { createReservation } from '../lib/reservations/reservationService';
import { ProfileRow, DigitalCameraRow, ReservationRow } from '../types/database';

// Mock Supabase Server Client
vi.mock('../lib/supabase/server', () => {
  return {
    createClient: vi.fn()
  };
});

import { createClient } from '../lib/supabase/server';

// Mock Customer Profile
const mockCustomer: ProfileRow = {
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

// Mock Other Customer Profile
const mockOtherCustomer: ProfileRow = {
  id: 'c4444444-4444-4444-4444-444444444444',
  role: 'CUSTOMER',
  full_name: 'Juan Dela Cruz',
  email: 'juan@example.com',
  phone: '0918-999-8877',
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

// Mock Admin Profile
const mockAdmin: ProfileRow = {
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

// Mock Camera Row
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
  description: 'Full frame hybrid camera',
  image_url: '/cameras/sony.jpg',
  package_includes: ['1x Camera Body', '1x 28-70mm Lens'],
  maintenance_notes: null,
  total_rentals_count: 5,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z'
};

// Mock Reservation Row
const sampleReservationRow: ReservationRow = {
  id: 'r1111111-1111-1111-1111-111111111111',
  reference_no: 'IDIO-RES-20261020-001',
  customer_id: mockCustomer.id,
  camera_id: 'CAM-SONY-A7IV',
  start_date: '2026-10-20',
  end_date: '2026-10-22',
  rental_period: '[2026-10-20,2026-10-23)',
  blocked_period: '[2026-10-20,2026-10-25)',
  agreement_version: 'v1.0',
  total_days: 3,
  daily_rate_snapshot: 1500,
  subtotal_php: 4500,
  security_deposit_php: 3000,
  total_amount_php: 7500,
  purpose: 'Commercial documentary shoot at Butuan National Museum',
  status: 'PENDING_APPROVAL',
  rejection_reason: null,
  created_at: '2026-10-15T08:00:00Z',
  updated_at: '2026-10-15T08:00:00Z'
};

function setupMockSupabase({
  user = mockCustomer,
  camera = sampleCameraRow,
  reservation = sampleReservationRow,
  acceptanceRecord = null as any,
  insertAcceptanceError = null as any
}: {
  user?: ProfileRow | null;
  camera?: DigitalCameraRow | null;
  reservation?: ReservationRow | null;
  acceptanceRecord?: any;
  insertAcceptanceError?: any;
} = {}) {
  let recordedAcceptance: any = acceptanceRecord;

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
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((col: string, val: string) => {
              const resData = (reservation && reservation.id === val) ? reservation : (reservation?.customer_id === val ? [reservation] : null);
              return {
                single: vi.fn().mockResolvedValue({ data: reservation, error: null }),
                maybeSingle: vi.fn().mockResolvedValue({ data: reservation, error: null }),
                in: vi.fn().mockReturnValue({
                  lte: vi.fn().mockReturnValue({
                    gte: vi.fn().mockImplementation(() => ({
                      neq: vi.fn().mockResolvedValue({ data: [], error: null }),
                      then: (resolve: any) => resolve({ data: [], error: null })
                    }))
                  })
                })
              };
            })
          }),
          insert: vi.fn().mockImplementation((payload: any) => ({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  ...sampleReservationRow,
                  ...payload,
                  id: 'res-new-uuid-888',
                  created_at: new Date().toISOString()
                },
                error: null
              })
            })
          }))
        };
      }
      if (table === 'rental_agreement_acceptances') {
        return {
          insert: vi.fn().mockImplementation((payload: any) => {
            if (insertAcceptanceError) {
              return {
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ data: null, error: insertAcceptanceError })
                })
              };
            }
            recordedAcceptance = {
              id: 'acc-uuid-1234',
              ...payload,
              accepted_at: new Date().toISOString(),
              created_at: new Date().toISOString()
            };
            return {
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: recordedAcceptance, error: null })
              })
            };
          }),
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockImplementation(() => {
                return Promise.resolve({ data: recordedAcceptance, error: null });
              }),
              single: vi.fn().mockImplementation(() => {
                return Promise.resolve({ data: recordedAcceptance, error: null });
              })
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
  return { mockClient, getRecordedAcceptance: () => recordedAcceptance };
}

describe('FEATURE 2: Customer Rental Agreement with Versioned Acceptance Records', () => {

  describe('2.1 Agreement Document Structure & Terms Completeness', () => {
    it('contains all 12 legally required agreement sections with authoritative terms', () => {
      expect(CANONICAL_AGREEMENT_SECTIONS).toHaveLength(12);

      const sectionTitles = CANONICAL_AGREEMENT_SECTIONS.map(s => s.title);
      expect(sectionTitles).toContain('1. Identification of Parties');
      expect(sectionTitles).toContain('2. Digital Camera Asset & Package Accessories');
      expect(sectionTitles).toContain('3. Rental Period & Automatic Two-Calendar-Day Scheduling Buffer');
      expect(sectionTitles).toContain('4. Rental Tariffs & Security Deposit Settlement');
      expect(sectionTitles).toContain('5. Proper Digital Camera Care & Handling Standards');
      expect(sectionTitles).toContain('6. Counter Return Requirements & Condition Inspection');
      expect(sectionTitles).toContain('7. Overdue & Late Equipment Returns');
      expect(sectionTitles).toContain('8. Equipment Damage, Scratches, Sensor Defects & Loss');
      expect(sectionTitles).toContain('9. Security Deposit Deductions & Settlement');
      expect(sectionTitles).toContain('10. Reservation Cancellation & Revisions');
      expect(sectionTitles).toContain('11. Governing Law & Dispute Resolution');
      expect(sectionTitles).toContain('12. Customer Electronic Acknowledgement & Acceptance');
    });

    it('accurately describes the 2-day buffer as an availability protection rule without extra customer charge', () => {
      const section3 = CANONICAL_AGREEMENT_SECTIONS.find(s => s.title.includes('Scheduling Buffer'));
      expect(section3).toBeDefined();
      expect(section3?.content.toLowerCase()).toContain('two (2) calendar-day');
      expect(section3?.content.toLowerCase()).toContain('not constitute an extension');
      expect(section3?.content.toLowerCase()).toContain('is not charged to the customer');
    });

    it('identifies Butuan City, Agusan del Norte, Philippines as store jurisdiction', () => {
      const text = getCanonicalAgreementText();
      expect(text).toContain('Butuan City');
      expect(text).toContain('Agusan del Norte');
      expect(text).toContain('CASH_PICKUP');
    });
  });

  describe('2.2 Pre-Submission Validation & Agreement Acceptance Enforcement', () => {
    it('rejects reservation submission when agreementAccepted is false', () => {
      const val = validateReservationInput({
        cameraId: 'CAM-SONY-A7IV',
        startDate: '2026-10-20',
        endDate: '2026-10-22',
        purpose: 'Documentary shoot',
        paymentMethod: 'CASH_PICKUP',
        agreementAccepted: false,
        agreementVersion: CURRENT_AGREEMENT_VERSION
      });

      expect(val.isValid).toBe(false);
      expect(val.errors).toContain('Customer Rental Agreement must be explicitly reviewed and accepted before submitting a reservation.');
    });

    it('rejects reservation submission when agreementAccepted is omitted or undefined', () => {
      const val = validateReservationInput({
        cameraId: 'CAM-SONY-A7IV',
        startDate: '2026-10-20',
        endDate: '2026-10-22',
        purpose: 'Documentary shoot',
        paymentMethod: 'CASH_PICKUP'
      } as any);

      expect(val.isValid).toBe(false);
      expect(val.errors).toContain('Customer Rental Agreement must be explicitly reviewed and accepted before submitting a reservation.');
    });

    it('rejects reservation submission with an outdated or mismatched agreement version', () => {
      const val = validateReservationInput({
        cameraId: 'CAM-SONY-A7IV',
        startDate: '2026-10-20',
        endDate: '2026-10-22',
        purpose: 'Documentary shoot',
        paymentMethod: 'CASH_PICKUP',
        agreementAccepted: true,
        agreementVersion: 'v0.9'
      });

      expect(val.isValid).toBe(false);
      expect(val.errors[0]).toContain("Invalid or outdated agreement version 'v0.9'");
      expect(val.errors[0]).toContain(CURRENT_AGREEMENT_VERSION);
    });

    it('accepts reservation submission when agreementAccepted is true and version matches CURRENT_AGREEMENT_VERSION', () => {
      const val = validateReservationInput({
        cameraId: 'CAM-SONY-A7IV',
        startDate: '2026-10-20',
        endDate: '2026-10-22',
        purpose: 'Documentary shoot',
        paymentMethod: 'CASH_PICKUP',
        agreementAccepted: true,
        agreementVersion: CURRENT_AGREEMENT_VERSION
      });

      expect(val.isValid).toBe(true);
      expect(val.errors).toHaveLength(0);
    });
  });

  describe('2.3 Agreement Snapshot Generation & SHA-256 Tamper Evidence', () => {
    it('produces a reproducible SHA-256 hash for identical terms', async () => {
      const text = getCanonicalAgreementText();
      const hash1 = await generateAgreementHash(text);
      const hash2 = await generateAgreementHash(text);

      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // Standard SHA-256 hex string
    });

    it('generates a completely different hash if single character of agreement is altered (tamper-evident)', async () => {
      const originalText = getCanonicalAgreementText();
      const tamperedText = originalText + '\nMODIFIED UNAPPROVED TERMS';

      const originalHash = await generateAgreementHash(originalText);
      const tamperedHash = await generateAgreementHash(tamperedText);

      expect(originalHash).not.toBe(tamperedHash);
    });

    it('generates an immutable reservation-specific snapshot incorporating booking metadata', () => {
      const snapshot = generateReservationAgreementSnapshot({
        referenceNo: 'IDIO-RES-20261020-001',
        customerName: 'Maria Santos',
        customerPhone: '0917-123-4567',
        customerBarangay: 'Libertad',
        cameraName: 'Sony Alpha a7 IV Mirrorless Camera',
        cameraSerial: 'SN-SONY-998811',
        startDate: '2026-10-20',
        endDate: '2026-10-22',
        bufferEndDate: '2026-10-24',
        totalDays: 3,
        dailyRate: 1500,
        subtotal: 4500,
        securityDeposit: 3000,
        totalAmount: 7500
      });

      expect(snapshot).toContain('IDIO-RES-20261020-001');
      expect(snapshot).toContain('Maria Santos');
      expect(snapshot).toContain('Sony Alpha a7 IV Mirrorless Camera');
      expect(snapshot).toContain('SN-SONY-998811');
      expect(snapshot).toContain('2026-10-20 to 2026-10-22');
      expect(snapshot).toContain('SCHEDULED TURNAROUND BUFFER: 2 Calendar Days');
    });
  });

  describe('2.4 Server-Side Reservation Creation & Agreement Acceptance Recording', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('creates an immutable agreement acceptance record linked to reservation on submission', async () => {
      const { getRecordedAcceptance } = setupMockSupabase();

      const result = await createReservation({
        cameraId: 'CAM-SONY-A7IV',
        startDate: '2026-10-20',
        endDate: '2026-10-22',
        purpose: 'Commercial documentary shoot at Butuan National Museum',
        paymentMethod: 'CASH_PICKUP',
        agreementAccepted: true,
        agreementVersion: CURRENT_AGREEMENT_VERSION
      });

      expect(result.success).toBe(true);
      expect(result.data?.agreementVersion).toBe('v1.0');

      const recorded = getRecordedAcceptance();
      expect(recorded).not.toBeNull();
      expect(recorded.agreement_id).toBe(CURRENT_AGREEMENT_ID);
      expect(recorded.version).toBe(CURRENT_AGREEMENT_VERSION);
      expect(recorded.agreement_hash).toMatch(/^[a-f0-9]{64}$/);
      expect(recorded.agreement_text_snapshot).toContain('Maria Santos');
    });

    it('rejects creation if agreement version changed or is invalid', async () => {
      setupMockSupabase();

      const result = await createReservation({
        cameraId: 'CAM-SONY-A7IV',
        startDate: '2026-10-20',
        endDate: '2026-10-22',
        purpose: 'Test',
        paymentMethod: 'CASH_PICKUP',
        agreementAccepted: true,
        agreementVersion: 'v0.8-stale'
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid or outdated agreement version');
    });
  });

  describe('2.5 Ownership, Access Control & Audit Isolation', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('allows customer to view agreement acceptance for their own reservation', async () => {
      setupMockSupabase({
        user: mockCustomer,
        reservation: sampleReservationRow,
        acceptanceRecord: {
          id: 'acc-uuid-1',
          reservation_id: sampleReservationRow.id,
          customer_id: mockCustomer.id,
          agreement_id: CURRENT_AGREEMENT_ID,
          version: 'v1.0',
          agreement_version: 'v1.0',
          agreement_title: 'IDIO Digital Camera Rental Agreement',
          agreement_text_snapshot: 'Terms snapshot content',
          agreement_hash: 'a1b2c3d4e5f6',
          accepted_at: '2026-10-15T08:00:00Z',
          created_at: '2026-10-15T08:00:00Z'
        }
      });

      const res = await getAgreementAcceptance(sampleReservationRow.id);
      expect(res.success).toBe(true);
      expect(res.data?.agreementVersion).toBe('v1.0');
      expect(res.data?.customerId).toBe(mockCustomer.id);
    });

    it('denies customer from accessing another customer agreement acceptance record', async () => {
      // Current user is mockOtherCustomer, attempting to view mockCustomer's reservation
      setupMockSupabase({
        user: mockOtherCustomer,
        reservation: sampleReservationRow, // owned by mockCustomer
        acceptanceRecord: {
          id: 'acc-uuid-1',
          reservation_id: sampleReservationRow.id,
          customer_id: mockCustomer.id,
          agreement_id: CURRENT_AGREEMENT_ID,
          version: 'v1.0',
          agreement_version: 'v1.0',
          agreement_title: 'IDIO Digital Camera Rental Agreement',
          agreement_text_snapshot: 'Terms snapshot content',
          agreement_hash: 'a1b2c3d4e5f6',
          accepted_at: '2026-10-15T08:00:00Z',
          created_at: '2026-10-15T08:00:00Z'
        }
      });

      const res = await getAgreementAcceptance(sampleReservationRow.id);
      expect(res.success).toBe(false);
      expect(res.message).toContain('Forbidden');
    });

    it('allows administrator to audit agreement acceptance for any customer reservation', async () => {
      // Current user is mockAdmin
      setupMockSupabase({
        user: mockAdmin,
        reservation: sampleReservationRow, // customer reservation
        acceptanceRecord: {
          id: 'acc-uuid-1',
          reservation_id: sampleReservationRow.id,
          customer_id: mockCustomer.id,
          agreement_id: CURRENT_AGREEMENT_ID,
          version: 'v1.0',
          agreement_version: 'v1.0',
          agreement_title: 'IDIO Digital Camera Rental Agreement',
          agreement_text_snapshot: 'Terms snapshot content',
          agreement_hash: 'a1b2c3d4e5f6',
          accepted_at: '2026-10-15T08:00:00Z',
          created_at: '2026-10-15T08:00:00Z'
        }
      });

      const res = await getAgreementAcceptance(sampleReservationRow.id);
      expect(res.success).toBe(true);
      expect(res.data?.reservationId).toBe(sampleReservationRow.id);
    });
  });
});
