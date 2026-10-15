'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  User,
  UserRole,
  DigitalCamera,
  Reservation,
  Rental,
  PaymentAndDeposit,
  MaintenanceLog,
  ActivityLog,
  CameraStatus,
  CameraCondition,
  PaymentStatus,
  PaymentMethod
} from '../types';
import {
  SEED_USERS,
  SEED_CAMERAS,
  SEED_RESERVATIONS,
  SEED_MAINTENANCE,
  SEED_ACTIVITY_LOGS
} from '../data/seedData';
import {
  OperationResult,
  validateRole
} from '../lib/domainService';

import {
  fetchCamerasAction,
  createCameraAction,
  updateCameraAction,
  deleteCameraAction,
  setCameraStatusAction,
  setCameraConditionAction
} from '../app/actions/cameraActions';
import {
  fetchReservationsAction,
  createReservationAction,
  approveReservationAction,
  rejectReservationAction,
  cancelReservationAction
} from '../app/actions/reservationActions';
import {
  fetchRentalsAction,
  checkoutRentalAction,
  processReturnAction,
  completeRentalAction
} from '../app/actions/rentalActions';
import {
  fetchPaymentsAction,
  confirmPaymentAction,
  refundPaymentAction,
  settleDepositAction
} from '../app/actions/paymentActions';
import { CURRENT_AGREEMENT_VERSION } from '../data/rentalAgreement';
import { useAuth } from './AuthContext';

interface SystemContextType {
  currentUser: User;
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  users: User[];
  updateCurrentUserProfile: (profile: Partial<User>) => OperationResult;
  
  cameras: DigitalCamera[];
  addCamera: (camera: Omit<DigitalCamera, 'id' | 'createdAt' | 'updatedAt' | 'totalRentalsCount'>) => Promise<OperationResult<DigitalCamera>>;
  updateCamera: (id: string, camera: Partial<DigitalCamera>) => Promise<OperationResult<DigitalCamera>>;
  deleteCamera: (id: string) => Promise<OperationResult>;
  setCameraStatus: (id: string, status: CameraStatus, notes?: string) => Promise<OperationResult>;
  setCameraCondition: (id: string, condition: CameraCondition) => Promise<OperationResult>;

  reservations: Reservation[];
  createReservation: (data: {
    cameraId: string;
    startDate: string;
    endDate: string;
    purpose: string;
    paymentMethod: PaymentMethod;
    paymentReference?: string;
    agreementAccepted?: boolean;
    agreementVersion?: string;
  }) => Promise<OperationResult<Reservation>>;
  approveReservation: (id: string) => Promise<OperationResult<Reservation>>;
  rejectReservation: (id: string, reason: string) => Promise<OperationResult<Reservation>>;
  cancelReservation: (id: string) => Promise<OperationResult<Reservation>>;

  rentals: Rental[];
  checkoutRental: (id: string, condition: CameraCondition, notes?: string) => Promise<OperationResult<Rental>>;
  returnInspectionRental: (
    id: string,
    condition: CameraCondition,
    notes: string,
    depositAction?: 'REFUND_FULL' | 'DEDUCT_DAMAGE' | 'FORFEIT',
    deductionAmount?: number,
    deductionReason?: string,
    flagMaintenance?: boolean
  ) => Promise<OperationResult<Rental>>;
  completeRental: (rentalId: string) => Promise<OperationResult<Rental>>;

  payments: PaymentAndDeposit[];
  confirmPayment: (paymentId: string, method?: PaymentMethod, reference?: string) => Promise<OperationResult<PaymentAndDeposit>>;
  refundPayment: (paymentId: string, reason?: string) => Promise<OperationResult<PaymentAndDeposit>>;
  settleDeposit: (paymentId: string, action: 'REFUND_FULL' | 'DEDUCT_DAMAGE' | 'FORFEIT', amount?: number, reason?: string) => Promise<OperationResult<PaymentAndDeposit>>;
  updatePaymentStatus: (id: string, status: PaymentStatus, reference?: string) => OperationResult;

