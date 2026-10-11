import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getCameras,
  getCameraById,
  createCamera,
  updateCamera,
  setCameraStatus,
  setCameraCondition,
  deleteCamera
} from '../lib/cameras/cameraService';
import { validateCameraInput } from '../lib/cameras/cameraValidation';
import { checkCameraAvailability } from '../lib/availabilityEngine';
import { DigitalCamera, Reservation } from '../types';
import { ProfileRow, DigitalCameraRow } from '../types/database';

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
    videoResolution: '4K 60p 10-bit 4:2:2',
    isoRange: '100 - 51,200',
    lensMountOrKit: 'FE 28-70mm Kit Lens',
    screen: '3.0-inch Vari-angle Touchscreen',
    connectivity: 'Wi-Fi, Bluetooth, USB-C',
    batteryLife: 'Approx. 580 shots',
    weight: '658g'
  },
  description: 'Flagship full-frame hybrid mirrorless camera for photos and 4K cinema.',
  image_url: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=800&q=80',
  package_includes: ['Camera Body', '2x Rechargeable Batteries', '1x 128GB SD Card', 'Charger', 'Bag'],
  maintenance_notes: null,
  total_rentals_count: 5,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z'
};

// Mock Supabase Server Client
vi.mock('../lib/supabase/server', () => {
  return {
    createClient: vi.fn()
  };
});

import { createClient } from '../lib/supabase/server';

