'use client';

import React, { useEffect } from 'react';
import { Check, X, Calendar, Camera, Clock, Hash } from 'lucide-react';
import { formatDate } from '../../lib/utils';

export interface ConfirmedReservationData {
  referenceNo: string;
  cameraName: string;
  cameraModel?: string;
  startDate: string;
  endDate: string;
  pickupTime?: string;
  returnTime?: string;
}

interface ReservationSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  reservation: ConfirmedReservationData | null;
  onViewReservations: () => void;
  onContinueBrowsing: () => void;
}

export const ReservationSuccessModal: React.FC<ReservationSuccessModalProps> = ({
  isOpen,
  onClose,
  reservation,
  onViewReservations,
  onContinueBrowsing
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !reservation) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-black/40 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reservation-success-title"
    >
      {/* Subtle neutral backdrop */}
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Centered White Modal Card */}
      <div className="relative w-full max-w-md bg-white border border-zinc-200 rounded-2xl shadow-xl z-10 overflow-hidden text-zinc-900 animate-in zoom-in-95 duration-200 p-6 sm:p-7">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors cursor-pointer"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Small Simple Success Icon: Thin green checkmark inside circular outline */}
        <div className="w-10 h-10 rounded-full border border-emerald-300 bg-white flex items-center justify-center text-emerald-600 mb-4 shadow-2xs">
          <Check className="w-5 h-5 stroke-[2]" />
        </div>

        {/* Heading & Supporting Text */}
        <h3
          id="reservation-success-title"
          className="text-lg font-bold text-zinc-900 tracking-tight"
        >
          Reservation Successful
        </h3>
        <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
          Your camera reservation has been confirmed.
        </p>

        {/* Concise Reservation Summary in a clean white container */}
        <div className="mt-5 p-4 sm:p-4.5 bg-white border border-zinc-200 rounded-xl space-y-3 text-xs shadow-2xs">
          {/* Camera Name & Model */}
          <div className="flex items-start justify-between gap-3 pb-2.5 border-b border-zinc-100">
            <span className="text-zinc-500 flex items-center gap-1.5 shrink-0">
              <Camera className="w-3.5 h-3.5 text-zinc-400" />
              Camera
            </span>
            <span className="font-semibold text-zinc-900 text-right">
              {reservation.cameraName}
              {reservation.cameraModel && reservation.cameraModel !== reservation.cameraName && (
                <span className="text-zinc-500 font-normal ml-1">({reservation.cameraModel})</span>
              )}
            </span>
          </div>

          {/* Pickup Date */}
          <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-zinc-100">
            <span className="text-zinc-500 flex items-center gap-1.5 shrink-0">
              <Calendar className="w-3.5 h-3.5 text-zinc-400" />
              Pickup Date
            </span>
            <span className="font-medium text-zinc-800 text-right">
              {formatDate(reservation.startDate)}{' '}
              <span className="text-zinc-500 text-[11px]">(from 8:00 AM)</span>
            </span>
          </div>

          {/* Return Date & Time */}
          <div className="flex items-center justify-between gap-3 pb-2.5 border-b border-zinc-100">
            <span className="text-zinc-500 flex items-center gap-1.5 shrink-0">
              <Clock className="w-3.5 h-3.5 text-zinc-400" />
              Return Date &amp; Time
            </span>
            <span className="font-medium text-zinc-800 text-right">
              {formatDate(reservation.endDate)}{' '}
              <span className="text-zinc-500 text-[11px]">(by 6:00 PM)</span>
            </span>
          </div>

          {/* Reservation Reference Number */}
          {reservation.referenceNo && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-zinc-500 flex items-center gap-1.5 shrink-0">
                <Hash className="w-3.5 h-3.5 text-zinc-400" />
                Reference No.
              </span>
              <span className="font-mono font-semibold text-zinc-900 text-xs">
                {reservation.referenceNo}
              </span>
            </div>
          )}
        </div>

        {/* Pickup Location Note */}
        <p className="mt-3 text-[11px] text-zinc-400 text-center">
          Pickup Hub: J.C. Aquino Ave, Butuan City • Cash on counter pickup
        </p>

        {/* Actions: Primary and Secondary */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onContinueBrowsing}
            className="w-full sm:w-auto px-4 py-2.5 min-h-[44px] rounded-xl bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 hover:border-zinc-300 text-xs font-medium cursor-pointer transition-colors text-center order-2 sm:order-1"
          >
            Continue Browsing
          </button>
          <button
            type="button"
            onClick={onViewReservations}
            className="w-full sm:w-auto px-5 py-2.5 min-h-[44px] rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 text-xs font-semibold shadow-xs cursor-pointer transition-colors text-center order-1 sm:order-2"
          >
            View My Reservations
          </button>
        </div>
      </div>
    </div>
  );
};
