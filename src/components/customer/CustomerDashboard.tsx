'use client';
import React, { useMemo } from 'react';
import { useSystem } from '../../context/SystemContext';
import { useAuth } from '../../context/AuthContext';
import { StatusBadge } from '../common/StatusBadge';
import { formatPHP, formatDate, getCameraImageUrl } from '../../lib/utils';
import {
  Camera,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  CreditCard,
  Bell,
  ArrowRight,
  Package,
  Sparkles,
  MapPin,
  TrendingUp,
  FileText
} from 'lucide-react';

interface CustomerDashboardProps {
  onNavigateTab: (tab: string) => void;
  onSelectReservationForVoucher?: (refNo: string) => void;
}

export const CustomerDashboard: React.FC<CustomerDashboardProps> = ({
  onNavigateTab,
  onSelectReservationForVoucher
}) => {
  const { reservations, rentals, payments, currentUser } = useSystem();
  const { profile } = useAuth();

  const customerName = profile?.full_name || currentUser.name || 'Valued Customer';
  const customerId = currentUser.id;

  // Filter scoped data to authenticated customer
  const myReservations = useMemo(() => {
    return reservations.filter((r) => r.customerId === customerId);
  }, [reservations, customerId]);

  const myRentals = useMemo(() => {
    return rentals.filter((r) => r.customerId === customerId);
  }, [rentals, customerId]);

  const myPayments = useMemo(() => {
    return payments.filter((p) => p.customerId === customerId);
  }, [payments, customerId]);

  // Status-derived metrics
  const activeRentalsCount = myReservations.filter((r) => r.status === 'CHECKED_OUT').length;
  const pendingApprovalsCount = myReservations.filter((r) => r.status === 'PENDING_APPROVAL').length;
  const approvedPickupsCount = myReservations.filter((r) => r.status === 'APPROVED').length;
  const completedRentalsCount = myReservations.filter((r) => r.status === 'COMPLETED').length;

  const totalHeldDeposit = myPayments
    .filter((p) => p.depositStatus === 'HELD')
    .reduce((sum, p) => sum + (p.securityDeposit || 0), 0);

  const totalPaidTariffs = myPayments
    .filter((p) => p.paymentStatus === 'PAID')
    .reduce((sum, p) => sum + (p.rentalAmount || 0), 0);

  // Active in-field rental list for quick return tracking
  const activeShoots = myReservations.filter((r) => r.status === 'CHECKED_OUT');
  const readyPickups = myReservations.filter((r) => r.status === 'APPROVED');
  const pendingList = myReservations.filter((r) => r.status === 'PENDING_APPROVAL');

  // Compute dynamic notifications
  const notifications = useMemo(() => {
    const list: {
      id: string;
      title: string;
      message: string;
      time: string;
      type: 'info' | 'success' | 'warning' | 'purple';
      actionTab?: string;
    }[] = [];

    // Pickup alerts
    readyPickups.forEach((res) => {
      list.push({
        id: `ready-${res.id}`,
        title: 'Reservation Approved — Ready for Pickup!',
        message: `Your booking for ${res.cameraName} (${res.referenceNo}) is approved. Present your digital claim voucher at J.C. Aquino branch.`,
        time: res.updatedAt || res.createdAt,
        type: 'success',
        actionTab: 'my-reservations'
      });
    });

    // Active rental return due alerts
    activeShoots.forEach((res) => {
      list.push({
        id: `return-${res.id}`,
        title: 'Camera In-Field — Return Scheduled',
        message: `${res.cameraName} is due for return on ${formatDate(res.endDate)} before 7:00 PM at IDIO Butuan.`,
        time: res.updatedAt || res.startDate,
        type: 'warning',
        actionTab: 'my-rentals'
      });
    });

    // Pending approval alerts
    pendingList.forEach((res) => {
      list.push({
        id: `pending-${res.id}`,
        title: 'Reservation Request Under Review',
        message: `Your request for ${res.cameraName} (${res.startDate} to ${res.endDate}) is pending counter approval.`,
        time: res.createdAt,
        type: 'info',
        actionTab: 'my-reservations'
      });
    });

    // Deposit settlement alerts
    myPayments
      .filter((p) => p.depositStatus === 'REFUNDED')
      .slice(0, 2)
      .forEach((p) => {
        list.push({
          id: `dep-${p.id}`,
          title: 'Security Deposit Refunded',
          message: `Security deposit of ${formatPHP(p.securityDeposit)} for ${p.cameraName || 'your camera rental'} has been released in full.`,
          time: p.settledAt || p.updatedAt,
          type: 'purple',
          actionTab: 'payments'
        });
      });

    return list;
  }, [readyPickups, activeShoots, pendingList, myPayments]);

  const hasAnyRecords = myReservations.length > 0 || myRentals.length > 0 || myPayments.length > 0;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-white border border-zinc-200 text-zinc-900 p-6 sm:p-8 shadow-xs">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-100 text-zinc-700 text-xs font-semibold border border-zinc-200">
              <MapPin className="w-3.5 h-3.5 text-zinc-500" />
              <span>Customer Portal • Butuan City, Agusan del Norte</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">
              Digital Camera Rentals
            </h1>
            <p className="text-xs sm:text-sm text-zinc-600 leading-relaxed">
              Manage your digital camera reservations, track active gear in the field, check deposit statuses, and access your verified rental vouchers.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => onNavigateTab('catalog')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 text-white hover:bg-zinc-800 text-xs font-semibold transition shadow-xs cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>Browse Cameras</span>
            </button>
            <button
              onClick={() => onNavigateTab('my-reservations')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-zinc-50 text-zinc-700 text-xs font-semibold transition border border-zinc-200 shadow-xs cursor-pointer"
            >
              <FileText className="w-4 h-4 text-zinc-500" />
              <span>My Bookings</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Rentals */}
        <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs flex flex-col justify-between hover:border-zinc-300 transition">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Active In-Field</span>
            <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-900">
              <Camera className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold text-zinc-900">{activeRentalsCount}</span>
            <p className="text-[11px] text-zinc-500 mt-0.5">Cameras currently on shoot</p>
          </div>
        </div>

        {/* Ready for Pickup */}
        <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs flex flex-col justify-between hover:border-zinc-300 transition">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Ready for Pickup</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold text-zinc-900">{approvedPickupsCount}</span>
            <p className="text-[11px] text-zinc-500 mt-0.5">Approved counter reservations</p>
          </div>
        </div>

        {/* Pending Approval */}
        <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs flex flex-col justify-between hover:border-zinc-300 transition">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending Review</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-700">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold text-zinc-900">{pendingApprovalsCount}</span>
            <p className="text-[11px] text-zinc-500 mt-0.5">Awaiting staff confirmation</p>
          </div>
        </div>

        {/* Security Deposits Held */}
        <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs flex flex-col justify-between hover:border-zinc-300 transition">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Held Deposits</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-700">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <span className="text-2xl font-bold text-zinc-900">{formatPHP(totalHeldDeposit)}</span>
            <p className="text-[11px] text-zinc-500 mt-0.5">Refundable upon camera return</p>
          </div>
        </div>
      </div>

      {/* Main Grid: Active Shoots / Recent Bookings & Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Active Equipment & Recent Bookings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Shoots Banner if any */}
          {activeShoots.length > 0 && (
            <div className="bg-zinc-900 text-white rounded-xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <h3 className="text-sm font-bold tracking-tight text-white uppercase">
                    Active Rental Return Tracker
                  </h3>
                </div>
                <button
                  onClick={() => onNavigateTab('my-rentals')}
                  className="text-xs text-zinc-300 hover:text-white font-medium inline-flex items-center gap-1"
                >
                  <span>View Return Guidelines</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-3">
                {activeShoots.map((res) => (
                  <div
                    key={res.id}
                    className="bg-white/10 rounded-lg p-3.5 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-zinc-800 p-0.5 border border-zinc-700 flex items-center justify-center shrink-0">
                        <img
                          src={getCameraImageUrl(res.cameraId, res.cameraImageUrl)}
                          alt={res.cameraName}
                          className="w-full h-full object-contain"
                          loading="lazy"
                        />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white leading-tight">{res.cameraName}</p>
                        <p className="text-[11px] text-zinc-400">Ref: {res.referenceNo}</p>
                      </div>
                    </div>

                    <div className="text-left sm:text-right">
                      <p className="text-xs font-semibold text-amber-300 flex items-center gap-1 sm:justify-end">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Due: {formatDate(res.endDate)} (7:00 PM)</span>
                      </p>
                      <p className="text-[10px] text-zinc-400">IDIO J.C. Aquino Ave Branch</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Reservations Table/Card List */}
          <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div>
                <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-zinc-600" />
                  <span>Recent Reservations</span>
                </h3>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Latest rental requests and active booking records
                </p>
              </div>
              <button
                onClick={() => onNavigateTab('my-reservations')}
                className="text-xs text-zinc-700 hover:text-zinc-900 font-semibold inline-flex items-center gap-1"
              >
                <span>View All ({myReservations.length})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {myReservations.length === 0 ? (
              <div className="py-10 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mx-auto text-zinc-400">
                  <Camera className="w-6 h-6" />
                </div>
                <h4 className="text-xs font-bold text-zinc-900">No Reservations Yet</h4>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                  Ready to shoot? Explore our high-grade mirrorless and digital cameras available in Butuan City.
                </p>
                <button
                  onClick={() => onNavigateTab('catalog')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 transition"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Explore Camera Catalog</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {myReservations.slice(0, 4).map((res) => (
                  <div
                    key={res.id}
                    className="p-4 rounded-lg border border-zinc-100 hover:border-zinc-200 bg-zinc-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 rounded-lg bg-white border border-zinc-200 p-0.5 flex items-center justify-center shrink-0 shadow-2xs">
                        <img
                          src={getCameraImageUrl(res.cameraId, res.cameraImageUrl)}
                          alt={res.cameraName}
                          className="w-full h-full object-contain"
                          loading="lazy"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-zinc-900">{res.cameraName}</span>
                          <StatusBadge status={res.status} type="rental" />
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-0.5">
                          Ref: <span className="font-mono font-medium text-zinc-700">{res.referenceNo}</span> • {res.totalDays} day{res.totalDays > 1 ? 's' : ''} ({formatDate(res.startDate)} – {formatDate(res.endDate)})
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-0 border-zinc-200/60">
                      <div className="text-left sm:text-right">
                        <span className="text-xs font-bold text-zinc-900">{formatPHP(res.totalAmount)}</span>
                        <p className="text-[10px] text-zinc-500">{res.paymentMethod}</p>
                      </div>
                      <button
                        onClick={() => onNavigateTab('my-reservations')}
                        className="px-3 py-1.5 rounded-lg bg-white border border-zinc-200 hover:bg-zinc-100 text-zinc-800 text-xs font-medium transition"
                      >
                        Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Col: Recent Notifications & Branch Quick Info */}
        <div className="space-y-6">
          {/* Notifications Feed */}
          <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-2">
                <Bell className="w-4 h-4 text-zinc-600" />
                <span>Notifications</span>
              </h3>
              <button
                onClick={() => onNavigateTab('notifications')}
                className="text-xs text-zinc-600 hover:text-zinc-900 font-medium"
              >
                View Hub
              </button>
            </div>

            {notifications.length === 0 ? (
              <div className="py-8 text-center text-zinc-500 space-y-2">
                <Bell className="w-6 h-6 mx-auto text-zinc-300" />
                <p className="text-xs font-medium">All caught up!</p>
                <p className="text-[11px] text-zinc-400">No pending alerts at this time.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.slice(0, 4).map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => notif.actionTab && onNavigateTab(notif.actionTab)}
                    className="p-3 rounded-lg border border-zinc-100 hover:border-zinc-200 hover:bg-zinc-50 transition cursor-pointer space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-zinc-900 leading-tight">
                        {notif.title}
                      </span>
                      <span className={`w-2 h-2 rounded-full shrink-0 ${
                        notif.type === 'success' ? 'bg-emerald-500' :
                        notif.type === 'warning' ? 'bg-amber-500' :
                        notif.type === 'purple' ? 'bg-purple-500' : 'bg-zinc-400'
                      }`} />
                    </div>
                    <p className="text-[11px] text-zinc-600 leading-relaxed">
                      {notif.message}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Butuan City Store Service Card */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2 text-zinc-900 font-bold text-xs">
              <MapPin className="w-4 h-4 text-zinc-700" />
              <span>IDIO Butuan Hub Services</span>
            </div>
            <p className="text-[11px] text-zinc-600 leading-relaxed">
              <strong>Pickup &amp; Returns:</strong> Main Hub, J.C. Aquino Ave, Butuan City.
            </p>
            <div className="text-[11px] text-zinc-500 space-y-1 pt-1 border-t border-zinc-200">
              <p>• Mon–Sat: 8:00 AM – 7:00 PM</p>
              <p>• Sun: 9:00 AM – 5:00 PM</p>
              <p>• Inspection required on return before deposit release.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