describe('Phase 4: Digital Camera & Fleet Management Subsystem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Authoritative Public/Customer Camera Queries', () => {
    it('allows public/customer to read camera catalog data', async () => {
      vi.mocked(createClient).mockResolvedValueOnce({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [sampleCameraRow],
              error: null
            })
          })
        })
      } as any);

      const result = await getCameras();
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].name).toBe('Sony Alpha 7 IV Mirrorless Camera');
      expect(result.data![0].dailyRate).toBe(1400);
      expect(result.data![0].securityDeposit).toBe(3000);
    });

    it('allows public/customer to fetch single camera by ID', async () => {
      vi.mocked(createClient).mockResolvedValueOnce({
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: sampleCameraRow,
                error: null
              })
            })
          })
        })
      } as any);

      const result = await getCameraById('CAM-001');
      expect(result.success).toBe(true);
      expect(result.data?.id).toBe('CAM-001');
      expect(result.data?.serialNumber).toBe('SN-SONY-A7IV-01');
    });
  });

  describe('2. Admin Mutation Authorization & Role Enforcement', () => {
    it('allows Admin to create a new camera record', async () => {
      // 1. Auth context returns Admin profile
      vi.mocked(createClient)
        .mockResolvedValueOnce({
          auth: {
            getUser: vi.fn().mockResolvedValue({ data: { user: { id: mockAdminProfile.id } }, error: null })
          },
          from: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockAdminProfile, error: null })
              })
            })
          })
        } as any)
        // 2. Camera insert query
        .mockResolvedValueOnce({
          from: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              head: vi.fn()
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    ...sampleCameraRow,
                    id: 'CAM-009',
                    name: 'Fujifilm X-T5 Mirrorless',
                    serial_number: 'SN-FUJI-XT5-01'
                  },
                  error: null
                })
              })
            })
          })
        } as any);

      const result = await createCamera({
        name: 'Fujifilm X-T5 Mirrorless',
        brand: 'Fujifilm',
        model: 'X-T5',
        serialNumber: 'SN-FUJI-XT5-01',
        category: 'Mirrorless',
        dailyRate: 1500,
        securityDeposit: 3000,
        status: 'AVAILABLE',
        condition: 'Excellent',
        description: '40MP APS-C sensor with 5-axis stabilization in Butuan City.',
        imageUrl: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32'
      });

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe('Fujifilm X-T5 Mirrorless');
    });

    it('allows Admin to update an existing camera record', async () => {
      // 1. Auth context returns Admin
      vi.mocked(createClient)
        .mockResolvedValueOnce({
          auth: {
            getUser: vi.fn().mockResolvedValue({ data: { user: { id: mockAdminProfile.id } }, error: null })
          },
          from: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockAdminProfile, error: null })
              })
            })
          })
        } as any)
        // 2. Existing camera check and update query
        .mockResolvedValueOnce({
          from: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: sampleCameraRow, error: null })
              })
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { ...sampleCameraRow, daily_rate_php: 1600 },
                    error: null
                  })
                })
              })
            })
          })
        } as any);

      const result = await updateCamera('CAM-001', { dailyRate: 1600 });
      expect(result.success).toBe(true);
      expect(result.data?.dailyRate).toBe(1600);
    });

    it('denies Customer from creating a camera (requireAdmin rejection)', async () => {
      // Auth context returns Customer profile
      vi.mocked(createClient).mockResolvedValueOnce({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: mockCustomerProfile.id } }, error: null })
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockCustomerProfile, error: null })
            })
          })
        })
      } as any);

      await expect(
        createCamera({
          name: 'Hacked Camera',
          brand: 'Sony',
          model: 'Test',
          serialNumber: 'SN-HACK-01',
          category: 'Mirrorless',
          dailyRate: 100,
          securityDeposit: 100,
          status: 'AVAILABLE',
          condition: 'Excellent',
          description: 'Hacked',
          imageUrl: 'https://example.com'
        })
      ).rejects.toThrow(/Forbidden: Role 'CUSTOMER' is not authorized/);
    });

    it('denies Customer from updating a camera (requireAdmin rejection)', async () => {
      // Auth context returns Customer profile
      vi.mocked(createClient).mockResolvedValueOnce({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: { id: mockCustomerProfile.id } }, error: null })
        },
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: mockCustomerProfile, error: null })
            })
          })
        })
      } as any);

      await expect(
        updateCamera('CAM-001', { dailyRate: 10 })
      ).rejects.toThrow(/Forbidden: Role 'CUSTOMER' is not authorized/);
    });
  });

  describe('3. Server-Side Input Validation & Unique Constraints', () => {
    it('rejects duplicate serial number error from database cleanly', async () => {
      vi.mocked(createClient)
        // 1. Auth context
        .mockResolvedValueOnce({
          auth: {
            getUser: vi.fn().mockResolvedValue({ data: { user: { id: mockAdminProfile.id } }, error: null })
          },
          from: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockAdminProfile, error: null })
              })
            })
          })
        } as any)
        // 2. Insert with unique violation
        .mockResolvedValueOnce({
          from: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              head: vi.fn()
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { code: '23505', message: 'duplicate key value violates unique constraint "digital_cameras_serial_number_key"' }
                })
              })
            })
          })
        } as any);

      const result = await createCamera({
        name: 'Canon EOS R6',
        brand: 'Canon',
        model: 'R6',
        serialNumber: 'SN-SONY-A7IV-01',
        category: 'Mirrorless',
        dailyRate: 1400,
        securityDeposit: 3000,
        status: 'AVAILABLE',
        condition: 'Excellent',
        description: 'Test duplicate serial',
        imageUrl: 'https://example.com'
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("Serial number 'SN-SONY-A7IV-01' is already registered");
    });

    it('rejects duplicate inventory ID error from database cleanly', async () => {
      vi.mocked(createClient)
        // 1. Auth context
        .mockResolvedValueOnce({
          auth: {
            getUser: vi.fn().mockResolvedValue({ data: { user: { id: mockAdminProfile.id } }, error: null })
          },
          from: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockAdminProfile, error: null })
              })
            })
          })
        } as any)
        // 2. Insert with unique violation on primary key (inventory ID)
        .mockResolvedValueOnce({
          from: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              head: vi.fn()
            }),
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { code: '23505', message: 'duplicate key value violates unique constraint "digital_cameras_pkey"' }
                })
              })
            })
          })
        } as any);

      const result = await createCamera({
        id: 'CAM-001',
        name: 'Sony A7 IV Duplicate ID',
        brand: 'Sony',
        model: 'ILCE-7M4',
        serialNumber: 'SN-SONY-NEW-99',
        category: 'Mirrorless',
        dailyRate: 1400,
        securityDeposit: 3000,
        status: 'AVAILABLE',
        condition: 'Excellent',
        description: 'Test duplicate inventory ID',
        imageUrl: 'https://example.com'
      });

      expect(result.success).toBe(false);
      expect(result.message).toContain("Camera inventory ID 'CAM-001' already exists in inventory");
    });

    it('rejects invalid category', () => {
      const val = validateCameraInput({
        name: 'Invalid Cam',
        brand: 'Sony',
        model: 'X',
        serialNumber: 'SN-12345',
        category: 'ActionCamera' as any,
        dailyRate: 1000,
        securityDeposit: 2000,
        status: 'AVAILABLE',
        condition: 'Excellent'
      });
      expect(val.isValid).toBe(false);
      expect(val.errors.some(e => e.includes("Invalid camera category 'ActionCamera'"))).toBe(true);
    });

    it('rejects invalid condition rating', () => {
      const val = validateCameraInput({
        name: 'Invalid Cam',
        brand: 'Sony',
        model: 'X',
        serialNumber: 'SN-12345',
        category: 'Mirrorless',
        dailyRate: 1000,
        securityDeposit: 2000,
        status: 'AVAILABLE',
        condition: 'MintCondition' as any
      });
      expect(val.isValid).toBe(false);
      expect(val.errors.some(e => e.includes("Invalid camera condition grade 'MintCondition'"))).toBe(true);
    });

    it('rejects invalid operational status', () => {
      const val = validateCameraInput({
        name: 'Invalid Cam',
        brand: 'Sony',
        model: 'X',
        serialNumber: 'SN-12345',
        category: 'Mirrorless',
        dailyRate: 1000,
        securityDeposit: 2000,
        status: 'STOLEN' as any,
        condition: 'Excellent'
      });
      expect(val.isValid).toBe(false);
      expect(val.errors.some(e => e.includes("Invalid operational status 'STOLEN'"))).toBe(true);
    });

    it('rejects negative or zero daily rate', () => {
      const zeroRate = validateCameraInput({
        name: 'Camera',
        brand: 'Sony',
        model: 'X',
        serialNumber: 'SN-123',
        category: 'Mirrorless',
        dailyRate: 0,
        securityDeposit: 1000,
        status: 'AVAILABLE',
        condition: 'Excellent'
      });
      expect(zeroRate.isValid).toBe(false);
      expect(zeroRate.errors.some(e => e.includes('Daily rental rate (PHP) must be a positive number'))).toBe(true);

      const negativeRate = validateCameraInput({
        name: 'Camera',
        brand: 'Sony',
        model: 'X',
        serialNumber: 'SN-123',
        category: 'Mirrorless',
        dailyRate: -500,
        securityDeposit: 1000,
        status: 'AVAILABLE',
        condition: 'Excellent'
      });
      expect(negativeRate.isValid).toBe(false);
    });

    it('rejects negative security deposit', () => {
      const negativeDeposit = validateCameraInput({
        name: 'Camera',
        brand: 'Sony',
        model: 'X',
        serialNumber: 'SN-123',
        category: 'Mirrorless',
        dailyRate: 1000,
        securityDeposit: -100,
        status: 'AVAILABLE',
        condition: 'Excellent'
      });
      expect(negativeDeposit.isValid).toBe(false);
      expect(negativeDeposit.errors.some(e => e.includes('Security deposit (PHP) must be zero or a positive number'))).toBe(true);
    });
  });

  describe('4. Camera Operational Availability Rules', () => {
    const baseCam: DigitalCamera = {
      id: 'CAM-001',
      serialNumber: 'SN-TEST-01',
      name: 'Sony A7 IV',
      brand: 'Sony',
      model: 'ILCE-7M4',
      category: 'Mirrorless',
      dailyRate: 1400,
      securityDeposit: 3000,
      status: 'AVAILABLE',
      condition: 'Excellent',
      specs: {} as any,
      description: 'Test',
      imageUrl: 'test',
      packageIncludes: [],
      totalRentalsCount: 0,
      createdAt: '',
      updatedAt: ''
    };

    it('excludes MAINTENANCE cameras from available rentals', () => {
      const maintenanceCam: DigitalCamera = { ...baseCam, status: 'MAINTENANCE', maintenanceNotes: 'Sensor cleaning' };
      const check = checkCameraAvailability(maintenanceCam, '2026-10-10', '2026-10-12', []);
      expect(check.isAvailable).toBe(false);
      expect(check.reason).toContain('maintenance');
    });

    it('excludes DAMAGED cameras from available rentals', () => {
      const damagedCam: DigitalCamera = { ...baseCam, status: 'DAMAGED', condition: 'Damaged' };
      const check = checkCameraAvailability(damagedCam, '2026-10-10', '2026-10-12', []);
      expect(check.isAvailable).toBe(false);
      expect(check.reason).toContain('damaged');
    });
  });

  describe('5. Camera Deletion & Decommissioning Lifecycle Rules', () => {
    it('blocks decommissioning/deletion if camera has active pending or approved reservations', async () => {
      vi.mocked(createClient)
        // 1. Auth context (Admin)
        .mockResolvedValueOnce({
          auth: {
            getUser: vi.fn().mockResolvedValue({ data: { user: { id: mockAdminProfile.id } }, error: null })
          },
          from: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockAdminProfile, error: null })
              })
            })
          })
        } as any)
        // 2. Active reservation query returns active bookings
        .mockResolvedValueOnce({
          from: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({
                  data: [{ id: 'RES-001', reference_no: 'IDIO-2026-0001', status: 'APPROVED' }],
                  error: null
                })
              })
            })
          })
        } as any);

      const result = await deleteCamera('CAM-001');
      expect(result.success).toBe(false);
      expect(result.message).toContain('active reservation');
      expect(result.message).toContain('IDIO-2026-0001');
    });

    it('allows decommissioning when camera has no active reservations', async () => {
      vi.mocked(createClient)
        // 1. Auth context (Admin)
        .mockResolvedValueOnce({
          auth: {
            getUser: vi.fn().mockResolvedValue({ data: { user: { id: mockAdminProfile.id } }, error: null })
          },
          from: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockAdminProfile, error: null })
              })
            })
          })
        } as any)
        // 2. Supabase client for reservations query and delete call
        .mockResolvedValueOnce({
          from: vi.fn().mockImplementation((table: string) => {
            if (table === 'reservations') {
              return {
                select: vi.fn().mockReturnValue({
                  eq: vi.fn().mockReturnValue({
                    in: vi.fn().mockResolvedValue({
                      data: [],
                      error: null
                    })
                  })
                })
              };
            }
            if (table === 'digital_cameras') {
              return {
                delete: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({ error: null })
                })
              };
            }
            return {};
          })
        } as any);

      const result = await deleteCamera('CAM-001');
      expect(result.success).toBe(true);
      expect(result.message).toContain("decommissioned from fleet");
    });
  });
});
