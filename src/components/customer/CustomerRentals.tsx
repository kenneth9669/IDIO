'use client';
import React, { useState, useMemo } from 'react';
import { useSystem } from '../../context/SystemContext';
import { Rental, Reservation } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { formatPHP, formatDate, getCameraImageUrl } from '../../lib/utils';
import {
  Camera,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  FileCheck,
  Package,
  MapPin,
  Sparkles,
  Info,
  Layers,
  ArrowRight
} from 'lucide-react';

export const CustomerRentals: React.FC = () => {
  const { rentals, reservations, currentUser } = useSystem();
  const [filterTab, setFilterTab] = useState<'ALL' | 'ACTIVE' | 'HISTORICAL'>('ALL');

  const customerId = currentUser.id;

  // Filter scoped rentals & reservations for active customer (strictly scoped to verified user ID)
  const customerRentals = useMemo(() => {
    if (!customerId) return [];
    return rentals.filter((r) => r.customerId === customerId);
  }, [rentals, customerId]);

  // Also include reservations that are CHECKED_OUT or COMPLETED to ensure comprehensive visibility
  const customerReservationsWithRentals = useMemo(() => {
    if (!customerId) return [];
    return reservations.filter(
      (res) => res.customerId === customerId && ['CHECKED_OUT', 'RETURNED', 'COMPLETED'].includes(res.status)
    );
  }, [reservations, customerId]);

  // Combine or match reservation + rental records
  const unifiedRentals = useMemo(() => {
    // Map existing reservations
    return customerReservationsWithRentals.map((res) => {
      const matchedRental = customerRentals.find((r) => r.reservationId === res.id);
      return {
        id: matchedRental?.id || res.id,
        reservationId: res.id,
        referenceNo: res.referenceNo,
        cameraId: res.cameraId,
        cameraName: res.cameraName,
        cameraBrand: res.cameraBrand,
        cameraSerial: res.cameraSerial,
        cameraImageUrl: res.cameraImageUrl,
        startDate: res.startDate,
        endDate: res.endDate,
        totalDays: res.totalDays,
        dailyRate: res.dailyRate,
        subtotal: res.subtotal,
        securityDeposit: res.securityDeposit,
        totalAmount: res.totalAmount,
        status: res.status, // CHECKED_OUT, RETURNED, COMPLETED
        checkoutCondition: matchedRental?.checkoutCondition || res.checkoutCondition || 'Excellent',
        checkoutNotes: matchedRental?.checkoutNotes || res.checkoutNotes,
        checkedOutAt: matchedRental?.checkedOutAt || res.checkoutTimestamp || res.startDate,
        checkoutAdminName: matchedRental?.checkoutAdminName || res.checkoutAdminName || 'IDIO Counter Staff',
        returnCondition: matchedRental?.returnCondition || res.returnCondition,
        returnInspectionNotes: matchedRental?.returnInspectionNotes || res.returnNotes,
        returnedAt: matchedRental?.returnedAt || res.returnTimestamp,
        returnAdminName: matchedRental?.returnAdminName || res.returnAdminName,
        depositStatus: res.depositStatus,
        depositDeduction: res.depositDeduction,
        depositNotes: res.depositNotes
      };
    });
  }, [customerReservationsWithRentals, customerRentals]);

  const activeRentals = unifiedRentals.filter((r) => r.status === 'CHECKED_OUT');
  const historicalRentals = unifiedRentals.filter((r) => ['RETURNED', 'COMPLETED'].includes(r.status));

  const displayRentals = useMemo(() => {
    if (filterTab === 'ACTIVE') return activeRentals;
    if (filterTab === 'HISTORICAL') return historicalRentals;
    return unifiedRentals;
  }, [filterTab, activeRentals, historicalRentals, unifiedRentals]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900 flex items-center gap-2">
            <Camera className="w-5 h-5 text-zinc-700" />
            <span>My In-Field Rentals &amp; Gear History</span>
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            View active gear checkouts, store return instructions, physical inspection logs, and deposit outcomes.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center p-1 bg-zinc-100 border border-zinc-200 rounded-lg text-xs self-start sm:self-auto">
          <button
            onClick={() => setFilterTab('ALL')}
            className={`px-3 py-1.5 rounded-md font-medium transition ${
              filterTab === 'ALL'
                ? 'bg-white text-zinc-900 shadow-xs font-semibold'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            All ({unifiedRentals.length})
          </button>
          <button
            onClick={() => setFilterTab('ACTIVE')}
            className={`px-3 py-1.5 rounded-md font-medium transition ${
              filterTab === 'ACTIVE'
                ? 'bg-white text-zinc-900 shadow-xs font-semibold'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            Active In-Field ({activeRentals.length})
          </button>
          <button
            onClick={() => setFilterTab('HISTORICAL')}
            className={`px-3 py-1.5 rounded-md font-medium transition ${
              filterTab === 'HISTORICAL'
                ? 'bg-white text-zinc-900 shadow-xs font-semibold'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            Past Rentals ({historicalRentals.length})
          </button>
        </div>
      </div>

      {/* Return Instructions Banner for active rentals */}
      {activeRentals.length > 0 && (
        <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-5 text-amber-900 shadow-xs space-y-2">
          <div className="flex items-center gap-2 font-bold text-xs">
            <Clock className="w-4 h-4 text-amber-700" />
            <span>Store Return Protocol &amp; Checklist (IDIO Butuan City Branch)</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-amber-800/90 pt-1">
            <ul className="space-y-1 list-disc list-inside">
              <li>Return location: <strong>J.C. Aquino Ave, Butuan City</strong></li>
              <li>Daily store return cut-off time: <strong>7:00 PM</strong></li>
            </ul>
            <ul className="space-y-1 list-disc list-inside">
              <li>Ensure all accessories are returned (battery, lens cap, strap, SD card)</li>
              <li>Counter staff will conduct optical &amp; mechanical inspection before releasing deposit</li>
            </ul>
          </div>
        </div>
      )}

      {/* Rentals List */}
      {displayRentals.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-zinc-200 p-8 space-y-3">
          <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mx-auto text-zinc-400">
            <Camera className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-zinc-900">No Rental Records Found</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            You currently have no active or historical camera checkouts. Once your approved reservation is checked out at the counter, it will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {displayRentals.map((rental) => (
            <div
              key={rental.id}
              className="bg-white border border-zinc-200 rounded-xl p-5 hover:border-zinc-300 transition shadow-xs space-y-5"
            >
              {/* Header Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-zinc-100 gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-zinc-50 border border-zinc-200/90 p-1 flex items-center justify-center shrink-0 shadow-2xs">
                    <img
                      src={getCameraImageUrl(rental.cameraId, rental.cameraImageUrl)}
                      alt={rental.cameraName}
                      className="w-full h-full object-contain"
                      loading="lazy"
                    />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900">{rental.cameraName}</h3>
                    <p className="text-[11px] text-zinc-500">
                      Ref: <span className="font-mono font-medium text-zinc-700">{rental.referenceNo}</span> • Serial: <span className="font-mono text-zinc-600">{rental.cameraSerial}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <StatusBadge status={rental.status} type="rental" />
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                {/* Dates */}
                <div className="bg-zinc-50 rounded-lg p-3 space-y-1">
                  <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">
                    Rental Duration
                  </span>
                  <div className="font-bold text-zinc-800">
                    {formatDate(rental.startDate)} – {formatDate(rental.endDate)}
                  </div>
                  <p className="text-zinc-500 text-[11px]">
                    {rental.totalDays} day{rental.totalDays > 1 ? 's' : ''} duration
                  </p>
                </div>

                {/* Checkout Inspection */}
                <div className="bg-zinc-50 rounded-lg p-3 space-y-1">
                  <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">
                    Checkout Handover
                  </span>
                  <div className="font-semibold text-zinc-800 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Grade: {rental.checkoutCondition}</span>
                  </div>
                  <p className="text-zinc-500 text-[11px] truncate">
                    Verified by: {rental.checkoutAdminName}
                  </p>
                </div>

                {/* Return Status & Inspection */}
                <div className="bg-zinc-50 rounded-lg p-3 space-y-1">
                  <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">
                    Return Inspection
                  </span>
                  {rental.returnCondition ? (
                    <div>
                      <span className="font-semibold text-zinc-800">
                        Grade: {rental.returnCondition}
                      </span>
                      <p className="text-zinc-500 text-[11px] truncate">
                        {rental.returnInspectionNotes || 'Passed visual & optical tests'}
                      </p>
                    </div>
                  ) : (
                    <div className="text-amber-700 font-medium">
                      <span>In-field (Pending Return)</span>
                      <p className="text-zinc-400 text-[11px]">Due: {formatDate(rental.endDate)}</p>
                    </div>
                  )}
                </div>

                {/* Security Deposit Outcome */}
                <div className="bg-zinc-50 rounded-lg p-3 space-y-1">
                  <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">
                    Security Deposit ({formatPHP(rental.securityDeposit)})
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                        rental.depositStatus === 'REFUNDED'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : rental.depositStatus === 'HELD'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                      }`}
                    >
                      {rental.depositStatus}
                    </span>
                  </div>
                  {rental.depositDeduction && rental.depositDeduction > 0 ? (
                    <p className="text-rose-600 text-[11px]">
                      Deducted: {formatPHP(rental.depositDeduction)}
                    </p>
                  ) : (
                    <p className="text-zinc-500 text-[11px]">
                      {rental.depositStatus === 'REFUNDED' ? 'Released in full' : 'Protected in escrow'}
                    </p>
                  )}
                </div>
              </div>

              {/* Inspection notes footer if returned */}
              {rental.returnInspectionNotes && (
                <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-lg text-xs space-y-1">
                  <span className="font-semibold text-zinc-700 block">
                    Technician Return Notes &amp; Verification:
                  </span>
                  <p className="text-zinc-600 leading-relaxed">
                    {rental.returnInspectionNotes}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
