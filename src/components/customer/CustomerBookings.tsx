'use client';
import React, { useState } from 'react';
import { useSystem } from '../../context/SystemContext';
import { Reservation } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { RentalVoucherModal } from './RentalVoucherModal';
import { RentalAgreementModal } from '../common/RentalAgreementModal';
import { Dialog } from '../common/Dialog';
import { formatPHP, formatDate, getCameraImageUrl } from '../../lib/utils';
import { 
  Calendar, 
  FileText, 
  XCircle, 
  CheckCircle2, 
  Camera, 
  ShieldCheck, 
  Clock, 
  ArrowRight, 
  Package, 
  Sparkles,
  AlertTriangle,
  Loader2,
  X
} from 'lucide-react';
import { useFeedback } from '../../context/FeedbackContext';

export const CustomerBookings: React.FC = () => {
  const { reservations, currentUser, cancelReservation } = useSystem();
  const [selectedVoucher, setSelectedVoucher] = useState<Reservation | null>(null);
  const [selectedAgreement, setSelectedAgreement] = useState<Reservation | null>(null);
  const [cancellingReservation, setCancellingReservation] = useState<Reservation | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const { showSuccess, showError } = useFeedback();

  const showFeedback = (message: string, type: 'success' | 'error' = 'success') => {
    if (type === 'success') {
      showSuccess(message, 'Reservation Update');
    } else {
      showError(message, 'Action Failed');
    }
  };

  // Filter reservations for the active customer (strictly scoped to verified user ID)
  const customerReservations = currentUser.id
    ? reservations.filter(r => r.customerId === currentUser.id)
    : [];

  const filteredList = customerReservations.filter(r => {
    if (filterStatus === 'ALL') return true;
    if (filterStatus === 'ACTIVE') return ['PENDING_APPROVAL', 'APPROVED', 'CHECKED_OUT', 'RETURNED'].includes(r.status);
    if (filterStatus === 'COMPLETED') return r.status === 'COMPLETED';
    if (filterStatus === 'CANCELLED') return ['CANCELLED', 'REJECTED'].includes(r.status);
    return true;
  });

  const handleConfirmCancel = async () => {
    if (!cancellingReservation) return;
    setIsCancelling(true);
    try {
      const res = await cancelReservation(cancellingReservation.id);
      setIsCancelling(false);
      if (res.success) {
        showFeedback(`Reservation ${cancellingReservation.referenceNo} was successfully cancelled.`);
        setCancellingReservation(null);
      } else {
        showFeedback(res.message || 'Unable to cancel reservation.', 'error');
      }
    } catch (err: any) {
      setIsCancelling(false);
      showFeedback(err.message || 'Error occurred while cancelling reservation.', 'error');
    }
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-zinc-700" />
            My Bookings &amp; Rental History
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Track your camera reservations, store approvals, active rentals, and access claim vouchers.
          </p>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center p-1 bg-zinc-100 border border-zinc-200 rounded-lg text-xs self-start sm:self-auto">
          <button
            onClick={() => setFilterStatus('ALL')}
            className={`px-3 py-1.5 rounded-md font-medium transition ${
              filterStatus === 'ALL' ? 'bg-white text-zinc-900 shadow-xs font-semibold' : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            All ({customerReservations.length})
          </button>
          <button
            onClick={() => setFilterStatus('ACTIVE')}
            className={`px-3 py-1.5 rounded-md font-medium transition ${
              filterStatus === 'ACTIVE' ? 'bg-white text-zinc-900 shadow-xs font-semibold' : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            Active / Upcoming
          </button>
          <button
            onClick={() => setFilterStatus('COMPLETED')}
            className={`px-3 py-1.5 rounded-md font-medium transition ${
              filterStatus === 'COMPLETED' ? 'bg-white text-zinc-900 shadow-xs font-semibold' : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            Completed
          </button>
        </div>
      </div>

      {/* Reservation Cards List or Guest State */}
      {!currentUser.id ? (
        <div className="text-center py-16 bg-white rounded-xl border border-zinc-200 p-8 space-y-4">
          <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mx-auto text-zinc-400">
            <Package className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-zinc-900">Sign in to view your bookings</h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              You are currently browsing as a guest. Please sign in to access your camera reservations, approvals, and rental claim slips.
            </p>
          </div>
          <div>
            <a
              href="/login"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg text-xs font-semibold transition shadow-xs"
            >
              <span>Sign In to Account</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-zinc-200 p-8 space-y-3">
          <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mx-auto text-zinc-400">
            <Camera className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-zinc-900">No Bookings Found</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            You don&apos;t have any camera bookings in this view. Browse our digital camera inventory to make a reservation.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredList.map((res) => (
            <div
              key={res.id}
              className="bg-white border border-zinc-200 rounded-xl p-5 hover:border-zinc-300 transition shadow-xs space-y-4"
            >
              {/* Top Row: Ref & Status */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-zinc-100 gap-2">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-semibold text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                    {res.referenceNo}
                  </span>
                  <span className="text-xs text-zinc-500">
                    Booked on {formatDate(res.createdAt)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={res.status} type="rental" />
                </div>
              </div>

              {/* Main Info Body */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                <div className="flex items-center gap-3 md:col-span-2">
                  <div className="w-16 h-16 rounded-xl bg-zinc-50 border border-zinc-200 p-1 flex items-center justify-center shrink-0">
                    <img
                      src={getCameraImageUrl(res.cameraId, res.cameraImageUrl)}
                      alt={res.cameraName}
                      className="w-full h-full object-contain"
                      loading="lazy"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                      {res.cameraBrand} • {res.cameraCategory}
                    </span>
                    <h4 className="text-sm font-semibold text-zinc-900">{res.cameraName}</h4>
                    <p className="text-xs text-zinc-400 font-mono">SN: {res.cameraSerial}</p>
                    {res.purpose && (
                      <p className="text-xs text-zinc-500 italic line-clamp-1 mt-0.5">
                        &quot;{res.purpose}&quot;
                      </p>
                    )}
                  </div>
                </div>

                {/* Schedule */}
                <div className="space-y-1 text-xs">
                  <span className="text-zinc-500 font-medium flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                    Rental Schedule
                  </span>
                  <p className="text-zinc-800 font-medium">
                    {formatDate(res.startDate)} → {formatDate(res.endDate)}
                  </p>
                  <p className="text-zinc-500">
                    {res.totalDays} Day{res.totalDays > 1 ? 's' : ''} ({formatPHP(res.dailyRate)}/day)
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    Return by 6:00 PM on {formatDate(res.endDate)}
                  </p>
                </div>

                {/* Pricing & Deposit */}
                <div className="space-y-1 text-xs md:text-right">
                  <span className="text-zinc-500 font-medium">Total Amount</span>
                  <p className="text-base font-bold text-zinc-900">{formatPHP(res.totalAmount)}</p>
                  <div className="flex md:justify-end items-center gap-1.5 text-zinc-500 text-[11px]">
                    <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
                    Deposit: {formatPHP(res.securityDeposit)} ({res.depositStatus})
                  </div>
                </div>
              </div>

              {/* Prominent Rejection Notice & Reason Display */}
              {res.status === 'REJECTED' && (
                <div className="p-3.5 bg-white border border-zinc-200 rounded-xl text-xs space-y-1.5 animate-in fade-in-50 shadow-xs">
                  <div className="flex items-center gap-2 font-semibold text-zinc-900">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Reservation Not Approved</span>
                  </div>
                  <p className="text-zinc-600 pl-6 leading-relaxed">
                    <strong className="text-zinc-800">Reason from store:</strong> {res.rejectionReason || 'Equipment schedule conflict or resident verification issue.'}
                  </p>
                  <p className="text-[11px] text-zinc-500 pl-6">
                    No payment was charged. You may browse our catalog to select alternative rental dates or another camera model.
                  </p>
                </div>
              )}

              {/* Workflow Stepper Indicator */}
              <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-100 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                  <div className={`flex items-center gap-1 ${res.status !== 'REJECTED' && res.status !== 'CANCELLED' ? 'text-zinc-900 font-medium' : 'text-zinc-400'}`}>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>1. Reserved</span>
                  </div>
                  <ArrowRight className="w-3 h-3 text-zinc-300 hidden sm:inline" />

                  <div className={`flex items-center gap-1 ${['APPROVED', 'CHECKED_OUT', 'RETURNED', 'COMPLETED'].includes(res.status) ? 'text-zinc-900 font-medium' : res.status === 'PENDING_APPROVAL' ? 'text-amber-700 font-semibold' : 'text-zinc-400'}`}>
                    <Clock className={`w-3.5 h-3.5 ${res.status === 'PENDING_APPROVAL' ? 'text-amber-600 animate-pulse' : ['APPROVED', 'CHECKED_OUT', 'RETURNED', 'COMPLETED'].includes(res.status) ? 'text-blue-600' : 'text-zinc-400'}`} />
                    <span>2. Store Approval</span>
                  </div>
                  <ArrowRight className="w-3 h-3 text-zinc-300 hidden sm:inline" />

                  <div className={`flex items-center gap-1 ${['CHECKED_OUT', 'RETURNED', 'COMPLETED'].includes(res.status) ? 'text-zinc-900 font-medium' : 'text-zinc-400'}`}>
                    <Camera className={`w-3.5 h-3.5 ${['CHECKED_OUT', 'RETURNED', 'COMPLETED'].includes(res.status) ? 'text-indigo-600' : 'text-zinc-400'}`} />
                    <span>3. In Field</span>
                  </div>
                  <ArrowRight className="w-3 h-3 text-zinc-300 hidden sm:inline" />

                  <div className={`flex items-center gap-1 ${['RETURNED', 'COMPLETED'].includes(res.status) ? 'text-zinc-900 font-medium' : 'text-zinc-400'}`}>
                    <CheckCircle2 className={`w-3.5 h-3.5 ${['RETURNED', 'COMPLETED'].includes(res.status) ? 'text-teal-600' : 'text-zinc-400'}`} />
                    <span>4. Inspected &amp; Returned</span>
                  </div>
                  <ArrowRight className="w-3 h-3 text-zinc-300 hidden sm:inline" />

                  <div className={`flex items-center gap-1 ${res.status === 'COMPLETED' ? 'text-zinc-900 font-bold' : 'text-zinc-400'}`}>
                    <Sparkles className={`w-3.5 h-3.5 ${res.status === 'COMPLETED' ? 'text-emerald-600' : 'text-zinc-400'}`} />
                    <span>5. Completed</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-1">
                <div className="text-xs text-zinc-500">
                  {res.returnNotes && (
                    <span className="text-emerald-600">Return note: {res.returnNotes}</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {res.status === 'PENDING_APPROVAL' && (
                    <button
                      onClick={() => setCancellingReservation(res)}
                      className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-medium transition flex items-center gap-1 cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Cancel</span>
                    </button>
                  )}

                  <button
                    onClick={() => setSelectedAgreement(res)}
                    className="px-3 py-1.5 rounded-lg border border-zinc-200 text-zinc-700 hover:bg-zinc-100 text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-zinc-500" />
                    <span>Agreement ({res.agreementVersion || 'v1.0'})</span>
                  </button>

                  <button
                    onClick={() => setSelectedVoucher(res)}
                    className="px-3.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Claim Voucher</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Dialog for Customer Cancellation */}
      {cancellingReservation && (
        <Dialog
          isOpen={!!cancellingReservation}
          onClose={() => !isCancelling && setCancellingReservation(null)}
          title="Cancel Reservation"
          description={`Are you sure you want to cancel booking ${cancellingReservation.referenceNo}?`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs text-zinc-700">
            <p>
              This will release your reserved dates for <strong>{cancellingReservation.cameraName}</strong> ({formatDate(cancellingReservation.startDate)} to {formatDate(cancellingReservation.endDate)}).
            </p>
            <p className="text-zinc-500">
              Since payment is cash on counter pickup, no charges have been deducted.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
              <button
                type="button"
                disabled={isCancelling}
                onClick={() => setCancellingReservation(null)}
                className="px-3.5 py-1.5 rounded-lg bg-zinc-100 text-zinc-700 hover:bg-zinc-200 text-xs font-medium cursor-pointer disabled:opacity-50"
              >
                Keep Booking
              </button>
              <button
                type="button"
                disabled={isCancelling}
                onClick={handleConfirmCancel}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isCancelling ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Cancelling...</span>
                  </>
                ) : (
                  <span>Yes, Cancel Reservation</span>
                )}
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Voucher Modal */}
      <RentalVoucherModal
        reservation={selectedVoucher}
        isOpen={!!selectedVoucher}
        onClose={() => setSelectedVoucher(null)}
      />

      {/* Rental Agreement Modal */}
      <RentalAgreementModal
        reservation={selectedAgreement}
        isOpen={!!selectedAgreement}
        onClose={() => setSelectedAgreement(null)}
      />
    </div>
  );
};
