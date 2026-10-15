'use client';

import React, { useState, useMemo } from 'react';
import { useSystem } from '../../context/SystemContext';
import { Reservation } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { RentalVoucherModal } from '../customer/RentalVoucherModal';
import { RentalAgreementModal } from '../common/RentalAgreementModal';
import { ReservationCalendarView } from './ReservationCalendarView';
import { Dialog } from '../common/Dialog';
import { formatPHP, formatDate, getCameraImageUrl } from '../../lib/utils';
import {
  FileSpreadsheet,
  Search,
  Check,
  X,
  FileText,
  FileCheck,
  Calendar,
  List,
  Eye,
  Ban,
  Clock,
  Sparkles,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { useFeedback } from '../../context/FeedbackContext';

export const ReservationMaster: React.FC = () => {
  const {
    reservations,
    approveReservation,
    rejectReservation,
    cancelReservation
  } = useSystem();

  const [activeSubTab, setActiveSubTab] = useState<'LIST' | 'CALENDAR'>('LIST');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [paymentFilter, setPaymentFilter] = useState<string>('ALL');

  const [selectedVoucher, setSelectedVoucher] = useState<Reservation | null>(null);
  const [viewingReservation, setViewingReservation] = useState<Reservation | null>(null);
  const [agreementModalReservation, setAgreementModalReservation] = useState<Reservation | null>(null);
  const [rejectPromptId, setRejectPromptId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('Equipment schedule conflict or ID verification requirement.');
  const { showSuccess, showError } = useFeedback();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [cancellingReservation, setCancellingReservation] = useState<Reservation | null>(null);

  const showFeedback = (message: string, type: 'success' | 'error' = 'success') => {
    if (type === 'success') {
      showSuccess(message, 'Reservation Update');
    } else {
      showError(message, 'Action Failed');
    }
  };

  const filteredReservations = useMemo(() => {
    return reservations.filter(r => {
      const matchesSearch =
        r.referenceNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.cameraName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.customerBarangay.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.cameraSerial.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === 'ALL' || r.status === statusFilter;
      const matchesPayment = paymentFilter === 'ALL' || r.paymentStatus === paymentFilter;

      return matchesSearch && matchesStatus && matchesPayment;
    });
  }, [reservations, searchQuery, statusFilter, paymentFilter]);

  const handleApprove = async (id: string, refNo: string) => {
    if (processingId) return;
    setProcessingId(id);
    try {
      const res = await approveReservation(id);
      setProcessingId(null);
      if (res.success) {
        showFeedback(`Approved reservation ${refNo} for customer pickup.`, 'success');
      } else {
        showFeedback(`Cannot approve ${refNo}: ${res.message}`, 'error');
      }
    } catch (err: any) {
      setProcessingId(null);
      showFeedback(`Error approving ${refNo}: ${err.message}`, 'error');
    }
  };

  const handleReject = async (id: string, refNo: string) => {
    if (processingId) return;
    if (!rejectReason.trim()) {
      showFeedback('Please provide a rejection reason.', 'error');
      return;
    }
    setProcessingId(id);
    try {
      const res = await rejectReservation(id, rejectReason.trim());
      setProcessingId(null);
      if (res.success) {
        showFeedback(`Rejected reservation ${refNo}. Saved reason for customer.`, 'success');
        setRejectPromptId(null);
      } else {
        showFeedback(`Failed to reject ${refNo}: ${res.message}`, 'error');
      }
    } catch (err: any) {
      setProcessingId(null);
      showFeedback(`Error rejecting ${refNo}: ${err.message}`, 'error');
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancellingReservation || processingId) return;
    setProcessingId(cancellingReservation.id);
    try {
      const res = await cancelReservation(cancellingReservation.id);
      setProcessingId(null);
      if (res.success) {
        showFeedback(`Cancelled reservation ${cancellingReservation.referenceNo}.`, 'success');
        setCancellingReservation(null);
      } else {
        showFeedback(`Failed to cancel ${cancellingReservation.referenceNo}: ${res.message}`, 'error');
      }
    } catch (err: any) {
      setProcessingId(null);
      showFeedback(`Error cancelling: ${err.message}`, 'error');
    }
  };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-zinc-800" />
            Reservation Management Ledger
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Audit customer booking requests, schedule approvals, cancellation requests, and date conflict safeguards.
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-lg border border-zinc-200 self-start sm:self-auto">
          <button
            onClick={() => setActiveSubTab('LIST')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
              activeSubTab === 'LIST'
                ? 'bg-white text-zinc-900 shadow-xs'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>List View</span>
          </button>
          <button
            onClick={() => setActiveSubTab('CALENDAR')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
              activeSubTab === 'CALENDAR'
                ? 'bg-white text-zinc-900 shadow-xs'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Calendar Grid</span>
          </button>
        </div>
      </div>

      {activeSubTab === 'CALENDAR' ? (
        <ReservationCalendarView onSelectReservation={res => setViewingReservation(res)} />
      ) : (
        <>
          {/* Filter and Search Bar */}
          <div className="p-3.5 bg-white border border-zinc-200 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by reference, customer name, barangay, camera, serial..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-lg pl-9 pr-3 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 focus:outline-none focus:border-zinc-900"
              >
                <option value="ALL">All Statuses</option>
                <option value="PENDING_APPROVAL">Pending Approval</option>
                <option value="APPROVED">Approved (Ready for Pickup)</option>
                <option value="CHECKED_OUT">Checked Out (Active)</option>
                <option value="COMPLETED">Completed</option>
                <option value="REJECTED">Rejected</option>
                <option value="CANCELLED">Cancelled</option>
              </select>

              <select
                value={paymentFilter}
                onChange={e => setPaymentFilter(e.target.value)}
                className="bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 focus:outline-none focus:border-zinc-900"
              >
                <option value="ALL">All Payments</option>
                <option value="PAID">Paid</option>
                <option value="PENDING">Pending</option>
                <option value="REFUNDED">Refunded</option>
              </select>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-zinc-50 text-zinc-500 uppercase font-bold text-[10px] tracking-wider border-b border-zinc-200">
                  <tr>
                    <th className="p-3.5">Reference &amp; Date</th>
                    <th className="p-3.5">Customer</th>
                    <th className="p-3.5">Camera Asset</th>
                    <th className="p-3.5">Rental Period</th>
                    <th className="p-3.5">Tariff &amp; Deposit</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5">Payment</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 text-zinc-700">
                  {filteredReservations.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-zinc-400">
                        No reservation records matching your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredReservations.map(res => (
                      <tr key={res.id} className="hover:bg-zinc-50/70 transition">
                        <td className="p-3.5">
                          <p className="font-mono font-bold text-zinc-900 text-xs">{res.referenceNo}</p>
                          <p className="text-[11px] text-zinc-400">{formatDate(res.createdAt)}</p>
                        </td>
                        <td className="p-3.5">
                          <p className="font-semibold text-zinc-900">{res.customerName}</p>
                          <p className="text-[11px] text-zinc-500">Brgy. {res.customerBarangay}</p>
                          <p className="text-[10px] text-zinc-400">{res.customerPhone}</p>
                        </td>
                        <td className="p-3.5">
                          <p className="font-semibold text-zinc-900">{res.cameraName}</p>
                          <p className="text-[11px] font-mono text-zinc-500">SN: {res.cameraSerial}</p>
                        </td>
                        <td className="p-3.5">
                          <p className="text-zinc-800 font-medium">
                            {formatDate(res.startDate)} → {formatDate(res.endDate)}
                          </p>
                          <p className="text-[11px] text-zinc-500">
                            {res.totalDays} days ({formatPHP(res.dailyRate)}/day)
                          </p>
                        </td>
                        <td className="p-3.5">
                          <p className="font-bold text-zinc-900">{formatPHP(res.totalAmount)}</p>
                          <p className="text-[10px] text-zinc-400">
                            Sub: {formatPHP(res.subtotal)} • Dep: {formatPHP(res.securityDeposit)}
                          </p>
                        </td>
                        <td className="p-3.5">
                          <StatusBadge status={res.status} type="rental" size="sm" />
                          {res.rejectionReason && (
                            <span className="block text-[10px] text-rose-600 mt-0.5 max-w-[120px] truncate" title={res.rejectionReason}>
                              {res.rejectionReason}
                            </span>
                          )}
                        </td>
                        <td className="p-3.5">
                          <StatusBadge status={res.paymentStatus} type="payment" size="sm" />
                          <p className="text-[10px] text-zinc-400 mt-0.5">
                            {res.paymentMethod === 'GCASH'
                              ? `GCash (${res.paymentReference || 'Paid'})`
                              : res.paymentMethod === 'MAYA'
                              ? `Maya (${res.paymentReference || 'Paid'})`
                              : 'Cash Pickup'}
                          </p>
                        </td>
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Approve / Reject Controls */}
                            {res.status === 'PENDING_APPROVAL' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleApprove(res.id, res.referenceNo)}
                                  disabled={processingId === res.id}
                                  className="p-1.5 rounded-md hover:bg-emerald-50 text-zinc-400 hover:text-emerald-700 transition cursor-pointer disabled:opacity-50"
                                  title="Approve Reservation"
                                >
                                  {processingId === res.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                                  ) : (
                                    <Check className="w-4 h-4" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRejectPromptId(res.id);
                                    setRejectReason('Equipment schedule conflict or ID verification requirement.');
                                  }}
                                  disabled={processingId === res.id}
                                  className="p-1.5 rounded-md hover:bg-rose-50 text-zinc-400 hover:text-rose-600 transition cursor-pointer disabled:opacity-50"
                                  title="Reject Reservation"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </>
                            )}

                            {/* Cancel Allowed for Approved */}
                            {res.status === 'APPROVED' && (
                              <button
                                type="button"
                                onClick={() => setCancellingReservation(res)}
                                disabled={processingId === res.id}
                                className="p-1.5 rounded-md hover:bg-rose-50 text-zinc-400 hover:text-rose-600 transition cursor-pointer disabled:opacity-50"
                                title="Cancel Reservation"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* View Detail */}
                            <button
                              onClick={() => setViewingReservation(res)}
                              className="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 transition cursor-pointer"
                              title="View Full Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {/* Voucher */}
                            <button
                              onClick={() => setSelectedVoucher(res)}
                              className="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900 transition cursor-pointer"
                              title="View Rental Voucher"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </button>

                            {/* Accepted Agreement */}
                            <button
                              onClick={() => setAgreementModalReservation(res)}
                              className="p-1.5 rounded-md hover:bg-emerald-50 text-zinc-500 hover:text-emerald-700 transition cursor-pointer"
                              title="View Customer Rental Agreement"
                            >
                              <FileCheck className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Reservation Details Modal */}
      {viewingReservation && (
        <Dialog
          isOpen={!!viewingReservation}
          onClose={() => setViewingReservation(null)}
          title={
            <div className="flex items-center gap-2 text-zinc-900">
              <FileText className="w-5 h-5 text-zinc-700" />
              <span>Reservation Details — {viewingReservation.referenceNo}</span>
            </div>
          }
          description={`Created on ${formatDate(viewingReservation.createdAt)} • Status: ${viewingReservation.status}`}
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs text-zinc-700">
            {/* Customer Information */}
            <div className="p-3.5 bg-zinc-50 rounded-lg border border-zinc-200 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Customer &amp; Identification Record
              </span>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <span className="text-zinc-400">Full Name:</span>{' '}
                  <strong className="text-zinc-900">{viewingReservation.customerName}</strong>
                </div>
                <div>
                  <span className="text-zinc-400">Phone:</span>{' '}
                  <strong className="text-zinc-900">{viewingReservation.customerPhone}</strong>
                </div>
                <div>
                  <span className="text-zinc-400">Barangay:</span>{' '}
                  <strong className="text-zinc-900">{viewingReservation.customerBarangay}, Butuan City</strong>
                </div>
                <div>
                  <span className="text-zinc-400">Verified ID:</span>{' '}
                  <strong className="text-zinc-900">{viewingReservation.idType || 'Philippine ID'} ({viewingReservation.idNumber || 'Verified'})</strong>
                </div>
              </div>
            </div>

            {/* Camera Asset & Schedule */}
            <div className="p-3.5 bg-zinc-50 rounded-xl border border-zinc-200 space-y-2.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                Camera Asset &amp; Booking Period
              </span>
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-lg bg-white p-1 border border-zinc-200 flex items-center justify-center shrink-0 shadow-2xs">
                  <img
                    src={getCameraImageUrl(viewingReservation.cameraId, viewingReservation.cameraImageUrl)}
                    alt={viewingReservation.cameraName}
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-zinc-900 text-xs truncate">{viewingReservation.cameraName}</h4>
                  <p className="text-[11px] text-zinc-500 font-mono">SN: {viewingReservation.cameraSerial}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-zinc-200">
                <div>
                  <span className="text-zinc-400">Contractual Dates:</span>{' '}
                  <strong className="text-zinc-900">
                    {formatDate(viewingReservation.startDate)} to {formatDate(viewingReservation.endDate)}
                  </strong>
                </div>
                <div>
                  <span className="text-zinc-400">Duration:</span>{' '}
                  <strong className="text-zinc-900">{viewingReservation.totalDays} Rental Days</strong>
                </div>
              </div>

              <div className="pt-1.5 border-t border-zinc-200/70 text-[11px] flex items-center justify-between">
                <span className="text-zinc-500 font-medium">Return Schedule:</span>
                <span className="text-zinc-800 font-medium">By 6:00 PM on {formatDate(viewingReservation.endDate)}</span>
              </div>

              {viewingReservation.purpose && (
                <div className="pt-2 border-t border-zinc-200 text-[11px]">
                  <span className="text-zinc-400">Shooting Purpose: </span>
                  <span className="text-zinc-800 italic">&quot;{viewingReservation.purpose}&quot;</span>
                </div>
              )}
            </div>

            {/* Agreement Audit Section */}
            <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">
                  Accepted Rental Agreement
                </span>
                <p className="text-xs font-semibold text-zinc-900 flex items-center gap-1.5 mt-0.5">
                  <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Version {viewingReservation.agreementVersion || 'v1.0'} (Legally Binding Snapshot)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAgreementModalReservation(viewingReservation)}
                className="px-3 py-1.5 rounded-md bg-white border border-zinc-200 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 shadow-2xs transition cursor-pointer"
              >
                Inspect Agreement
              </button>
            </div>

            {/* Financial Ledger Calculation */}
            <div className="p-3.5 bg-zinc-50 rounded-lg border border-zinc-200 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Authoritative Financial Breakdown
              </span>
              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-zinc-500">
                    Rental Tariff ({viewingReservation.totalDays} days × {formatPHP(viewingReservation.dailyRate)}):
                  </span>
                  <span className="text-zinc-900 font-medium">{formatPHP(viewingReservation.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Refundable Security Deposit:</span>
                  <span className="text-zinc-900 font-medium">{formatPHP(viewingReservation.securityDeposit)}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-zinc-200 font-bold text-xs text-zinc-900">
                  <span>Total Amount Due:</span>
                  <span>{formatPHP(viewingReservation.totalAmount)}</span>
                </div>
                <div className="flex justify-between text-[11px] pt-1 text-zinc-500">
                  <span>Payment Status:</span>
                  <span className="font-semibold text-zinc-900">{viewingReservation.paymentStatus} ({viewingReservation.paymentMethod})</span>
                </div>
              </div>
            </div>

            {/* Actions in Modal */}
            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
              <button
                onClick={() => setViewingReservation(null)}
                className="px-3.5 py-1.5 rounded-lg bg-zinc-100 text-zinc-700 hover:bg-zinc-200 text-xs font-semibold"
              >
                Close
              </button>
              {viewingReservation.status === 'PENDING_APPROVAL' && (
                <>
                  <button
                    onClick={() => {
                      setRejectPromptId(viewingReservation.id);
                      setViewingReservation(null);
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 text-xs font-bold"
                  >
                    Reject
                  </button>
                  <button
                    onClick={async () => {
                      await handleApprove(viewingReservation.id, viewingReservation.referenceNo);
                      setViewingReservation(null);
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 text-xs font-bold"
                  >
                    Approve
                  </button>
                </>
              )}
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

      {/* Agreement Modal */}
      <RentalAgreementModal
        reservation={agreementModalReservation}
        isOpen={!!agreementModalReservation}
        onClose={() => setAgreementModalReservation(null)}
      />

      {/* Reject Modal */}
      {rejectPromptId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white border border-zinc-200 rounded-xl max-w-md w-full p-6 text-zinc-900 shadow-xl space-y-4">
            <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
              <X className="w-4 h-4 text-rose-600" />
              Reject Reservation Request
            </h3>
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1">
                Reason for Rejection *
              </label>
              <input
                type="text"
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 text-xs focus:outline-none focus:border-zinc-900 transition"
              />
            </div>
            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={processingId === rejectPromptId}
                onClick={() => setRejectPromptId(null)}
                className="px-3.5 py-1.5 rounded-lg bg-zinc-100 text-zinc-700 hover:bg-zinc-200 text-xs font-medium cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={processingId === rejectPromptId}
                onClick={() => handleReject(rejectPromptId, 'Reservation')}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {processingId === rejectPromptId ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Rejecting...</span>
                  </>
                ) : (
                  <span>Confirm Reject</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Confirmation Dialog */}
      {cancellingReservation && (
        <Dialog
          isOpen={!!cancellingReservation}
          onClose={() => !processingId && setCancellingReservation(null)}
          title="Cancel Approved Reservation"
          description={`Revoke approved reservation ${cancellingReservation.referenceNo} for ${cancellingReservation.customerName}?`}
          maxWidth="md"
        >
          <div className="space-y-4 text-xs text-zinc-700">
            <p>
              Are you sure you want to cancel this approved reservation for <strong>{cancellingReservation.cameraName}</strong>?
            </p>
            <p className="text-zinc-500">
              Contractual Dates: {formatDate(cancellingReservation.startDate)} to {formatDate(cancellingReservation.endDate)}.
              The dates will be immediately freed up for other customer bookings.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
              <button
                type="button"
                disabled={!!processingId}
                onClick={() => setCancellingReservation(null)}
                className="px-3.5 py-1.5 rounded-lg bg-zinc-100 text-zinc-700 hover:bg-zinc-200 text-xs font-medium cursor-pointer disabled:opacity-50"
              >
                Keep Approved
              </button>
              <button
                type="button"
                disabled={!!processingId}
                onClick={handleConfirmCancel}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {processingId === cancellingReservation.id ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Cancelling...</span>
                  </>
                ) : (
                  <span>Confirm Cancellation</span>
                )}
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};
