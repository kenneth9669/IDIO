import { describe, it, expect } from 'vitest';
import {
  serviceCreateReservation,
  serviceApproveReservation,
  serviceRejectReservation,
  serviceCancelReservation,
  serviceCheckoutRental,
  serviceReturnInspectionRental,
  serviceAddCamera,
  serviceDeleteCamera,
  validateRole,
  validateStateTransition
} from '../lib/domainService';
import { checkCameraAvailability } from '../lib/availabilityEngine';
import { DigitalCamera, User, Reservation } from '../types';
import { SEED_CAMERAS, SEED_USERS, SEED_RESERVATIONS } from '../data/seedData';

describe('1. Digital-Camera-Only & Scope Audits', () => {
  const adminUser = SEED_USERS.find(u => u.role === 'ADMIN')!;

  it('allows adding valid digital camera bodies with required attributes', () => {
    const newCamData = {
      name: 'Panasonic Lumix S5 II',
      brand: 'Panasonic' as const,
      model: 'DC-S5M2',
      serialNumber: 'SN-LUMIX-S52-9901',
      category: 'Mirrorless' as const,
      dailyRate: 1400,
      securityDeposit: 3000,
      status: 'AVAILABLE' as const,
      condition: 'Excellent' as const,
      description: 'Phase hybrid AF full frame digital camera.',
      imageUrl: 'https://example.com/s5ii.jpg',
      specs: {
        sensor: '24.2 MP Full-Frame CMOS',
        megapixels: '24.2 MP',
        videoResolution: '6K 30p 10-bit',
        isoRange: '100 - 51,200',
        lensMountOrKit: 'L-Mount 20-60mm Lens',
        screen: '3.0-inch Free-angle Touch LCD',
        connectivity: 'Wi-Fi, Bluetooth, USB-C',
        batteryLife: 'Approx. 370 shots',
        weight: '740g'
      },
      packageIncludes: ['Camera Body', '2x Batteries', 'Charger', 'SD Card']
    };

    const res = serviceAddCamera(adminUser, newCamData, SEED_CAMERAS);
    expect(res.success).toBe(true);
    expect(res.data?.id).toBeDefined();
    expect(res.data?.name).toBe('Panasonic Lumix S5 II');
  });

  it('rejects camera creation with zero or negative pricing', () => {
    const invalidCam = {
      name: 'Free Camera',
      brand: 'Sony' as const,
      model: 'X',
      serialNumber: 'SN-INVALID-001',
      category: 'Compact' as const,
      dailyRate: 0,
      securityDeposit: 1000,
      status: 'AVAILABLE' as const,
      condition: 'Good' as const,
      description: 'Invalid tariff',
      imageUrl: 'https://example.com/x.jpg',
      specs: SEED_CAMERAS[0].specs,
      packageIncludes: []
    };

    const res = serviceAddCamera(adminUser, invalidCam, SEED_CAMERAS);
    expect(res.success).toBe(false);
    expect(res.message).toContain('Daily rental rate must be greater than ₱0');
  });
});

describe('2. Butuan City Geographic Scope & Address Enforcement', () => {
  const customerUser = SEED_USERS.find(u => u.role === 'CUSTOMER')!;
  const availableCamera = SEED_CAMERAS.find(c => c.id === 'CAM-001')!;

  it('accepts reservations from verified Butuan City barangays', () => {
    const userInLibertad: User = { ...customerUser, barangay: 'Libertad' };
    const res = serviceCreateReservation(
      userInLibertad,
      {
        cameraId: availableCamera.id,
        startDate: '2026-11-01',
        endDate: '2026-11-03',
        purpose: 'Test Shoot at Guingona Park',
        paymentMethod: 'CASH_PICKUP'
      },
      SEED_CAMERAS,
      []
    );

    expect(res.success).toBe(true);
    expect(res.data?.customerBarangay).toBe('Libertad');
  });

  it('rejects reservations from unauthorized locations outside Butuan City', () => {
    const userOutside: User = { ...customerUser, barangay: 'Cagayan de Oro' as any };
    const res = serviceCreateReservation(
      userOutside,
      {
        cameraId: availableCamera.id,
        startDate: '2026-11-01',
        endDate: '2026-11-03',
        purpose: 'Test Shoot',
        paymentMethod: 'CASH_PICKUP'
      },
      SEED_CAMERAS,
      []
    );

    expect(res.success).toBe(false);
    expect(res.message).toContain('outside the authorized Butuan City service area');
  });
});

