'use client';
import React, { useState, useMemo } from 'react';
import { DigitalCamera, PaymentMethod } from '../../types';
import { useSystem } from '../../context/SystemContext';
import { Dialog } from '../common/Dialog';
import { formatPHP, formatDate, calculateRentalDays, getCameraImageUrl, addDays } from '../../lib/utils';
import { checkCameraAvailability, getBookedDateRanges } from '../../lib/availabilityEngine';
import { CURRENT_AGREEMENT_VERSION, CURRENT_AGREEMENT_TITLE, CANONICAL_AGREEMENT_SECTIONS } from '../../data/rentalAgreement';
import { AvailabilityCalendar, BookedRange } from './AvailabilityCalendar';
import { fetchCameraAvailabilityScheduleAction } from '../../app/actions/reservationActions';
import { createClient as createBrowserSupabaseClient } from '../../lib/supabase/client';
import { ReservationSuccessModal, ConfirmedReservationData } from './ReservationSuccessModal';
import {
  CalendarDays,
  ShieldCheck,
  CreditCard,
  MapPin,
  AlertCircle,
  CheckCircle2,
  Camera,
  QrCode,
  ArrowRight,
  FileText,
  Clock
} from 'lucide-react';

interface ReservationModalProps {
  camera: DigitalCamera | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (referenceNo: string) => void;
}

