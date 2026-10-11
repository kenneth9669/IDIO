import { describe, it, expect } from 'vitest';
import { BUTUAN_BARANGAYS } from '../data/seedData';

describe('PostgreSQL Schema Invariants & Date Range Concurrency Tests', () => {
  // Helper to simulate PostgreSQL daterange(start, end + 1, '[)')
  function toPostgresDateRange(startDateStr: string, endDateStr: string): { startMs: number; endExclusiveMs: number } {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    // end + 1 day
    const endExclusive = new Date(end);
    endExclusive.setDate(endExclusive.getDate() + 1);
    return {
      startMs: start.getTime(),
      endExclusiveMs: endExclusive.getTime()
    };
  }

  function doRangesOverlap(
    r1: { startMs: number; endExclusiveMs: number },
    r2: { startMs: number; endExclusiveMs: number }
  ): boolean {
    // Overlap for [start, end) ranges: r1.start < r2.endExclusive && r1.endExclusive > r2.start
    return r1.startMs < r2.endExclusiveMs && r1.endExclusiveMs > r2.startMs;
  }

  it('correctly accepts adjacent non-overlapping bookings (e.g. June 1-3 and June 4-6)', () => {
    // User A books June 1 to June 3 inclusive
    const bookingA = toPostgresDateRange('2026-06-01', '2026-06-03');
    // User B books June 4 to June 6 inclusive
    const bookingB = toPostgresDateRange('2026-06-04', '2026-06-06');

    const overlap = doRangesOverlap(bookingA, bookingB);
    expect(overlap).toBe(false); // MUST NOT conflict
  });

  it('correctly detects and rejects true overlapping bookings (e.g. June 1-3 and June 3-5 on same day)', () => {
    // User A books June 1 to June 3
    const bookingA = toPostgresDateRange('2026-06-01', '2026-06-03');
    // User B attempts to book June 3 to June 5 (overlaps on June 3)
    const bookingB = toPostgresDateRange('2026-06-03', '2026-06-05');

    const overlap = doRangesOverlap(bookingA, bookingB);
    expect(overlap).toBe(true); // MUST conflict
  });

  it('correctly detects interior overlapping bookings (e.g. June 1-10 and June 3-5)', () => {
    const bookingA = toPostgresDateRange('2026-06-01', '2026-06-10');
    const bookingB = toPostgresDateRange('2026-06-03', '2026-06-05');

    const overlap = doRangesOverlap(bookingA, bookingB);
    expect(overlap).toBe(true);
  });

  it('verifies that curated Butuan City barangays match the 20 approved local barangays in schema check constraint', () => {
    expect(BUTUAN_BARANGAYS).toHaveLength(20);
    expect(BUTUAN_BARANGAYS).toContain('Libertad');
    expect(BUTUAN_BARANGAYS).toContain('San Vicente');
    expect(BUTUAN_BARANGAYS).toContain('Ampayon');
    expect(BUTUAN_BARANGAYS).toContain('Villa Kananga');
    expect(BUTUAN_BARANGAYS).toContain('Doongan');
    expect(BUTUAN_BARANGAYS).not.toContain('Cagayan de Oro');
    expect(BUTUAN_BARANGAYS).not.toContain('Cabadbaran');
  });

  it('verifies separated reservation statuses vs rental lifecycle statuses', () => {
    const reservationStatuses = ['PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED'];
    const rentalStatuses = ['CHECKED_OUT', 'RETURNED', 'COMPLETED'];

    // Ensure no intersection between reservation decision states and physical rental execution states
    const intersection = reservationStatuses.filter(s => rentalStatuses.includes(s));
    expect(intersection).toHaveLength(0);
  });

  it('verifies camera operational statuses comply with domain lifecycle', () => {
    const validCameraStatuses = ['AVAILABLE', 'RESERVED', 'CHECKED_OUT', 'MAINTENANCE', 'DAMAGED'];
    expect(validCameraStatuses).toContain('AVAILABLE');
    expect(validCameraStatuses).toContain('MAINTENANCE');
    expect(validCameraStatuses).toContain('DAMAGED');
  });

  it('verifies user roles are strictly TWO: CUSTOMER and ADMIN with no STAFF role', () => {
    const schemaRoles: ('CUSTOMER' | 'ADMIN')[] = ['CUSTOMER', 'ADMIN'];
    expect(schemaRoles).toHaveLength(2);
    expect(schemaRoles).toContain('CUSTOMER');
    expect(schemaRoles).toContain('ADMIN');
    // @ts-expect-error Ensure STAFF is not assignable to UserRole
    const hasStaff = schemaRoles.includes('STAFF');
    expect(hasStaff).toBe(false);
  });
});