describe('3. RBAC & Security Authorization Layer', () => {
  const customerUser = SEED_USERS.find(u => u.role === 'CUSTOMER')!;
  const adminUser = SEED_USERS.find(u => u.role === 'ADMIN')!;

  it('prevents Customers from approving reservations', () => {
    const res = serviceApproveReservation(customerUser, 'RES-2026-002', SEED_RESERVATIONS, SEED_CAMERAS);
    expect(res.success).toBe(false);
    expect(res.message).toContain('Access Denied');
  });

  it('allows Admin to approve reservations', () => {
    const res = serviceApproveReservation(adminUser, 'RES-2026-002', SEED_RESERVATIONS, SEED_CAMERAS);
    expect(res.success).toBe(true);
  });

  it('prevents Customers from adding cameras to fleet', () => {
    const res = serviceAddCamera(customerUser, SEED_CAMERAS[0], SEED_CAMERAS);
    expect(res.success).toBe(false);
    expect(res.message).toContain('Access Denied');
  });

  it('allows Admin to add cameras to fleet', () => {
    const newCamData = {
      ...SEED_CAMERAS[0],
      serialNumber: 'SN-TEST-NEW-001'
    };
    const res = serviceAddCamera(adminUser, newCamData, SEED_CAMERAS);
    expect(res.success).toBe(true);
  });

  it('prevents Customers from cancelling another customer reservation', () => {
    const otherCustomer: User = { ...customerUser, id: 'USR-OTHER-99' };
    const res = serviceCancelReservation(otherCustomer, 'RES-2026-002', SEED_RESERVATIONS);
    expect(res.success).toBe(false);
    expect(res.message).toContain('Access Denied');
  });

  it('allows Admin to perform administrative overrides', () => {
    const roleCheck = validateRole(adminUser, ['ADMIN'], 'Delete Camera');
    expect(roleCheck.success).toBe(true);
  });
});

describe('4. Server-Enforced Availability & Overlap Prevention', () => {
  const camera = SEED_CAMERAS.find(c => c.id === 'CAM-001')!;

  const existingReservations: Reservation[] = [
    {
      id: 'RES-EXISTING-1',
      referenceNo: 'IDIO-TEST-1',
      customerId: 'USR-CUST-01',
      customerName: 'Jennelyn',
      customerEmail: 'j@test.ph',
      customerPhone: '09191234567',
      customerBarangay: 'Ampayon',
      customerStreetAddress: 'Purok 1',
      idType: 'UMID',
      idNumber: '1234',
      cameraId: camera.id,
      cameraName: camera.name,
      cameraBrand: camera.brand,
      cameraCategory: camera.category,
      cameraSerial: camera.serialNumber,
      cameraImageUrl: camera.imageUrl,
      startDate: '2026-10-10',
      endDate: '2026-10-15',
      totalDays: 6,
      dailyRate: camera.dailyRate,
      subtotal: 6 * camera.dailyRate,
      securityDeposit: camera.securityDeposit,
      totalAmount: 6 * camera.dailyRate + camera.securityDeposit,
      purpose: 'Shoot',
      status: 'APPROVED',
      paymentStatus: 'PAID',
      paymentMethod: 'GCASH',
      depositStatus: 'HELD',
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z'
    }
  ];

  it('blocks booking when requested dates overlap with an active reservation', () => {
    // Overlapping: Oct 12 to Oct 14 falls inside Oct 10 to Oct 15
    const avail = checkCameraAvailability(camera, '2026-10-12', '2026-10-14', existingReservations);
    expect(avail.isAvailable).toBe(false);
    expect(avail.reason).toContain('unavailable for your selected dates');
  });

  it('blocks booking when camera is in MAINTENANCE', () => {
    const maintenanceCam: DigitalCamera = { ...camera, status: 'MAINTENANCE', maintenanceNotes: 'Sensor clean' };
    const avail = checkCameraAvailability(maintenanceCam, '2026-11-01', '2026-11-03', []);
    expect(avail.isAvailable).toBe(false);
    expect(avail.reason).toContain('maintenance');
  });

  it('allows booking when requested dates do not overlap', () => {
    // Non-overlapping: Oct 20 to Oct 22
    const avail = checkCameraAvailability(camera, '2026-10-20', '2026-10-22', existingReservations);
    expect(avail.isAvailable).toBe(true);
  });
});

