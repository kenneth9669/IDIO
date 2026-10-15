'use client';

import React, { useState, useMemo } from 'react';
import { useSystem } from '../../context/SystemContext';
import { formatPHP, formatDate, formatDateTime } from '../../lib/utils';
import {
  Shield,
  Camera,
  Clock,
  CheckCircle2,
  TrendingUp,
  Wrench,
  Activity,
  ArrowRight,
  Plus,
  AlertTriangle,
  RotateCcw,
  CalendarCheck,
  CreditCard,
  SlidersHorizontal,
  FileSpreadsheet,
  AlertCircle
} from 'lucide-react';
import { CameraFormModal } from './CameraFormModal';
import { getCameraOperationalScheduleState } from '../../lib/availabilityEngine';

interface AdminDashboardProps {
  onNavigateTab: (tab: any) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigateTab }) => {
  const { cameras, reservations, activityLogs, addCamera, payments } = useSystem();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [revenuePeriod, setRevenuePeriod] = useState<'ALL' | '30D' | '7D'>('ALL');

  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Authoritative fleet operational and reservation schedules
  const fleetSchedules = useMemo(() => {
    return cameras.map(cam => ({
      camera: cam,
      schedule: getCameraOperationalScheduleState(cam, reservations, todayStr)
    }));
  }, [cameras, reservations, todayStr]);

  const totalCameras = cameras.length;
  // Genuinely available today for counter rental (no maintenance, not damaged, not checked out, no pickup today)
  const genuinelyAvailableToday = fleetSchedules.filter(f => f.schedule.isGenuinelyAvailableToday);
  // Reserved today (approved reservation active today awaiting or in pickup)
  const currentlyReservedToday = fleetSchedules.filter(f => f.schedule.effectiveStatus === 'RESERVED_TODAY');
  // Cameras with future approved reservations starting after today
  const futureReservedCameras = fleetSchedules.filter(f => f.schedule.hasFutureReservations);
  // Cameras with pending booking requests that hold inventory
  const pendingHoldCameras = fleetSchedules.filter(f => f.schedule.hasPendingReservations);
  // Cameras checked out in customer possession
  const checkedOutCameras = fleetSchedules.filter(f => f.schedule.isCheckedOut);
  // Cameras in maintenance or damaged
  const maintenanceCameras = fleetSchedules.filter(f => f.schedule.isMaintenance || f.schedule.isDamaged);

  const pendingReservations = reservations.filter(r => r.status === 'PENDING_APPROVAL' && r.endDate >= todayStr);
  const approvedReservations = reservations.filter(r => r.status === 'APPROVED');
  const activeRentals = reservations.filter(r => r.status === 'CHECKED_OUT');

  // Overdue rentals: checked out where endDate is before today
  const overdueRentals = activeRentals.filter(r => r.endDate < todayStr);

  // Upcoming pickups: approved reservations starting today or tomorrow
  const upcomingPickups = approvedReservations.filter(r => r.startDate >= todayStr);

  // Expected returns: active rentals due today or earlier
  const expectedReturns = activeRentals.filter(r => r.endDate <= todayStr);

  // Outstanding customer balance: pending unpaid rental amounts + deposit deductions
  const outstandingBalance = reservations
    .filter(r => r.paymentStatus === 'PENDING' && r.status !== 'CANCELLED' && r.status !== 'REJECTED')
    .reduce((sum, r) => sum + r.totalAmount, 0);

  // Revenue calculation based on period
  const revenueCalculated = useMemo(() => {
    const now = new Date();
    const cutoffDate = new Date();
    if (revenuePeriod === '30D') {
      cutoffDate.setDate(now.getDate() - 30);
    } else if (revenuePeriod === '7D') {
      cutoffDate.setDate(now.getDate() - 7);
    } else {
      cutoffDate.setTime(0); // All time
    }

    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    return reservations
      .filter(r => (r.status === 'COMPLETED' || r.paymentStatus === 'PAID') && r.createdAt >= cutoffStr)
      .reduce((sum, r) => sum + r.subtotal, 0);
  }, [reservations, revenuePeriod]);

  return (
    <div className="space-y-6">
      {/* Executive Welcome & Quick Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-zinc-800" />
            Executive Operations Dashboard
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Real-time operational overview, camera fleet health, and financial ledger for Butuan City.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-xs shadow-xs transition inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Camera</span>
          </button>
          <button
            onClick={() => onNavigateTab('rentals')}
            className="px-3.5 py-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 font-medium text-xs transition inline-flex items-center gap-1.5 cursor-pointer"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Counter Ops</span>
          </button>
        </div>
      </div>

      {/* Critical Overdue Alerts Banner */}
      {overdueRentals.length > 0 && (
        <div className="p-4 bg-white border border-zinc-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full border border-rose-200 bg-white flex items-center justify-center text-rose-600 shrink-0">
              <AlertTriangle className="w-4 h-4 stroke-[2]" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-zinc-900">
                {overdueRentals.length} Overdue Camera Rental{overdueRentals.length > 1 ? 's' : ''} Detected
              </h4>
              <p className="text-xs text-zinc-500">
                Equipment has passed the agreed return date. Contact customers immediately for return inspection.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('rentals')}
            className="px-3.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-xs transition cursor-pointer self-start sm:self-auto shadow-xs"
          >
            Inspect Returns
          </button>
        </div>
      )}

      {/* Fleet Summary Cards (10 Core Metrics) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* 1. Total Registered */}
        <div
          onClick={() => onNavigateTab('cameras')}
          className="p-4 bg-white border border-zinc-200 rounded-xl space-y-1 hover:border-zinc-300 transition cursor-pointer shadow-xs"
        >
          <div className="flex items-center justify-between text-zinc-500 text-xs">
            <span>Total Cameras</span>
            <Camera className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <p className="text-xl font-bold text-zinc-900">{totalCameras}</p>
          <span className="text-[10px] text-zinc-400">Registered assets</span>
        </div>

        {/* 2. Available Today */}
        <div
          onClick={() => onNavigateTab('cameras')}
          className="p-4 bg-white border border-zinc-200 rounded-xl space-y-1 hover:border-zinc-300 transition cursor-pointer shadow-xs"
        >
          <div className="flex items-center justify-between text-zinc-500 text-xs">
            <span>Available Today</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <p className="text-xl font-bold text-emerald-600">{genuinelyAvailableToday.length}</p>
          <span className="text-[10px] text-zinc-400">Ready for counter rental</span>
        </div>

        {/* 3. Reserved / Booked */}
        <div
          onClick={() => onNavigateTab('reservations')}
          className="p-4 bg-white border border-zinc-200 rounded-xl space-y-1 hover:border-zinc-300 transition cursor-pointer shadow-xs"
        >
          <div className="flex items-center justify-between text-zinc-500 text-xs">
            <span>Reserved / Booked</span>
            <CalendarCheck className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <p className="text-xl font-bold text-blue-600">
            {currentlyReservedToday.length + futureReservedCameras.length}
          </p>
          <span className="text-[10px] text-zinc-400">
            {currentlyReservedToday.length} today • {futureReservedCameras.length} future
          </span>
        </div>

        {/* 4. Checked Out */}
        <div
          onClick={() => onNavigateTab('rentals')}
          className="p-4 bg-white border border-zinc-200 rounded-xl space-y-1 hover:border-zinc-300 transition cursor-pointer shadow-xs"
        >
          <div className="flex items-center justify-between text-zinc-500 text-xs">
            <span>Checked Out</span>
            <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <p className="text-xl font-bold text-indigo-600">{checkedOutCameras.length}</p>
          <span className="text-[10px] text-zinc-400">In customer hands</span>
        </div>

        {/* 5. Maintenance / Damaged */}
        <div
          onClick={() => onNavigateTab('maintenance')}
          className="p-4 bg-white border border-zinc-200 rounded-xl space-y-1 hover:border-zinc-300 transition cursor-pointer shadow-xs"
        >
          <div className="flex items-center justify-between text-zinc-500 text-xs">
            <span>Maintenance / Damaged</span>
            <Wrench className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <p className="text-xl font-bold text-amber-600">{maintenanceCameras.length}</p>
          <span className="text-[10px] text-zinc-400">Service lockout</span>
        </div>

        {/* 6. Pending Approvals */}
        <div
          onClick={() => onNavigateTab('reservations')}
          className="p-4 bg-white border border-zinc-200 rounded-xl space-y-1 hover:border-zinc-300 transition cursor-pointer shadow-xs"
        >
          <div className="flex items-center justify-between text-zinc-500 text-xs">
            <span>Pending Bookings</span>
            <Clock className="w-3.5 h-3.5 text-amber-500" />
          </div>
          <p className="text-xl font-bold text-zinc-900">{pendingReservations.length}</p>
          <span className="text-[10px] text-zinc-400">
            {pendingHoldCameras.length > 0 ? `${pendingHoldCameras.length} camera(s) hold inventory` : 'Awaiting admin review'}
          </span>
        </div>

        {/* 7. Active Rentals */}
        <div
          onClick={() => onNavigateTab('rentals')}
          className="p-4 bg-white border border-zinc-200 rounded-xl space-y-1 hover:border-zinc-300 transition cursor-pointer shadow-xs"
        >
          <div className="flex items-center justify-between text-zinc-500 text-xs">
            <span>Active Rentals</span>
            <Activity className="w-3.5 h-3.5 text-zinc-500" />
          </div>
          <p className="text-xl font-bold text-zinc-900">{activeRentals.length}</p>
          <span className="text-[10px] text-zinc-400">In-field shoots</span>
        </div>

        {/* 8. Overdue Rentals */}
        <div
          onClick={() => onNavigateTab('rentals')}
          className={`p-4 rounded-xl space-y-1 transition cursor-pointer shadow-xs border ${
            overdueRentals.length > 0 ? 'bg-rose-50 border-rose-300' : 'bg-white border-zinc-200'
          }`}
        >
          <div className="flex items-center justify-between text-xs">
            <span className={overdueRentals.length > 0 ? 'text-rose-700 font-bold' : 'text-zinc-500'}>
              Overdue Rentals
            </span>
            <AlertCircle className={`w-3.5 h-3.5 ${overdueRentals.length > 0 ? 'text-rose-600' : 'text-zinc-400'}`} />
          </div>
          <p className={`text-xl font-bold ${overdueRentals.length > 0 ? 'text-rose-700' : 'text-zinc-900'}`}>
            {overdueRentals.length}
          </p>
          <span className="text-[10px] text-zinc-400">Past return deadline</span>
        </div>

        {/* 9. Settled Revenue */}
        <div
          onClick={() => onNavigateTab('reports')}
          className="p-4 bg-white border border-zinc-200 rounded-xl space-y-1 hover:border-zinc-300 transition cursor-pointer shadow-xs"
        >
          <div className="flex items-center justify-between text-zinc-500 text-xs">
            <span>Rental Revenue</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <p className="text-xl font-bold text-zinc-900">{formatPHP(revenueCalculated)}</p>
          <div className="flex items-center gap-1 mt-0.5">
            {(['ALL', '30D', '7D'] as const).map(p => (
              <button
                key={p}
                onClick={e => {
                  e.stopPropagation();
                  setRevenuePeriod(p);
                }}
                className={`text-[9px] px-1 py-0.2 rounded font-semibold ${
                  revenuePeriod === p ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* 10. Outstanding Balance */}
        <div
          onClick={() => onNavigateTab('payments')}
          className="p-4 bg-white border border-zinc-200 rounded-xl space-y-1 hover:border-zinc-300 transition cursor-pointer shadow-xs"
        >
          <div className="flex items-center justify-between text-zinc-500 text-xs">
            <span>Unpaid Balances</span>
            <CreditCard className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <p className="text-xl font-bold text-zinc-900">{formatPHP(outstandingBalance)}</p>
          <span className="text-[10px] text-zinc-400">Pending collections</span>
        </div>
      </div>

      {/* Fleet Real-Time Availability & Schedule Breakdown */}
      <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-zinc-100">
          <div>
            <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
              <Camera className="w-4 h-4 text-zinc-700" />
              Fleet Availability &amp; Reservation Schedule
            </h3>
            <p className="text-xs text-zinc-500 mt-0.5">
              Authoritative real-time schedule showing physical readiness, today&apos;s status, and active date-range holds across all cameras.
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('cameras')}
            className="text-xs text-zinc-600 hover:text-zinc-900 font-medium flex items-center gap-1 cursor-pointer self-start sm:self-auto"
          >
            Manage Fleet <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-100 text-zinc-400 font-medium uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Camera</th>
                <th className="py-2.5 px-3">Status Today</th>
                <th className="py-2.5 px-3">Active / Future Reservations</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {fleetSchedules.map(({ camera, schedule }) => {
                const badge = (() => {
                  switch (schedule.effectiveStatus) {
                    case 'AVAILABLE':
                      return (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Available Today
                        </span>
                      );
                    case 'RESERVED_TODAY':
                      return (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-200">
                          <CalendarCheck className="w-3 h-3 text-blue-600" /> Pickup Today ({schedule.activeReservationToday?.referenceNo})
                        </span>
                      );
                    case 'CHECKED_OUT':
                      return (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <SlidersHorizontal className="w-3 h-3 text-indigo-600" /> In Field (Rented)
                        </span>
                      );
                    case 'OVERDUE':
                      return (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                          <AlertTriangle className="w-3 h-3 text-rose-600" /> Overdue Return
                        </span>
                      );
                    case 'MAINTENANCE':
                      return (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          <Wrench className="w-3 h-3 text-amber-600" /> In Maintenance
                        </span>
                      );
                    case 'DAMAGED':
                      return (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-50 text-rose-700 border border-rose-200">
                          <AlertCircle className="w-3 h-3 text-rose-600" /> Damaged / Lockout
                        </span>
                      );
                  }
                })();

                return (
                  <tr key={camera.id} className="hover:bg-zinc-50/50 transition">
                    <td className="py-3 px-3">
                      <div className="font-semibold text-zinc-900">{camera.name}</div>
                      <div className="text-[11px] text-zinc-400 font-mono">{camera.serialNumber} • {camera.brand} {camera.model}</div>
                    </td>
                    <td className="py-3 px-3">
                      {badge}
                    </td>
                    <td className="py-3 px-3">
                      <div className="space-y-1">
                        {schedule.futureApprovedReservations.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {schedule.futureApprovedReservations.map(res => (
                              <span key={res.id} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                                <strong>{formatDate(res.startDate)} – {formatDate(res.endDate)}</strong> ({res.referenceNo})
                              </span>
                            ))}
                          </div>
                        )}
                        {schedule.pendingReservations.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {schedule.pendingReservations.map(res => (
                              <span key={res.id} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                                <Clock className="w-2.5 h-2.5" /> Hold: <strong>{formatDate(res.startDate)} – {formatDate(res.endDate)}</strong> (Pending)
                              </span>
                            ))}
                          </div>
                        )}
                        {!schedule.hasFutureReservations && !schedule.hasPendingReservations && schedule.effectiveStatus === 'AVAILABLE' && (
                          <span className="text-[11px] text-zinc-400">No scheduled holds. Completely open for rental.</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right">
                      {schedule.hasPendingReservations ? (
                        <button
                          onClick={() => onNavigateTab('reservations')}
                          className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-medium text-[11px] transition cursor-pointer"
                        >
                          Review Hold
                        </button>
                      ) : schedule.effectiveStatus === 'RESERVED_TODAY' ? (
                        <button
                          onClick={() => onNavigateTab('rentals')}
                          className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-[11px] transition cursor-pointer"
                        >
                          Counter Checkout
                        </button>
                      ) : (
                        <button
                          onClick={() => onNavigateTab('cameras')}
                          className="px-2.5 py-1 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-medium text-[11px] transition cursor-pointer"
                        >
                          View Unit
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grid: Upcoming Operations (Pickups & Returns) + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Upcoming Pickups & Expected Returns */}
        <div className="space-y-6">
          {/* Upcoming Pickups */}
          <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-blue-600" />
                Upcoming Counter Pickups ({upcomingPickups.length})
              </h3>
              <button
                onClick={() => onNavigateTab('rentals')}
                className="text-xs text-zinc-600 hover:text-zinc-900 font-medium flex items-center gap-1 cursor-pointer"
              >
                Go to Counter <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2.5">
              {upcomingPickups.length === 0 ? (
                <div className="py-6 text-center text-xs text-zinc-400">
                  No upcoming counter pickups scheduled.
                </div>
              ) : (
                upcomingPickups.slice(0, 3).map(res => (
                  <div
                    key={res.id}
                    className="p-3 bg-zinc-50 rounded-lg border border-zinc-200 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-mono font-bold text-zinc-900">{res.referenceNo}</span>
                      <p className="font-semibold text-zinc-900 mt-0.5">{res.customerName}</p>
                      <p className="text-[11px] text-zinc-500">
                        {res.cameraName} • Starts: <strong>{formatDate(res.startDate)}</strong>
                      </p>
                    </div>
                    <button
                      onClick={() => onNavigateTab('rentals')}
                      className="px-2.5 py-1 rounded bg-zinc-900 text-white font-medium text-[11px] hover:bg-zinc-800 transition cursor-pointer"
                    >
                      Checkout
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Expected Returns */}
          <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-indigo-600" />
                Expected Returns &amp; Inspections ({expectedReturns.length})
              </h3>
              <button
                onClick={() => onNavigateTab('rentals')}
                className="text-xs text-zinc-600 hover:text-zinc-900 font-medium flex items-center gap-1 cursor-pointer"
              >
                View Field <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2.5">
              {expectedReturns.length === 0 ? (
                <div className="py-6 text-center text-xs text-zinc-400">
                  No camera returns due today.
                </div>
              ) : (
                expectedReturns.slice(0, 3).map(res => (
                  <div
                    key={res.id}
                    className="p-3 bg-zinc-50 rounded-lg border border-zinc-200 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-mono font-bold text-zinc-900">{res.referenceNo}</span>
                      <p className="font-semibold text-zinc-900 mt-0.5">{res.customerName}</p>
                      <p className="text-[11px] text-zinc-500">
                        {res.cameraName} • Return Due: <strong>{formatDate(res.endDate)}</strong>
                      </p>
                    </div>
                    <button
                      onClick={() => onNavigateTab('rentals')}
                      className="px-2.5 py-1 rounded bg-zinc-900 text-white font-medium text-[11px] hover:bg-zinc-800 transition cursor-pointer"
                    >
                      Inspect
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Pending Decisions & Audit Log */}
        <div className="space-y-6">
          {/* Pending Approvals */}
          <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                Pending Customer Bookings ({pendingReservations.length})
              </h3>
              <button
                onClick={() => onNavigateTab('reservations')}
                className="text-xs text-zinc-600 hover:text-zinc-900 font-medium flex items-center gap-1 cursor-pointer"
              >
                Review All <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2.5">
              {pendingReservations.length === 0 ? (
                <div className="py-6 text-center text-xs text-zinc-400">
                  <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-emerald-500" />
                  All customer reservation requests have been processed.
                </div>
              ) : (
                pendingReservations.slice(0, 3).map(res => (
                  <div
                    key={res.id}
                    className="p-3 bg-zinc-50 rounded-lg border border-zinc-200 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-mono font-bold text-zinc-900">{res.referenceNo}</span>
                      <p className="font-semibold text-zinc-900 mt-0.5">{res.customerName}</p>
                      <p className="text-[11px] text-zinc-500">
                        {res.cameraName} ({formatDate(res.startDate)} to {formatDate(res.endDate)})
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-zinc-900 block">{formatPHP(res.totalAmount)}</span>
                      <button
                        onClick={() => onNavigateTab('reservations')}
                        className="mt-1 px-2.5 py-1 rounded bg-zinc-900 text-white font-medium text-[11px] hover:bg-zinc-800 transition cursor-pointer"
                      >
                        Review
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Operational Audit Trail */}
          <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-3 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 flex items-center gap-2">
                <Activity className="w-4 h-4 text-zinc-600" />
                Live Operational Audit Trail
              </h3>
              <button
                onClick={() => onNavigateTab('activity')}
                className="text-xs text-zinc-600 hover:text-zinc-900 font-medium flex items-center gap-1 cursor-pointer"
              >
                View Full Logs <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {activityLogs.slice(0, 5).map(log => (
                <div key={log.id} className="p-2.5 bg-zinc-50 rounded-lg border border-zinc-100 text-xs space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-zinc-900 flex items-center gap-1.5 text-[11px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                      {log.actorName} ({log.actorRole})
                    </span>
                    <span className="text-[10px] text-zinc-400">{formatDateTime(log.timestamp)}</span>
                  </div>
                  <p className="text-zinc-600 text-[11px]">{log.details}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Fleet Maintenance Alerts */}
      {maintenanceCameras.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 text-amber-800 border border-amber-200">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-amber-900">
                {maintenanceCameras.length} Camera{maintenanceCameras.length > 1 ? 's' : ''} under Maintenance / Calibration
              </h4>
              <p className="text-xs text-amber-700">
                Units are excluded from rental availability until cleared and signed off by the admin technician.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('maintenance')}
            className="px-3 py-1.5 rounded-lg bg-amber-800 text-white font-medium text-xs hover:bg-amber-900 transition self-start sm:self-auto cursor-pointer"
          >
            Manage Maintenance
          </button>
        </div>
      )}

      {/* Add Camera Modal */}
      <CameraFormModal
        camera={null}
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={data => addCamera(data)}
      />
    </div>
  );
};