export const ReservationModal: React.FC<ReservationModalProps> = ({
  camera,
  isOpen,
  onClose,
  onSuccess
}) => {
  const { currentUser, reservations, createReservation } = useSystem();

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [rangeError, setRangeError] = useState('');
  const [purpose, setPurpose] = useState('Personal photography / event documentation in Butuan City');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH_PICKUP');
  const [paymentReference, setPaymentReference] = useState('CASH-ON-PICKUP');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedReservation, setConfirmedReservation] = useState<ConfirmedReservationData | null>(null);

  // Shared database-backed booked ranges
  const [sharedBookedRanges, setSharedBookedRanges] = useState<BookedRange[]>([]);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  const [availabilityFetchError, setAvailabilityFetchError] = useState<string | null>(null);

  // Fetch shared database availability schedule
  const loadDatabaseAvailability = React.useCallback(async () => {
    if (!camera?.id) return;
    setIsLoadingAvailability(true);
    try {
      const res = await fetchCameraAvailabilityScheduleAction(camera.id);
      if (res.success && Array.isArray(res.data)) {
        setSharedBookedRanges(res.data);
        setAvailabilityFetchError(null);
      } else {
        setAvailabilityFetchError(res.message || 'Unable to verify real-time availability from database.');
      }
    } catch (err: any) {
      setAvailabilityFetchError(err.message || 'Failed to verify camera availability.');
    } finally {
      setIsLoadingAvailability(false);
    }
  }, [camera?.id]);

  // Load availability on modal open and subscribe to live changes via Realtime
  React.useEffect(() => {
    if (!isOpen || !camera?.id) return;

    loadDatabaseAvailability();

    try {
      const supabase = createBrowserSupabaseClient();
      const channel = supabase
        .channel(`camera_avail_${camera.id}_${Date.now()}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'reservations', filter: `camera_id=eq.${camera.id}` },
          () => {
            loadDatabaseAvailability();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'rentals', filter: `camera_id=eq.${camera.id}` },
          () => {
            loadDatabaseAvailability();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch {
      // Graceful fallback when browser client cannot connect to websocket
    }
  }, [isOpen, camera?.id, loadDatabaseAvailability]);

  // Effective reservations combining shared database records with active state
  const effectiveReservations = useMemo(() => {
    if (!camera) return [];

    const dbReservations: any[] = sharedBookedRanges.map((r, i) => ({
      id: `db-booked-${i}`,
      referenceNo: r.referenceNo || 'RESERVED',
      customerId: 'db-customer',
      customerName: 'Customer',
      customerEmail: '',
      customerPhone: '',
      customerBarangay: '',
      idType: '',
      idNumber: '',
      cameraId: camera.id,
      cameraName: camera.name,
      cameraBrand: camera.brand,
      cameraSerial: camera.serialNumber,
      cameraImageUrl: camera.imageUrl,
      startDate: r.startDate,
      endDate: r.endDate,
      totalDays: 1,
      dailyRate: camera.dailyRate,
      subtotal: camera.dailyRate,
      securityDeposit: camera.securityDeposit,
      totalAmount: camera.dailyRate + camera.securityDeposit,
      purpose: 'Active booking',
      status: r.status,
      paymentStatus: 'PAID' as const,
      paymentMethod: 'CASH_PICKUP' as const,
      depositStatus: 'HELD' as const,
      createdAt: '',
      updatedAt: ''
    }));

    const localReservations = reservations.filter(r => r.cameraId === camera.id);
    const combined = [...dbReservations];
    for (const l of localReservations) {
      if (!combined.some(c => c.startDate === l.startDate && c.endDate === l.endDate)) {
        combined.push(l);
      }
    }
    return combined;
  }, [camera, sharedBookedRanges, reservations]);

  // Booked ranges for this camera (used by the calendar)
  const effectiveBookedRanges = useMemo(() => {
    if (!camera) return [];
    return getBookedDateRanges(camera.id, effectiveReservations);
  }, [camera, effectiveReservations]);

  // Is the camera globally unavailable regardless of dates?
  const cameraGloballyUnavailable = camera
    ? camera.status === 'MAINTENANCE' || camera.status === 'DAMAGED'
    : false;

  const cameraUnavailableReason = camera
    ? camera.status === 'MAINTENANCE'
      ? `Camera is under maintenance — ${camera.maintenanceNotes || 'Routine calibration / repair'}. Please check back later.`
      : camera.status === 'DAMAGED'
        ? 'Camera is currently marked as damaged and cannot be rented.'
        : undefined
    : undefined;

  // Real-time availability check for the selected range
  const availability = useMemo(() => {
    if (!camera) return { isAvailable: false, reason: 'No camera selected.' };
    if (!startDate || !endDate) return { isAvailable: false, reason: '' };
    return checkCameraAvailability(camera, startDate, endDate, effectiveReservations);
  }, [camera, startDate, endDate, effectiveReservations]);

  if (!camera) return null;

  const totalDays = (startDate && endDate) ? calculateRentalDays(startDate, endDate) : 0;
  const subtotal = totalDays * camera.dailyRate;
  const securityDeposit = camera.securityDeposit;
  const totalAmount = subtotal + securityDeposit;

  const handleDateChange = (newStart: string, newEnd: string) => {
    setRangeError('');
    setErrorMessage('');

    if (!newStart) {
      setStartDate('');
      setEndDate('');
      return;
    }

    if (newStart && newEnd) {
      // Validate immediately against shared database reservations
      const check = checkCameraAvailability(camera, newStart, newEnd, effectiveReservations);
      if (!check.isAvailable && check.reason) {
        setRangeError(check.reason);
        setStartDate(newStart);
        setEndDate('');
        return;
      }
    }

    setStartDate(newStart);
    setEndDate(newEnd);
  };

  const handleClose = () => {
    setConfirmedReservation(null);
    onClose();
  };

  const handleViewReservations = () => {
    const refNo = confirmedReservation?.referenceNo || '';
    setConfirmedReservation(null);
    onSuccess(refNo);
    onClose();
  };

  const handleContinueBrowsing = () => {
    setConfirmedReservation(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!startDate || !endDate) {
      setErrorMessage('Please select both a pickup date and a return date on the calendar.');
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      setErrorMessage('Return date cannot be earlier than pickup date.');
      return;
    }

    if (!availability.isAvailable) {
      setErrorMessage(availability.reason || 'Camera is not available for the requested period.');
      return;
    }

    if (!agreedToTerms) {
      setErrorMessage('You must review and explicitly accept the Customer Rental Agreement before submitting your reservation.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await createReservation({
        cameraId: camera.id,
        startDate,
        endDate,
        purpose,
        paymentMethod: 'CASH_PICKUP',
        paymentReference: undefined,
        agreementAccepted: true,
        agreementVersion: CURRENT_AGREEMENT_VERSION
      });

      setIsSubmitting(false);

      if (result.success && result.data) {
        // Confetti effect completely removed per design requirement
        setConfirmedReservation({
          referenceNo: result.data.referenceNo,
          cameraName: result.data.cameraName || camera.name,
          cameraModel: camera.model,
          startDate: result.data.startDate,
          endDate: result.data.endDate
        });
      } else {
        setErrorMessage(result.message);
        // Refresh availability schedule immediately upon booking conflict
        await loadDatabaseAvailability();
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMessage(err.message || 'Error processing reservation.');
      await loadDatabaseAvailability();
    }
  };

  // If reservation is confirmed, present the clean minimalist white success modal
  if (confirmedReservation) {
    return (
      <ReservationSuccessModal
        isOpen={true}
        onClose={handleClose}
        reservation={confirmedReservation}
        onViewReservations={handleViewReservations}
        onContinueBrowsing={handleContinueBrowsing}
      />
    );
  }

  const canSubmit =
    !!currentUser.id &&
    !!startDate &&
    !!endDate &&
    availability.isAvailable &&
    !availabilityFetchError &&
    agreedToTerms &&
    !isSubmitting &&
    !cameraGloballyUnavailable;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title={
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-zinc-900" />
          <span>Reserve {camera.name}</span>
        </div>
      }
      description="Select your rental schedule, verify payment details, and reserve your camera."
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5 text-xs text-zinc-900">
        {errorMessage && (
          <div className="p-3.5 bg-white border border-zinc-200 rounded-xl text-zinc-800 text-xs flex items-start gap-2.5 shadow-xs">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5 stroke-[2]" />
            <div className="flex-1">
              <span className="font-semibold text-zinc-900 block mb-0.5">Reservation Unsuccessful</span>
              <span className="text-zinc-600 leading-relaxed">{errorMessage}</span>
            </div>
          </div>
        )}

        {/* Camera Summary Card */}
        <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-2xl flex items-center gap-3.5 sm:gap-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-white p-1.5 border border-zinc-200/80 flex items-center justify-center shrink-0 shadow-2xs">
            <img
              src={getCameraImageUrl(camera.id, camera.imageUrl)}
              alt={`${camera.brand} ${camera.name}`}
              className="w-full h-full object-contain"
              loading="lazy"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-sm sm:text-base text-zinc-900 truncate">{camera.name}</h4>
            <p className="text-xs text-zinc-500">
              SN: <span className="font-mono text-zinc-700">{camera.serialNumber}</span> • {camera.category}
            </p>
            <p className="text-xs text-zinc-800 font-semibold mt-0.5">
              {formatPHP(camera.dailyRate)} / day • {formatPHP(camera.securityDeposit)} deposit
            </p>
          </div>
        </div>

        {/* Availability Calendar */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4 text-zinc-700" />
            Rental Period (Dates) &amp; Availability
          </label>

          <AvailabilityCalendar
            cameraUnavailable={cameraGloballyUnavailable}
            cameraUnavailableReason={cameraUnavailableReason}
            bookedRanges={effectiveBookedRanges}
            startDate={startDate}
            endDate={endDate}
            onChange={handleDateChange}
            rangeError={rangeError}
            isLoading={isLoadingAvailability}
            fetchError={availabilityFetchError || undefined}
            onMonthChange={() => loadDatabaseAvailability()}
          />

          {/* Contextual Availability & Selected Rental Period */}
          {startDate && endDate && availability.isAvailable && (
            <div className="space-y-2 p-3.5 bg-white border border-zinc-200 rounded-xl shadow-2xs">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-zinc-900 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  Available for your selected dates
                </span>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200">
                  {totalDays} Day{totalDays !== 1 ? 's' : ''} Rental
                </span>
              </div>
              <div className="p-2.5 bg-zinc-50 rounded-lg border border-zinc-200 text-[11px] flex items-center justify-between">
                <div>
                  <span className="text-zinc-500 block text-[10px]">Rental Schedule</span>
                  <span className="font-semibold text-zinc-900">{formatDate(startDate)} → {formatDate(endDate)}</span>
                </div>
                <div className="text-right">
                  <span className="text-zinc-500 block text-[10px]">Agreed Return</span>
                  <span className="text-zinc-800 font-medium">By 6:00 PM on {formatDate(endDate)}</span>
                </div>
              </div>
            </div>
          )}

          {startDate && endDate && !availability.isAvailable && (
            <div className="p-3.5 bg-white border border-zinc-200 rounded-xl text-xs flex items-start gap-2.5 shadow-2xs">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-semibold text-zinc-900">Dates Unavailable</p>
                <p className="text-zinc-600 text-[11px] leading-relaxed">
                  {availability.reason || 'This camera is unavailable for your selected dates.'}
                </p>
              </div>
            </div>
          )}

          {startDate && !endDate && !cameraGloballyUnavailable && (
            <div className="text-[11px] text-zinc-500 flex items-center gap-1">
              <span>Pickup: <strong>{formatDate(startDate)}</strong></span>
              <span className="text-zinc-300">→</span>
              <span>Now select a return date</span>
            </div>
          )}
        </div>


        {/* Customer Location & ID Verification */}
        {!currentUser.id ? (
          <div className="p-3.5 bg-white border border-zinc-200 rounded-xl space-y-2 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-900 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                Sign In Required to Complete Reservation
              </span>
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200">
                Guest Mode
              </span>
            </div>
            <p className="text-xs text-zinc-600 leading-relaxed">
              You must have a verified customer account with a Butuan City resident profile to reserve digital camera equipment.
            </p>
            <div className="pt-1">
              <a
                href="/login"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-semibold transition"
              >
                <span>Sign In to Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        ) : (
          <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-zinc-600" />
                Customer Verification Details
              </span>
              <span className="text-[11px] text-zinc-500">Butuan Resident Profile</span>
            </div>
            <p className="text-xs text-zinc-800">
              <strong>{currentUser.name}</strong> • {currentUser.phone || 'No phone recorded'}
            </p>
            <p className="text-xs text-zinc-600">
              Address: {currentUser.streetAddress || 'Purok / Street not set'}, Brgy. {currentUser.barangay || 'Libertad'}, {currentUser.city}, {currentUser.province}
            </p>
            <p className="text-[11px] text-zinc-500">
              ID Record: {currentUser.idType || 'Government ID'} ({currentUser.idNumber || 'Pending verification'})
            </p>
          </div>
        )}

        {/* Purpose */}
        <div>
          <label className="block text-xs font-semibold text-zinc-700 mb-1">
            Shooting Purpose / Project Details
          </label>
          <input
            type="text"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="e.g. Wedding coverage in Doongan, school film project at CSU"
            className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-zinc-900 text-xs focus:outline-none focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 transition"
          />
        </div>

        {/* Payment Method Requirement: Cash on Counter Pickup */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-600 flex items-center gap-1.5">
            <CreditCard className="w-4 h-4 text-zinc-700" />
            Payment Settlement (Official Method)
          </label>

          <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-zinc-900 text-white flex items-center justify-center font-bold text-xs">
                  ₱
                </div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-900">Cash on Counter Pickup</h4>
                  <p className="text-[11px] text-zinc-500">Official Settlement Method</p>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                NO ADVANCE PAYMENT
              </span>
            </div>

            <p className="text-xs text-zinc-600 leading-relaxed">
              Rental tariff and security deposit are paid in cash at our <strong>Butuan City Hub (J.C. Aquino Ave)</strong> during equipment inspection and release.
            </p>

            <div className="p-2.5 bg-white rounded-lg border border-zinc-200 text-[11px] text-zinc-500 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-zinc-700 shrink-0 mt-0.5" />
              <span>
                Your reservation is submitted for admin review. Payment status remains <span className="font-semibold text-zinc-700">PENDING</span> until cash is verified and received by the counter administrator at pickup.
              </span>
            </div>
          </div>
        </div>

        {/* Cost Breakdown */}
        <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 space-y-2 text-xs">
          <div className="flex justify-between text-zinc-600">
            <span>Daily Rate ({formatPHP(camera.dailyRate)}{totalDays > 0 ? ` × ${totalDays} day${totalDays > 1 ? 's' : ''}` : ' / day'})</span>
            <span className="text-zinc-900 font-semibold">{totalDays > 0 ? formatPHP(subtotal) : formatPHP(camera.dailyRate)}</span>
          </div>
          <div className="flex justify-between text-zinc-600">
            <span className="flex items-center gap-1 font-medium text-zinc-700">
              <ShieldCheck className="w-3.5 h-3.5 text-zinc-900" /> Refundable Security Deposit
            </span>
            <span className="text-zinc-900 font-semibold">{formatPHP(securityDeposit)}</span>
          </div>
          <div className="pt-2 border-t border-zinc-200 flex justify-between items-baseline text-sm">
            <span className="font-bold text-zinc-900">Total Amount Due</span>
            <span className="text-lg font-bold text-zinc-900">{formatPHP(totalDays > 0 ? totalAmount : camera.dailyRate + securityDeposit)}</span>
          </div>
          <p className="text-[10px] text-zinc-500 pt-1">
            * Security deposit of {formatPHP(securityDeposit)} is 100% refunded upon return inspection in good condition.
          </p>
        </div>

        {/* Customer Rental Agreement Section */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-700 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-zinc-900" />
              Customer Rental Agreement
            </label>
            <span className="text-[10px] font-bold text-zinc-700 bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded">
              Version {CURRENT_AGREEMENT_VERSION}
            </span>
          </div>

          {/* Scrollable Agreement Text Viewer */}
          <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl space-y-3 max-h-48 overflow-y-auto text-xs text-zinc-600 leading-relaxed">
            <div className="pb-2 border-b border-zinc-200">
              <h4 className="font-bold text-zinc-900 text-xs">{CURRENT_AGREEMENT_TITLE}</h4>
              <p className="text-[10px] text-zinc-500">
                Operating Hub: J.C. Aquino Ave, Butuan City, Agusan del Norte, Philippines
              </p>
              <p className="text-[10px] text-zinc-500">
                Lessee: <strong>{currentUser.name || 'Verified Customer'}</strong> (Brgy. {currentUser.barangay || 'Libertad'}, Butuan City) • Camera: <strong>{camera.name}</strong>
              </p>
              {camera.packageIncludes && camera.packageIncludes.length > 0 && (
                <p className="text-[10px] text-zinc-500 mt-0.5">
                  Package includes: {camera.packageIncludes.join(', ')}
                </p>
              )}
            </div>

            {CANONICAL_AGREEMENT_SECTIONS.map(section => (
              <div key={section.id} className="space-y-0.5">
                <h5 className="font-semibold text-zinc-800 text-[11px]">{section.title}</h5>
                <p className="text-[11px] text-zinc-600 leading-normal">{section.content}</p>
              </div>
            ))}
          </div>

          {/* Agreement Checkbox (Initially Unchecked) */}
          <label className="flex items-start gap-2.5 p-3 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 transition cursor-pointer text-xs text-zinc-700 shadow-xs">
            <input
              type="checkbox"
              id="rental-agreement-checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-0.5 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900 cursor-pointer h-4 w-4 shrink-0"
            />
            <span className="leading-snug">
              I have read, understood, and explicitly agree to all terms of the <strong>{CURRENT_AGREEMENT_TITLE} (Version {CURRENT_AGREEMENT_VERSION})</strong>. I confirm my Butuan City residence and agree to present valid Philippine ID at counter checkout.
            </span>
          </label>
        </div>


        {/* Submit button */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 rounded-lg bg-zinc-100 text-zinc-700 hover:bg-zinc-200 text-xs font-semibold transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="px-6 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold shadow-xs transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            <span>{!currentUser.id ? 'Sign In to Reserve' : isSubmitting ? 'Confirming...' : 'Submit Reservation'}</span>
          </button>
        </div>
      </form>
    </Dialog>
  );
};
