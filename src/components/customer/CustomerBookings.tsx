'use client';
import React, { useState } from 'react';
import { useSystem } from '../../context/SystemContext';
import { Reservation } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { RentalVoucherModal } from './RentalVoucherModal';
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
  Sparkles
} from 'lucide-react';

export const CustomerBookings: React.FC = () => {
  const { reservations, currentUser, cancelReservation } = useSystem();
  const [selectedVoucher, setSelectedVoucher] = useState<Reservation | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Filter reservations for the active customer
  const customerReservations = reservations.filter(r => r.customerId === currentUser.id);

  const filteredList = customerReservations.filter(r => {
    if (filterStatus === 'ALL') return true;
    if (filterStatus === 'ACTIVE') return ['PENDING_APPROVAL', 'APPROVED', 'CHECKED_OUT', 'RETURNED'].includes(r.status);
    if (filterStatus === 'COMPLETED') return r.status === 'COMPLETED';
    if (filterStatus === 'CANCELLED') return ['CANCELLED', 'REJECTED'].includes(r.status);
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-zinc-700" />
            My Bookings & Rental History
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

      {/* Reservation Cards List */}
      {filteredList.length === 0 ? (
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
                  {res.rejectionReason && (
                    <span className="text-rose-600">Rejection note: {res.rejectionReason}</span>
                  )}
                  {res.returnNotes && (
                    <span className="text-emerald-600">Return note: {res.returnNotes}</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {res.status === 'PENDING_APPROVAL' && (
                    <button
                      onClick={() => cancelReservation(res.id)}
                      className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-medium transition flex items-center gap-1 cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Cancel</span>
                    </button>
                  )}

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

      {/* Voucher Modal */}
      <RentalVoucherModal
        reservation={selectedVoucher}
        isOpen={!!selectedVoucher}
        onClose={() => setSelectedVoucher(null)}
      />
    </div>
  );
};
