'use client';
import React, { useState, useMemo } from 'react';
import { useSystem } from '../../context/SystemContext';
import { Reservation } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { ConditionBadge } from '../common/ConditionBadge';
import { CheckoutModal } from './CheckoutModal';
import { ReturnInspectionModal } from './ReturnInspectionModal';
import { RentalVoucherModal } from '../customer/RentalVoucherModal';
import { formatPHP, formatDate, getCameraImageUrl } from '../../lib/utils';
import { 
  SlidersHorizontal, 
  Search, 
  Camera, 
  CheckCircle2, 
  Clock, 
  RotateCcw, 
  FileText, 
  AlertCircle, 
  Check, 
  X, 
  Sparkles,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { useFeedback } from '../../context/FeedbackContext';

export const CounterQueue: React.FC = () => {
  const { 
    reservations, 
    cameras, 
    approveReservation, 
    rejectReservation 
  } = useSystem();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCheckout, setSelectedCheckout] = useState<Reservation | null>(null);
  const [selectedReturn, setSelectedReturn] = useState<Reservation | null>(null);
  const [selectedVoucher, setSelectedVoucher] = useState<Reservation | null>(null);
  const [rejectPromptId, setRejectPromptId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('Customer ID or schedule conflict.');
  const { showSuccess, showError } = useFeedback();
  const [processingId, setProcessingId] = useState<string | null>(null);

  const showAlert = (message: string, type: 'success' | 'error' = 'success') => {
    if (type === 'success') {
      showSuccess(message);
    } else {
      showError(message);
    }
  };

  // Helpers
  const isCameraCheckedOut = (cameraId: string) => cameras.find(c => c.id === cameraId)?.status === 'CHECKED_OUT';
  const isReservationActiveRental = (r: Reservation) => r.status === 'CHECKED_OUT' || (r.status === 'APPROVED' && isCameraCheckedOut(r.cameraId));

  // Metrics
  const pendingCount = reservations.filter(r => r.status === 'PENDING_APPROVAL').length;
  const readyPickupCount = reservations.filter(r => r.status === 'APPROVED' && !isCameraCheckedOut(r.cameraId)).length;
  const activeRentalsCount = reservations.filter(r => isReservationActiveRental(r)).length;
  const maintenanceCount = cameras.filter(c => c.status === 'MAINTENANCE' || c.status === 'DAMAGED').length;

  // Filtered reservations
  const filteredReservations = useMemo(() => {
    return reservations.filter(r => 
      r.referenceNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.cameraName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.cameraSerial.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.customerBarangay.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [reservations, searchQuery]);

  const approvedList = filteredReservations.filter(r => r.status === 'APPROVED' && !isCameraCheckedOut(r.cameraId));
  const checkedOutList = filteredReservations.filter(r => isReservationActiveRental(r));
  const pendingList = filteredReservations.filter(r => r.status === 'PENDING_APPROVAL');
  const completedList = filteredReservations.filter(r => r.status === 'COMPLETED');

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900 flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-zinc-700" />
            Counter &amp; Equipment Operations
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Customer verification, camera checkout checklist, return inspections, and deposit settlement.
          </p>
        </div>
      </div>

      {/* Metric Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-zinc-200 rounded-xl space-y-1 shadow-xs">
          <span className="text-xs text-zinc-500 flex items-center gap-1.5 font-medium">
            <Clock className="w-4 h-4 text-zinc-400" /> Ready for Checkout
          </span>
          <p className="text-2xl font-bold text-zinc-900">{readyPickupCount}</p>
          <span className="text-[11px] text-zinc-400">Approved for in-store pickup</span>
        </div>

        <div className="p-4 bg-white border border-zinc-200 rounded-xl space-y-1 shadow-xs">
          <span className="text-xs text-zinc-500 flex items-center gap-1.5 font-medium">
            <Camera className="w-4 h-4 text-zinc-400" /> Active Rentals
          </span>
          <p className="text-2xl font-bold text-zinc-900">{activeRentalsCount}</p>
          <span className="text-[11px] text-zinc-400">In-field awaiting return</span>
        </div>

        <div className="p-4 bg-white border border-zinc-200 rounded-xl space-y-1 shadow-xs">
          <span className="text-xs text-zinc-500 flex items-center gap-1.5 font-medium">
            <AlertCircle className="w-4 h-4 text-zinc-400" /> Pending Bookings
          </span>
          <p className="text-2xl font-bold text-zinc-900">{pendingCount}</p>
          <span className="text-[11px] text-zinc-400">Needs admin approval</span>
        </div>

        <div className="p-4 bg-white border border-zinc-200 rounded-xl space-y-1 shadow-xs">
          <span className="text-xs text-zinc-500 flex items-center gap-1.5 font-medium">
            <RotateCcw className="w-4 h-4 text-zinc-400" /> Maintenance Units
          </span>
          <p className="text-2xl font-bold text-zinc-900">{maintenanceCount}</p>
          <span className="text-[11px] text-zinc-400">Under calibration / service</span>
        </div>
      </div>

      {/* Global Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search records by reference, customer name, barangay, or camera serial..."
          className="w-full bg-white border border-zinc-200 rounded-xl pl-10 pr-4 py-2.5 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition shadow-xs"
        />
      </div>

      {/* SECTION 1: Ready for Physical Checkout */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-600" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-700">
              1. Approved Bookings — Ready for Checkout ({approvedList.length})
            </h3>
          </div>
          <span className="text-[11px] text-zinc-400">ID &amp; serial checklist verification</span>
        </div>

        {approvedList.length === 0 ? (
          <div className="p-8 bg-white border border-zinc-200 rounded-xl text-center text-zinc-400 text-xs">
            No approved reservations awaiting counter checkout.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {approvedList.map((res) => (
              <div
                key={res.id}
                className="p-5 bg-white border border-zinc-200 hover:border-zinc-300 rounded-xl space-y-4 transition shadow-xs flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                      {res.referenceNo}
                    </span>
                    <StatusBadge status={res.status} />
                  </div>

                  <div className="flex gap-3">
                    <div className="w-14 h-14 rounded-lg bg-white border border-zinc-200 shrink-0 p-1 flex items-center justify-center shadow-2xs">
                      <img
                        src={getCameraImageUrl(res.cameraId, res.cameraImageUrl)}
                        alt={res.cameraName}
                        className="w-full h-full object-contain"
                        loading="lazy"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-zinc-900 text-xs truncate">{res.cameraName}</h4>
                      <p className="text-[11px] text-zinc-500 font-mono">SN: <span className="text-zinc-800 font-medium">{res.cameraSerial}</span></p>
                      <p className="text-[11px] text-zinc-700 mt-0.5">
                        Customer: <strong className="font-semibold text-zinc-900">{res.customerName}</strong>
                      </p>
                      <p className="text-[10px] text-zinc-400">{res.customerPhone} • Brgy. {res.customerBarangay}</p>
                    </div>
                  </div>

                  <div className="p-2.5 bg-zinc-50 rounded-lg border border-zinc-200 grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-zinc-500 block text-[10px]">Rental Period</span>
                      <span className="text-zinc-800 font-medium">{formatDate(res.startDate)} – {formatDate(res.endDate)}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 block text-[10px]">Deposit &amp; Payment</span>
                      <span className="text-zinc-900 font-bold">{formatPHP(res.totalAmount)}</span>
                      <span className="text-zinc-500 text-[10px] ml-1">({res.paymentStatus})</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-zinc-100">
                  <button
                    onClick={() => setSelectedVoucher(res)}
                    className="flex-1 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Voucher</span>
                  </button>

                  <button
                    onClick={() => setSelectedCheckout(res)}
                    className="flex-1 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Start Checkout</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 2: Active Rentals in Field (Return Inspection Desk) */}
      <div className="space-y-3 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-indigo-600" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-700">
              2. Active Field Rentals — Return &amp; Inspection ({checkedOutList.length})
            </h3>
          </div>
          <span className="text-[11px] text-zinc-400">Inspect condition &amp; settle deposit</span>
        </div>

        {checkedOutList.length === 0 ? (
          <div className="p-8 bg-white border border-zinc-200 rounded-xl text-center text-zinc-400 text-xs">
            No active cameras in the field awaiting return right now.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {checkedOutList.map((res) => (
              <div
                key={res.id}
                className="p-5 bg-white border border-zinc-200 hover:border-zinc-300 rounded-xl space-y-4 transition shadow-xs flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                      {res.referenceNo}
                    </span>
                    <StatusBadge status={res.status} />
                  </div>

                  <div className="flex gap-3">
                    <div className="w-14 h-14 rounded-lg bg-white border border-zinc-200 shrink-0 p-1 flex items-center justify-center shadow-2xs">
                      <img
                        src={getCameraImageUrl(res.cameraId, res.cameraImageUrl)}
                        alt={res.cameraName}
                        className="w-full h-full object-contain"
                        loading="lazy"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-zinc-900 text-xs truncate">{res.cameraName}</h4>
                      <p className="text-[11px] text-zinc-500 font-mono">SN: <span className="text-zinc-800 font-medium">{res.cameraSerial}</span></p>
                      <p className="text-[11px] text-zinc-700 mt-0.5">
                        Renter: <strong className="font-semibold text-zinc-900">{res.customerName}</strong>
                      </p>
                      <p className="text-[10px] text-zinc-400">{res.customerPhone}</p>
                    </div>
                  </div>

                  <div className="p-2.5 bg-zinc-50 rounded-lg border border-zinc-200 space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Return Due:</span>
                      <span className="text-zinc-900 font-semibold">{formatDate(res.endDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Handover Grade:</span>
                      <ConditionBadge condition={res.checkoutCondition || 'Good'} showIcon={false} />
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Held Deposit:</span>
                      <span className="text-zinc-900 font-bold">{formatPHP(res.securityDeposit)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-zinc-100">
                  <button
                    onClick={() => setSelectedVoucher(res)}
                    className="py-2 px-3 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-medium transition cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => setSelectedReturn(res)}
                    className="flex-1 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Process Return &amp; Inspect</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 3: Pending Booking Approvals */}
      <div className="space-y-3 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-700">
              3. Incoming Customer Bookings — Pending Decision ({pendingList.length})
            </h3>
          </div>
          <span className="text-[11px] text-zinc-400">Review date overlaps &amp; credentials</span>
        </div>

        {pendingList.length === 0 ? (
          <div className="p-8 bg-white border border-zinc-200 rounded-xl text-center text-zinc-400 text-xs">
            No incoming customer bookings awaiting decision.
          </div>
        ) : (
          <div className="space-y-3">
            {pendingList.map((res) => (
              <div
                key={res.id}
                className="p-4 bg-white border border-zinc-200 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs"
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-12 h-12 rounded-lg bg-white border border-zinc-200 shrink-0 p-1 flex items-center justify-center shadow-2xs">
                    <img
                      src={getCameraImageUrl(res.cameraId, res.cameraImageUrl)}
                      alt={res.cameraName}
                      className="w-full h-full object-contain"
                      loading="lazy"
                    />
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                        {res.referenceNo}
                      </span>
                      <h4 className="font-semibold text-zinc-900 text-xs truncate">{res.cameraName}</h4>
                    </div>
                    <p className="text-xs text-zinc-700">
                      Customer: <strong className="font-semibold text-zinc-900">{res.customerName}</strong> ({res.customerPhone} • Brgy. {res.customerBarangay})
                    </p>
                    <p className="text-xs text-zinc-500">
                      Dates: <strong className="font-medium text-zinc-800">{formatDate(res.startDate)} to {formatDate(res.endDate)}</strong> ({res.totalDays} days) • Total: <strong className="text-zinc-900 font-bold">{formatPHP(res.totalAmount)}</strong>
                    </p>
                    {res.purpose && (
                      <p className="text-[11px] text-zinc-400 italic">&quot;{res.purpose}&quot;</p>
                    )}
                  </div>
                </div>

                {/* Approve/Reject Controls */}
                <div className="flex items-center gap-2 shrink-0">
                  {rejectPromptId === res.id ? (
                    <div className="flex items-center gap-2 bg-zinc-50 p-2 rounded-lg border border-rose-300">
                      <input
                        type="text"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Rejection reason..."
                        className="bg-white text-zinc-900 text-xs px-2 py-1 rounded border border-zinc-300"
                      />
                      <button
                        type="button"
                        disabled={processingId === res.id}
                        onClick={async () => {
                          if (!rejectReason.trim()) {
                            showAlert('Please provide a rejection reason.', 'error');
                            return;
                          }
                          setProcessingId(res.id);
                          try {
                            const r = await rejectReservation(res.id, rejectReason.trim());
                            setProcessingId(null);
                            if (r.success) {
                              showAlert(`Rejected reservation ${res.referenceNo}`);
                              setRejectPromptId(null);
                            } else {
                              showAlert(`Failed to reject ${res.referenceNo}: ${r.message}`, 'error');
                            }
                          } catch (err: any) {
                            setProcessingId(null);
                            showAlert(`Error rejecting: ${err.message}`, 'error');
                          }
                        }}
                        className="px-2.5 py-1 bg-rose-600 text-white text-xs font-medium rounded hover:bg-rose-500 cursor-pointer disabled:opacity-50 flex items-center gap-1"
                      >
                        {processingId === res.id ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>...</span>
                          </>
                        ) : (
                          <span>Confirm</span>
                        )}
                      </button>
                      <button
                        type="button"
                        disabled={processingId === res.id}
                        onClick={() => setRejectPromptId(null)}
                        className="text-zinc-400 hover:text-zinc-700 text-xs cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={processingId === res.id}
                        onClick={() => {
                          setRejectPromptId(res.id);
                          setRejectReason('Customer ID or schedule conflict.');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-white hover:bg-rose-50 hover:text-rose-700 text-zinc-600 text-xs font-medium border border-zinc-200 flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                      <button
                        type="button"
                        disabled={processingId === res.id}
                        onClick={async () => {
                          setProcessingId(res.id);
                          try {
                            const r = await approveReservation(res.id);
                            setProcessingId(null);
                            if (r.success) showAlert(`Approved reservation ${res.referenceNo}`);
                            else showAlert(`Failed to approve: ${r.message}`, 'error');
                          } catch (err: any) {
                            setProcessingId(null);
                            showAlert(`Error approving: ${err.message}`, 'error');
                          }
                        }}
                        className="px-3.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-medium flex items-center gap-1.5 transition shadow-xs cursor-pointer disabled:opacity-50"
                      >
                        {processingId === res.id ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Approving...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            <span>Approve</span>
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 4: Completed Rental History Overview */}
      <div className="space-y-3 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-600" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-700">
              4. Recent Completed Rentals ({completedList.length})
            </h3>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
            <thead className="bg-zinc-50 text-zinc-500 uppercase font-semibold text-[10px] tracking-wider border-b border-zinc-200">
              <tr>
                <th className="p-3">Ref Code</th>
                <th className="p-3">Customer</th>
                <th className="p-3">Camera Asset</th>
                <th className="p-3">Return Grade</th>
                <th className="p-3">Deposit Settlement</th>
                <th className="p-3">Admin Notes</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-700">
              {completedList.slice(0, 5).map((res) => (
                <tr key={res.id} className="hover:bg-zinc-50/70 transition">
                  <td className="p-3 font-mono font-medium text-zinc-900">{res.referenceNo}</td>
                  <td className="p-3">
                    <div className="font-semibold text-zinc-900">{res.customerName}</div>
                    <div className="text-[10px] text-zinc-400">{res.customerPhone}</div>
                  </td>
                  <td className="p-3">
                    <div className="text-zinc-900 font-medium">{res.cameraName}</div>
                    <div className="font-mono text-[10px] text-zinc-400">{res.cameraSerial}</div>
                  </td>
                  <td className="p-3">
                    <ConditionBadge condition={res.returnCondition || 'Good'} showIcon={false} />
                  </td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-200 font-medium text-[11px]">
                      {res.depositStatus}
                    </span>
                    {res.depositDeduction ? (
                      <div className="text-[10px] text-rose-600 mt-0.5">Deducted: -{formatPHP(res.depositDeduction)}</div>
                    ) : null}
                  </td>
                  <td className="p-3 max-w-xs truncate text-zinc-500">
                    {res.returnNotes || 'Completed standard inspection.'}
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => setSelectedVoucher(res)}
                      className="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900 inline-flex items-center gap-1 font-medium cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Voucher</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <CheckoutModal
        reservation={selectedCheckout}
        isOpen={!!selectedCheckout}
        onClose={() => setSelectedCheckout(null)}
        onSuccess={() => showAlert(`Checkout complete for ${selectedCheckout?.referenceNo}`)}
      />

      <ReturnInspectionModal
        reservation={selectedReturn}
        isOpen={!!selectedReturn}
        onClose={() => setSelectedReturn(null)}
        onSuccess={() => showAlert(`Return finalized for ${selectedReturn?.referenceNo}`)}
      />

      <RentalVoucherModal
        reservation={selectedVoucher}
        isOpen={!!selectedVoucher}
        onClose={() => setSelectedVoucher(null)}
      />
    </div>
  );
};
