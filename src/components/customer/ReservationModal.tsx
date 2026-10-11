'use client';
import React, { useState, useMemo } from 'react';
import { DigitalCamera, PaymentMethod } from '../../types';
import { useSystem } from '../../context/SystemContext';
import { Dialog } from '../common/Dialog';
import { formatPHP, formatDate, calculateRentalDays, getCameraImageUrl } from '../../lib/utils';
import { checkCameraAvailability, getBookedDateRanges } from '../../lib/availabilityEngine';
import { AvailabilityCalendar } from './AvailabilityCalendar';
import confetti from 'canvas-confetti';
import {
  CalendarDays,
  ShieldCheck,
  CreditCard,
  MapPin,
  AlertCircle,
  CheckCircle2,
  Camera,
  QrCode,
  Sparkles,
  ArrowRight
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
  const [agreedToTerms, setAgreedToTerms] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Booked ranges for this camera (used by the calendar)
  const bookedRanges = useMemo(() => {
    if (!camera) return [];
    return getBookedDateRanges(camera.id, reservations);
  }, [camera, reservations]);

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
    return checkCameraAvailability(camera, startDate, endDate, reservations);
  }, [camera, startDate, endDate, reservations]);

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
      // Validate immediately
      const check = checkCameraAvailability(camera, newStart, newEnd, reservations);
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

    if (paymentMethod === 'GCASH' && !paymentReference.trim()) {
      setErrorMessage('Please provide your GCash Reference Number or transaction ID.');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await createReservation({
        cameraId: camera.id,
        startDate,
        endDate,
        purpose,
        paymentMethod,
        paymentReference: paymentMethod === 'GCASH' ? paymentReference : undefined
      });

      setIsSubmitting(false);

      if (result.success && result.data) {
        try {
          confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
        } catch { /* confetti fallback */ }

        onSuccess(result.data.referenceNo);
        onClose();
      } else {
        setErrorMessage(result.message);
      }
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMessage(err.message || 'Error processing reservation.');
    }
  };

  const canSubmit =
    !!startDate &&
    !!endDate &&
    availability.isAvailable &&
    agreedToTerms &&
    !isSubmitting &&
    !cameraGloballyUnavailable;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
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
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMessage}</span>
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
            bookedRanges={bookedRanges}
            startDate={startDate}
            endDate={endDate}
            onChange={handleDateChange}
            rangeError={rangeError}
          />

          {/* Selected date range summary */}
          {startDate && endDate && availability.isAvailable && (
            <div className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>{formatDate(startDate)}</strong>
                <ArrowRight className="w-3 h-3 inline mx-1" />
                <strong>{formatDate(endDate)}</strong>
                {' '}— <strong>{totalDays} day{totalDays !== 1 ? 's' : ''}</strong> rental
              </span>
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
        <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-xl space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-700 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-zinc-600" />
              Customer Verification Details
            </span>
            <span className="text-[11px] text-zinc-500">Butuan Resident Profile</span>
          </div>
          <p className="text-xs text-zinc-800">
            <strong>{currentUser.name}</strong> • {currentUser.phone}
          </p>
          <p className="text-xs text-zinc-600">
            Address: {currentUser.streetAddress}, Brgy. {currentUser.barangay}, {currentUser.city}, {currentUser.province}
          </p>
          <p className="text-[11px] text-zinc-500">
            ID Record: {currentUser.idType} ({currentUser.idNumber})
          </p>
        </div>

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

        {/* Terms checkbox */}
        <label className="flex items-start gap-2 cursor-pointer text-xs text-zinc-600">
          <input
            type="checkbox"
            checked={agreedToTerms}
            onChange={(e) => setAgreedToTerms(e.target.checked)}
            className="mt-0.5 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
          />
          <span>
            I agree to present a valid Philippine ID and complete the physical inspection at IDIO Hub (J.C. Aquino Ave, Butuan City) during checkout.
          </span>
        </label>

        {/* Submit button */}
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-zinc-100 text-zinc-700 hover:bg-zinc-200 text-xs font-semibold transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="px-6 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold shadow-xs transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isSubmitting ? 'Confirming...' : 'Submit Reservation'}</span>
          </button>
        </div>
      </form>
    </Dialog>
  );
};