describe('5. Rental Lifecycle & State Transitions', () => {
  const adminUser = SEED_USERS.find(u => u.role === 'ADMIN')!;
  const customerUser = SEED_USERS.find(u => u.role === 'CUSTOMER')!;
  const camera = SEED_CAMERAS.find(c => c.id === 'CAM-001')!;

  it('enforces complete valid lifecycle: PENDING_APPROVAL -> APPROVED -> CHECKED_OUT -> COMPLETED', () => {
    // 1. Create
    const createRes = serviceCreateReservation(
      customerUser,
      {
        cameraId: camera.id,
        startDate: '2026-12-01',
        endDate: '2026-12-03',
        purpose: 'Commercial Project',
        paymentMethod: 'GCASH',
        paymentReference: 'GC-123456'
      },
      SEED_CAMERAS,
      []
    );
    expect(createRes.success).toBe(true);
    const resRecord = createRes.data!;
    expect(resRecord.status).toBe('PENDING_APPROVAL');

    // 2. Approve
    const approveRes = serviceApproveReservation(adminUser, resRecord.id, [resRecord], SEED_CAMERAS);
    expect(approveRes.success).toBe(true);
    const approvedRecord = approveRes.data!.updatedReservation;
    expect(approvedRecord.status).toBe('APPROVED');

    // 3. Checkout
    const checkoutRes = serviceCheckoutRental(adminUser, approvedRecord.id, 'Excellent', 'Clean handover', [approvedRecord], SEED_CAMERAS);
    expect(checkoutRes.success).toBe(true);
    const checkedOutRecord = checkoutRes.data!.updatedReservation;
    expect(checkedOutRecord.status).toBe('CHECKED_OUT');
    expect(checkoutRes.data!.updatedCamera.status).toBe('CHECKED_OUT');

    // 4. Return & Inspection
    const returnRes = serviceReturnInspectionRental(
      adminUser,
      checkedOutRecord.id,
      'Excellent',
      'Inspected clean',
      'REFUND_FULL',
      0,
      '',
      false,
      [checkedOutRecord],
      [checkoutRes.data!.updatedCamera]
    );
    expect(returnRes.success).toBe(true);
    expect(returnRes.data!.updatedReservation.status).toBe('COMPLETED');
    expect(returnRes.data!.updatedReservation.depositStatus).toBe('REFUNDED');
    expect(returnRes.data!.updatedCamera.status).toBe('AVAILABLE');
  });

  it('rejects invalid state transitions (e.g. jumping from PENDING directly to CHECKED_OUT)', () => {
    const check = validateStateTransition('PENDING_APPROVAL', 'CHECKED_OUT');
    expect(check.success).toBe(false);
    expect(check.message).toContain('Invalid State Transition');
  });

  it('rejects re-opening or modifying terminal states (COMPLETED -> APPROVED)', () => {
    const check = validateStateTransition('COMPLETED', 'APPROVED');
    expect(check.success).toBe(false);
  });
});

describe('6. Post-Return Condition & Maintenance Routing', () => {
  const adminUser = SEED_USERS.find(u => u.role === 'ADMIN')!;
  const camera = SEED_CAMERAS.find(c => c.id === 'CAM-002')!;

  it('routes damaged camera to DAMAGED status and records damage deduction penalty', () => {
    const checkedOutRes: Reservation = {
      ...SEED_RESERVATIONS[0],
      id: 'RES-TEST-DMG',
      cameraId: camera.id,
      status: 'CHECKED_OUT',
      securityDeposit: 3500
    };

    const returnRes = serviceReturnInspectionRental(
      adminUser,
      checkedOutRes.id,
      'Damaged',
      'Cracked rear LCD glass after fall',
      'DEDUCT_DAMAGE',
      2500,
      'LCD replacement repair penalty',
      true,
      [checkedOutRes],
      [camera]
    );

    expect(returnRes.success).toBe(true);
    expect(returnRes.data!.updatedCamera.status).toBe('DAMAGED');
    expect(returnRes.data!.updatedCamera.condition).toBe('Damaged');
    expect(returnRes.data!.updatedReservation.depositStatus).toBe('DEDUCTED');
    expect(returnRes.data!.updatedReservation.depositDeduction).toBe(2500);
    expect(returnRes.data!.newMaintenanceLog).toBeDefined();
    expect(returnRes.data!.newMaintenanceLog?.issueType).toBe('Post-Rental Damage');
  });

  it('routes Fair condition camera to MAINTENANCE status and blocks availability', () => {
    const checkedOutRes: Reservation = {
      ...SEED_RESERVATIONS[0],
      id: 'RES-TEST-FAIR',
      cameraId: camera.id,
      status: 'CHECKED_OUT'
    };

    const returnRes = serviceReturnInspectionRental(
      adminUser,
      checkedOutRes.id,
      'Fair',
      'Sensor shows heavy dust specks, shutter button sticky',
      'REFUND_FULL',
      0,
      '',
      true,
      [checkedOutRes],
      [camera]
    );

    expect(returnRes.success).toBe(true);
    expect(returnRes.data!.updatedCamera.status).toBe('MAINTENANCE');
    expect(returnRes.data!.updatedCamera.condition).toBe('Fair');
  });
});