  maintenanceLogs: MaintenanceLog[];
  addMaintenanceLog: (log: Omit<MaintenanceLog, 'id'>) => OperationResult<MaintenanceLog>;
  updateMaintenanceLog: (id: string, log: Partial<MaintenanceLog>) => OperationResult<MaintenanceLog>;

  activityLogs: ActivityLog[];
  resetToDefaults: () => void;
}



const SystemContext = createContext<SystemContextType | undefined>(undefined);

const STORAGE_KEYS = {
  USERS: 'idio_users_v2',
  MAINTENANCE: 'idio_maintenance_v2',
  ACTIVITY: 'idio_activity_v2'
};

export const SystemProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { role: authRole, profile: authProfile } = useAuth();

  const [users, setUsers] = useState<User[]>(() => {
    if (typeof window === 'undefined') return SEED_USERS;
    const saved = localStorage.getItem(STORAGE_KEYS.USERS);
    return saved ? JSON.parse(saved) : SEED_USERS;
  });

  // Role is driven by real Supabase Auth session, falling back to 'CUSTOMER'
  const currentRole: UserRole = authRole || 'CUSTOMER';

  const setCurrentRole = (_role: UserRole) => {
    // Role cannot be directly mutated locally; authentication drives role state
  };

  // Authoritative Camera Data from Supabase database (public.digital_cameras)
  const [cameras, setCameras] = useState<DigitalCamera[]>(SEED_CAMERAS);

  useEffect(() => {
    let isMounted = true;
    async function loadCameras() {
      try {
        const res = await fetchCamerasAction();
        if (isMounted && res.success && res.data && res.data.length > 0) {
          const valid = res.data.filter(c => !c.name.toLowerCase().includes('unauthorized') && !c.id.startsWith('CAM-X'));
          setCameras(valid);
        }
      } catch (e) {
        // Fallback to seed data in dev/offline mode
      }
    }
    loadCameras();
    return () => {
      isMounted = false;
    };
  }, []);

  // Authoritative Reservation Data from Supabase database (public.reservations)
  const [reservations, setReservations] = useState<Reservation[]>(() => {
    // Only Admin in dev/offline mode uses seed reservations; Customers & guests start completely clean
    return currentRole === 'ADMIN' ? SEED_RESERVATIONS : [];
  });

  useEffect(() => {
    let isMounted = true;
    async function loadReservations() {
      // Unauthenticated customer/guest: enforce clean empty list
      if (currentRole === 'CUSTOMER' && !authProfile?.id) {
        if (isMounted) setReservations([]);
        return;
      }
      try {
        const res = await fetchReservationsAction();
        if (isMounted && res.success && Array.isArray(res.data)) {
          setReservations(res.data);
        } else if (isMounted && currentRole === 'CUSTOMER') {
          // Clean empty list for customer with 0 bookings or when unauthorized
          setReservations([]);
        }
      } catch (e) {
        // Fallback: keep customer clean with empty list
        if (isMounted && currentRole === 'CUSTOMER') {
          setReservations([]);
        }
      }
    }
    loadReservations();
    return () => {
      isMounted = false;
    };
  }, [authProfile?.id, currentRole]);

  // Synchronize reservation status with live camera status if camera is already checked out
  useEffect(() => {
    if (cameras.length === 0) return;
    setReservations(prev => {
      let changed = false;
      const next = prev.map(r => {
        if (r.status === 'APPROVED') {
          const cam = cameras.find(c => c.id === r.cameraId);
          if (cam?.status === 'CHECKED_OUT') {
            changed = true;
            return { ...r, status: 'CHECKED_OUT' as const };
          }
        }
        return r;
      });
      return changed ? next : prev;
    });
  }, [cameras]);

  // Authoritative Rental Data from Supabase database (public.rentals)
  const [rentals, setRentals] = useState<Rental[]>([]);

  useEffect(() => {
    let isMounted = true;
    async function loadRentals() {
      if (currentRole === 'CUSTOMER' && !authProfile?.id) {
        if (isMounted) setRentals([]);
        return;
      }
      try {
        const res = await fetchRentalsAction();
        if (isMounted && res.success && Array.isArray(res.data)) {
          setRentals(res.data);
        } else if (isMounted && currentRole === 'CUSTOMER') {
          setRentals([]);
        }
      } catch (e) {
        if (isMounted && currentRole === 'CUSTOMER') {
          setRentals([]);
        }
      }
    }
    loadRentals();
    return () => {
      isMounted = false;
    };
  }, [authProfile?.id, currentRole]);

  // Authoritative Payment & Deposit Data from Supabase database (public.payments_and_deposits)
  const [payments, setPayments] = useState<PaymentAndDeposit[]>([]);

  useEffect(() => {
    let isMounted = true;
    async function loadPayments() {
      if (currentRole === 'CUSTOMER' && !authProfile?.id) {
        if (isMounted) setPayments([]);
        return;
      }
      try {
        const res = await fetchPaymentsAction();
        if (isMounted && res.success && Array.isArray(res.data)) {
          setPayments(res.data);
        } else if (isMounted && currentRole === 'CUSTOMER') {
          setPayments([]);
        }
      } catch (e) {
        if (isMounted && currentRole === 'CUSTOMER') {
          setPayments([]);
        }
      }
    }
    loadPayments();
    return () => {
      isMounted = false;
    };
  }, [authProfile?.id, currentRole]);

  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>(() => {
    if (typeof window === 'undefined') return SEED_MAINTENANCE;
    const saved = localStorage.getItem(STORAGE_KEYS.MAINTENANCE);
    return saved ? JSON.parse(saved) : SEED_MAINTENANCE;
  });

  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(() => {
    if (typeof window === 'undefined') return SEED_ACTIVITY_LOGS;
    const saved = localStorage.getItem(STORAGE_KEYS.ACTIVITY);
    return saved ? JSON.parse(saved) : SEED_ACTIVITY_LOGS;
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    }
  }, [users]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.MAINTENANCE, JSON.stringify(maintenanceLogs));
    }
  }, [maintenanceLogs]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.ACTIVITY, JSON.stringify(activityLogs));
    }
  }, [activityLogs]);

  // Clean guest user representation for visitors who have not signed in yet
  const guestCustomer: User = {
    id: '',
    name: 'Guest User',
    email: '',
    phone: '',
    role: 'CUSTOMER',
    avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&q=80',
    barangay: 'Libertad',
    streetAddress: '',
    city: 'Butuan City',
    province: 'Agusan del Norte',
    idType: 'Philippine National ID',
    idNumber: ''
  };

  const adminBaseUser = users.find(u => u.role === 'ADMIN') || users[0];

  // Active authenticated user derived from real profile or role mapping
  const currentUser: User = authProfile
    ? {
        id: authProfile.id,
        name: authProfile.full_name,
        email: authProfile.email,
        phone: authProfile.phone,
        role: authProfile.role as UserRole,
        avatarUrl: authProfile.avatar_url || adminBaseUser.avatarUrl,
        barangay: authProfile.barangay,
        streetAddress: authProfile.street_address,
        city: authProfile.city,
        province: authProfile.province,
        idType: authProfile.id_type,
        idNumber: authProfile.id_number
      }
    : currentRole === 'ADMIN'
      ? adminBaseUser
      : guestCustomer;

  const logActivity = (action: string, details: string, targetType: ActivityLog['targetType'], targetId: string) => {
    const newLog: ActivityLog = {
      id: `ACT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      actorName: currentUser.name,
      actorRole: currentUser.role,
      action,
      details,
      targetType,
      targetId
    };
    setActivityLogs(prev => [newLog, ...prev]);
  };

  const updateCurrentUserProfile = (profile: Partial<User>): OperationResult => {
    setUsers(prev => prev.map(u => (u.id === currentUser.id ? { ...u, ...profile } : u)));
    logActivity('UPDATE_PROFILE', `Updated profile data for ${currentUser.name}`, 'PROFILE', currentUser.id);
    return { success: true, message: 'Profile updated successfully.' };
  };

  // Camera Management backed by Server Actions & Supabase Database
  const addCamera = async (data: Omit<DigitalCamera, 'id' | 'createdAt' | 'updatedAt' | 'totalRentalsCount'>): Promise<OperationResult<DigitalCamera>> => {
    try {
      const res = await createCameraAction({
        name: data.name,
        brand: data.brand,
        model: data.model,
        serialNumber: data.serialNumber,
        category: data.category,
        dailyRate: data.dailyRate,
        securityDeposit: data.securityDeposit,
        status: data.status,
        condition: data.condition,
        description: data.description,
        imageUrl: data.imageUrl,
        specs: data.specs,
        packageIncludes: data.packageIncludes,
        maintenanceNotes: data.maintenanceNotes
      });

      if (!res.success || !res.data) {
        return { success: false, message: res.message || 'Failed to add camera.' };
      }

      setCameras(prev => [res.data!, ...prev]);
      logActivity('CREATE_CAMERA', `Added digital camera ${res.data.name} (${res.data.serialNumber})`, 'CAMERA', res.data.id);
      return { success: true, message: res.message, data: res.data };
    } catch (err: any) {
      return { success: false, message: err.message || 'Server error creating camera.' };
    }
  };

  const updateCamera = async (id: string, data: Partial<DigitalCamera>): Promise<OperationResult<DigitalCamera>> => {
    try {
      const res = await updateCameraAction(id, {
        name: data.name,
        brand: data.brand,
        model: data.model,
        serialNumber: data.serialNumber,
        category: data.category,
        dailyRate: data.dailyRate,
        securityDeposit: data.securityDeposit,
        status: data.status,
        condition: data.condition,
        description: data.description,
        imageUrl: data.imageUrl,
        specs: data.specs,
        packageIncludes: data.packageIncludes,
        maintenanceNotes: data.maintenanceNotes
      });

      if (!res.success || !res.data) {
        return { success: false, message: res.message || 'Failed to update camera.' };
      }

      setCameras(prev => prev.map(c => (c.id === id ? res.data! : c)));
      logActivity('UPDATE_CAMERA', `Updated specifications for ${res.data.name}`, 'CAMERA', id);
      return { success: true, message: res.message, data: res.data };
    } catch (err: any) {
      return { success: false, message: err.message || 'Server error updating camera.' };
    }
  };

  const deleteCamera = async (id: string): Promise<OperationResult> => {
    try {
      const res = await deleteCameraAction(id);
      if (!res.success) {
        return { success: false, message: res.message || 'Failed to delete camera.' };
      }

      setCameras(prev => prev.filter(c => c.id !== id));
      logActivity('DELETE_CAMERA', `Decommissioned camera ID ${id}`, 'CAMERA', id);
      return { success: true, message: res.message };
    } catch (err: any) {
      return { success: false, message: err.message || 'Server error deleting camera.' };
    }
  };

  const setCameraStatus = async (id: string, status: CameraStatus, notes?: string): Promise<OperationResult> => {
    try {
      const res = await setCameraStatusAction(id, status, notes);
      if (!res.success || !res.data) {
        return { success: false, message: res.message || 'Failed to update camera status.' };
      }

      setCameras(prev => prev.map(c => (c.id === id ? res.data! : c)));
      logActivity('UPDATE_CAMERA_STATUS', `Set status to ${status}${notes ? ` (${notes})` : ''}`, 'CAMERA', id);
      return { success: true, message: res.message };
    } catch (err: any) {
      return { success: false, message: err.message || 'Server error updating status.' };
    }
  };

  const setCameraCondition = async (id: string, condition: CameraCondition): Promise<OperationResult> => {
    try {
      const res = await setCameraConditionAction(id, condition);
      if (!res.success || !res.data) {
        return { success: false, message: res.message || 'Failed to update condition.' };
      }

      setCameras(prev => prev.map(c => (c.id === id ? res.data! : c)));
      logActivity('UPDATE_CAMERA_CONDITION', `Set condition grade to ${condition}`, 'CAMERA', id);
      return { success: true, message: res.message };
    } catch (err: any) {
      return { success: false, message: err.message || 'Server error updating condition.' };
    }
  };

  // Reservation & Rental Workflow backed by Server Actions & Supabase Database
  const createReservation = async (data: {
    cameraId: string;
    startDate: string;
    endDate: string;
    purpose: string;
    paymentMethod: PaymentMethod;
    paymentReference?: string;
    agreementAccepted?: boolean;
    agreementVersion?: string;
  }): Promise<OperationResult<Reservation>> => {
    try {
      const res = await createReservationAction({
        cameraId: data.cameraId,
        startDate: data.startDate,
        endDate: data.endDate,
        purpose: data.purpose,
        paymentMethod: data.paymentMethod,
        paymentReference: data.paymentReference,
        agreementAccepted: data.agreementAccepted ?? true,
        agreementVersion: data.agreementVersion ?? CURRENT_AGREEMENT_VERSION
      });


      if (!res.success || !res.data) {
        return { success: false, message: res.message || 'Failed to create reservation.' };
      }

      setReservations(prev => [res.data!, ...prev]);
      logActivity(
        'CREATE_RESERVATION',
        `Placed reservation ${res.data.referenceNo} for ${res.data.cameraName}`,
        'RESERVATION',
        res.data.id
      );
      return { success: true, message: res.message, data: res.data };
    } catch (err: any) {
      return { success: false, message: err.message || 'Server error creating reservation.' };
    }
  };

  const approveReservation = async (id: string): Promise<OperationResult<Reservation>> => {
    try {
      const res = await approveReservationAction(id);
      if (!res.success || !res.data) {
        return { success: false, message: res.message || 'Failed to approve reservation.' };
      }

      setReservations(prev => prev.map(r => (r.id === id ? res.data! : r)));
      logActivity('APPROVE_RESERVATION', `Approved reservation ${res.data.referenceNo}`, 'RESERVATION', id);
      return { success: true, message: res.message, data: res.data };
    } catch (err: any) {
      return { success: false, message: err.message || 'Server error approving reservation.' };
    }
  };

  const rejectReservation = async (id: string, reason: string): Promise<OperationResult<Reservation>> => {
    try {
      const res = await rejectReservationAction(id, reason);
      if (!res.success || !res.data) {
        return { success: false, message: res.message || 'Failed to reject reservation.' };
      }

      setReservations(prev => prev.map(r => (r.id === id ? res.data! : r)));
      logActivity('REJECT_RESERVATION', `Rejected reservation ${res.data.referenceNo}. Reason: ${reason}`, 'RESERVATION', id);
      return { success: true, message: res.message, data: res.data };
    } catch (err: any) {
      return { success: false, message: err.message || 'Server error rejecting reservation.' };
    }
  };

  const cancelReservation = async (id: string): Promise<OperationResult<Reservation>> => {
    try {
      const res = await cancelReservationAction(id);
      if (!res.success || !res.data) {
        return { success: false, message: res.message || 'Failed to cancel reservation.' };
      }

      setReservations(prev => prev.map(r => (r.id === id ? res.data! : r)));
      logActivity('CANCEL_RESERVATION', `Cancelled reservation ${res.data.referenceNo}`, 'RESERVATION', id);
      return { success: true, message: res.message, data: res.data };
    } catch (err: any) {
      return { success: false, message: err.message || 'Server error cancelling reservation.' };
    }
  };

  const checkoutRental = async (id: string, condition: CameraCondition, notes?: string): Promise<OperationResult<Rental>> => {
    try {
      const res = await checkoutRentalAction({
        reservationId: id,
        checkoutCondition: condition,
        checkoutNotes: notes
      });

      if (!res.success || !res.data) {
        return { success: false, message: res.message || 'Failed to checkout rental.' };
      }

      setRentals(prev => [res.data!, ...prev]);
      setReservations(prev =>
        prev.map(r =>
          r.id === id
            ? {
                ...r,
                status: 'CHECKED_OUT',
                checkoutCondition: condition,
                checkoutNotes: notes,
                checkoutTimestamp: res.data!.checkedOutAt,
                updatedAt: res.data!.updatedAt
              }
            : r
        )
      );
      setCameras(prev =>
        prev.map(c =>
          c.id === res.data!.cameraId
            ? {
                ...c,
                status: 'CHECKED_OUT',
                condition: condition,
                totalRentalsCount: (c.totalRentalsCount || 0) + 1,
                updatedAt: res.data!.updatedAt
              }
            : c
        )
      );

      logActivity(
        'CHECKOUT_RENTAL',
        `Checked out ${res.data.cameraName || 'Camera'} to ${res.data.customerName || 'Customer'}. Grade: ${condition}`,
        'RESERVATION',
        id
      );
      return { success: true, message: res.message, data: res.data };
    } catch (err: any) {
      return { success: false, message: err.message || 'Server error checking out rental.' };
    }
  };

  const returnInspectionRental = async (
    id: string,
    condition: CameraCondition,
    notes: string,
    depositAction?: 'REFUND_FULL' | 'DEDUCT_DAMAGE' | 'FORFEIT',
    deductionAmount = 0,
    deductionReason = '',
    flagMaintenance = false
  ): Promise<OperationResult<Rental>> => {
    try {
      const targetRental = rentals.find(r => r.id === id || r.reservationId === id);
      const rentalId = targetRental ? targetRental.id : id;

      const res = await processReturnAction({
        rentalId,
        returnCondition: condition,
        returnInspectionNotes: notes,
        flagMaintenance
      });

      if (!res.success || !res.data) {
        return { success: false, message: res.message || 'Failed to process return.' };
      }

      setRentals(prev => prev.map(r => (r.id === rentalId ? res.data! : r)));

      let nextCameraStatus: CameraStatus = 'AVAILABLE';
      if (condition === 'Damaged') {
        nextCameraStatus = 'DAMAGED';
      } else if (flagMaintenance || condition === 'Fair') {
        nextCameraStatus = 'MAINTENANCE';
      }

      setCameras(prev =>
        prev.map(c =>
          c.id === res.data!.cameraId
            ? {
                ...c,
                status: nextCameraStatus,
                condition: condition,
                maintenanceNotes: nextCameraStatus !== 'AVAILABLE' ? notes : undefined,
                updatedAt: res.data!.updatedAt
              }
            : c
        )
      );

      setReservations(prev =>
        prev.map(r =>
          (r.id === res.data!.reservationId || r.id === id)
            ? {
                ...r,
                status: 'RETURNED',
                returnCondition: condition,
                returnNotes: notes,
                returnTimestamp: res.data!.returnedAt,
                updatedAt: res.data!.updatedAt
              }
            : r
        )
      );

      logActivity(
        'RETURN_INSPECTION',
        `Inspected return of ${res.data.cameraName || 'Camera'}. Return Grade: ${condition}. Equipment Status: ${nextCameraStatus}`,
        'RESERVATION',
        id
      );

      // Settle security deposit if action is provided
      if (depositAction) {
        const paymentRecord = payments.find(p => p.reservationId === res.data!.reservationId || p.reservationId === id);
        if (paymentRecord && paymentRecord.depositStatus === 'HELD') {
          await settleDeposit(paymentRecord.id, depositAction, deductionAmount, deductionReason);
        }
      }

      return { success: true, message: res.message, data: res.data };
    } catch (err: any) {
      return { success: false, message: err.message || 'Server error processing return.' };
    }
  };

  const completeRental = async (rentalId: string): Promise<OperationResult<Rental>> => {
    try {
      const res = await completeRentalAction(rentalId);
      if (!res.success || !res.data) {
        return { success: false, message: res.message || 'Failed to complete rental.' };
      }

      setRentals(prev => prev.map(r => (r.id === rentalId ? res.data! : r)));
      setReservations(prev =>
        prev.map(r =>
          r.id === res.data!.reservationId
            ? {
                ...r,
                status: 'COMPLETED',
                updatedAt: res.data!.updatedAt
              }
            : r
        )
      );

      logActivity(
        'COMPLETE_RENTAL',
        `Completed rental for ${res.data.cameraName || 'Camera'}`,
        'RESERVATION',
        rentalId
      );

      return { success: true, message: res.message, data: res.data };
    } catch (err: any) {
      return { success: false, message: err.message || 'Server error completing rental.' };
    }
  };

  // Payment & Security Deposit Operations backed by Server Actions & Supabase Database
  const confirmPayment = async (paymentId: string, method?: PaymentMethod, reference?: string): Promise<OperationResult<PaymentAndDeposit>> => {
    try {
      const res = await confirmPaymentAction({
        paymentId,
        paymentMethod: method,
        paymentReference: reference
      });

      if (!res.success || !res.data) {
        return { success: false, message: res.message || 'Failed to confirm payment.' };
      }

      setPayments(prev => prev.map(p => (p.id === paymentId ? res.data! : p)));
      setReservations(prev =>
        prev.map(r =>
          r.id === res.data!.reservationId
            ? {
                ...r,
                paymentStatus: 'PAID',
                paymentMethod: res.data!.paymentMethod,
                paymentReference: res.data!.paymentReference,
                updatedAt: res.data!.updatedAt
              }
            : r
        )
      );

      logActivity(
        'CONFIRM_PAYMENT',
        `Confirmed payment of ₱${res.data.rentalAmount.toFixed(2)} for ${res.data.cameraName || 'Reservation'}`,
        'RESERVATION',
        res.data.reservationId
      );

      return { success: true, message: res.message, data: res.data };
    } catch (err: any) {
      return { success: false, message: err.message || 'Server error confirming payment.' };
    }
  };

  const refundPayment = async (paymentId: string, reason?: string): Promise<OperationResult<PaymentAndDeposit>> => {
    try {
      const res = await refundPaymentAction({
        paymentId,
        reason
      });

      if (!res.success || !res.data) {
        return { success: false, message: res.message || 'Failed to refund payment.' };
      }

      setPayments(prev => prev.map(p => (p.id === paymentId ? res.data! : p)));
      setReservations(prev =>
        prev.map(r =>
          r.id === res.data!.reservationId
            ? {
                ...r,
                paymentStatus: 'REFUNDED',
                updatedAt: res.data!.updatedAt
              }
            : r
        )
      );

      logActivity(
        'REFUND_PAYMENT',
        `Refunded payment of ₱${res.data.rentalAmount.toFixed(2)} for ${res.data.cameraName || 'Reservation'}`,
        'RESERVATION',
        res.data.reservationId
      );

      return { success: true, message: res.message, data: res.data };
    } catch (err: any) {
      return { success: false, message: err.message || 'Server error refunding payment.' };
    }
  };

  const settleDeposit = async (
    paymentId: string,
    action: 'REFUND_FULL' | 'DEDUCT_DAMAGE' | 'FORFEIT',
    amount?: number,
    reason?: string
  ): Promise<OperationResult<PaymentAndDeposit>> => {
    try {
      const res = await settleDepositAction({
        paymentId,
        action,
        deductionAmount: amount,
        deductionReason: reason
      });

      if (!res.success || !res.data) {
        return { success: false, message: res.message || 'Failed to settle security deposit.' };
      }

      setPayments(prev => prev.map(p => (p.id === paymentId ? res.data! : p)));
      setReservations(prev =>
        prev.map(r =>
          r.id === res.data!.reservationId
            ? {
                ...r,
                depositStatus: res.data!.depositStatus,
                depositDeduction: res.data!.depositDeduction,
                depositNotes: res.data!.depositDeductionReason,
                updatedAt: res.data!.updatedAt
              }
            : r
        )
      );

      logActivity(
        'SETTLE_DEPOSIT',
        `Settled security deposit as ${res.data.depositStatus} for ${res.data.cameraName || 'Reservation'}`,
        'RESERVATION',
        res.data.reservationId
      );

      return { success: true, message: res.message, data: res.data };
    } catch (err: any) {
      return { success: false, message: err.message || 'Server error settling security deposit.' };
    }
  };

  const updatePaymentStatus = (id: string, status: PaymentStatus, reference?: string): OperationResult => {
    const roleCheck = validateRole(currentUser, ['ADMIN'], 'Update Payment Status');
    if (!roleCheck.success) return roleCheck;

    setReservations(prev =>
      prev.map(r =>
        r.id === id
          ? {
              ...r,
              paymentStatus: status,
              paymentReference: reference || r.paymentReference,
              updatedAt: new Date().toISOString()
            }
          : r
      )
    );
    logActivity('UPDATE_PAYMENT', `Updated payment to ${status} for ${id}`, 'RESERVATION', id);
    return { success: true, message: `Payment updated to ${status}.` };
  };

  // Maintenance Management
  const addMaintenanceLog = (data: Omit<MaintenanceLog, 'id'>): OperationResult<MaintenanceLog> => {
    const roleCheck = validateRole(currentUser, ['ADMIN'], 'Create Maintenance Ticket');
    if (!roleCheck.success) return roleCheck;

    const id = `MNT-${Date.now().toString().slice(-4)}`;
    const newLog: MaintenanceLog = { ...data, id };
    setMaintenanceLogs(prev => [newLog, ...prev]);

    // Automatically set camera to MAINTENANCE status
    setCameraStatus(data.cameraId, 'MAINTENANCE', data.description);
    logActivity('ADD_MAINTENANCE', `Created ticket for ${data.cameraName}: ${data.issueType}`, 'MAINTENANCE', id);
    return { success: true, message: `Maintenance ticket ${id} created.`, data: newLog };
  };

  const updateMaintenanceLog = (id: string, data: Partial<MaintenanceLog>): OperationResult<MaintenanceLog> => {
    const roleCheck = validateRole(currentUser, ['ADMIN'], 'Update Maintenance Ticket');
    if (!roleCheck.success) return roleCheck;

    let updatedResult: MaintenanceLog | undefined;
    setMaintenanceLogs(prev =>
      prev.map(m => {
        if (m.id === id) {
          const updated = { ...m, ...data };
          updatedResult = updated;
          if (data.status === 'Completed' && m.status !== 'Completed') {
            const cam = cameras.find(c => c.id === m.cameraId);
            if (cam && cam.status === 'MAINTENANCE') {
              setCameraStatus(cam.id, 'AVAILABLE');
            }
          }
          return updated;
        }
        return m;
      })
    );
    logActivity('UPDATE_MAINTENANCE', `Updated maintenance record ${id}`, 'MAINTENANCE', id);
    return { success: true, message: `Maintenance record ${id} updated.`, data: updatedResult };
  };

  const resetToDefaults = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.USERS);
      localStorage.removeItem('idio_cameras_v2'); // Clean up any stale legacy camera cache
      localStorage.removeItem('idio_reservations_v2'); // Clean up any stale legacy reservation cache
      localStorage.removeItem(STORAGE_KEYS.MAINTENANCE);
      localStorage.removeItem(STORAGE_KEYS.ACTIVITY);
    }
    setUsers(SEED_USERS);
    setCameras(SEED_CAMERAS);
    setReservations(currentRole === 'ADMIN' ? SEED_RESERVATIONS : []);
    setRentals([]);
    setPayments([]);
    setMaintenanceLogs(SEED_MAINTENANCE);
    setActivityLogs(SEED_ACTIVITY_LOGS);
  };

  return (
    <SystemContext.Provider
      value={{
        currentUser,
        currentRole,
        setCurrentRole,
        users,
        updateCurrentUserProfile,
        cameras,
        addCamera,
        updateCamera,
        deleteCamera,
        setCameraStatus,
        setCameraCondition,
        reservations,
        createReservation,
        approveReservation,
        rejectReservation,
        cancelReservation,
        rentals,
        checkoutRental,
        returnInspectionRental,
        completeRental,
        payments,
        confirmPayment,
        refundPayment,
        settleDeposit,
        updatePaymentStatus,
        maintenanceLogs,
        addMaintenanceLog,
        updateMaintenanceLog,
        activityLogs,
        resetToDefaults
      }}
    >
      {children}
    </SystemContext.Provider>
  );


};

export const useSystem = () => {
  const context = useContext(SystemContext);
  if (!context) {
    throw new Error('useSystem must be used within a SystemProvider');
  }
  return context;
};
