'use client';
import React, { useState, useMemo } from 'react';
import { useSystem } from '../../context/SystemContext';
import { formatPHP, formatDate } from '../../lib/utils';
import {
  Bell,
  CheckCircle2,
  Clock,
  ShieldCheck,
  AlertCircle,
  Camera,
  CreditCard,
  Package,
  ArrowRight,
  Filter,
  Check
} from 'lucide-react';

interface CustomerNotificationsProps {
  onNavigateTab: (tab: string) => void;
}

export const CustomerNotifications: React.FC<CustomerNotificationsProps> = ({ onNavigateTab }) => {
  const { reservations, payments, rentals, currentUser } = useSystem();
  const [filterType, setFilterType] = useState<string>('ALL');

  const customerId = currentUser.id;

  // Derive notifications from authorized user records
  const myReservations = useMemo(() => {
    return reservations.filter((r) => r.customerId === customerId);
  }, [reservations, customerId]);

  const myPayments = useMemo(() => {
    return payments.filter((p) => p.customerId === customerId);
  }, [payments, customerId]);

  const allNotifications = useMemo(() => {
    const list: {
      id: string;
      category: 'APPROVAL' | 'RETURN_DUE' | 'PAYMENT' | 'DEPOSIT' | 'SYSTEM';
      title: string;
      message: string;
      date: string;
      severity: 'success' | 'warning' | 'info' | 'purple';
      actionLabel: string;
      actionTab: string;
    }[] = [];

    // 1. Approved Reservations
    myReservations
      .filter((r) => r.status === 'APPROVED')
      .forEach((r) => {
        list.push({
          id: `notif-app-${r.id}`,
          category: 'APPROVAL',
          title: 'Reservation Approved & Ready for Pickup',
          message: `Your booking for ${r.cameraName} (Ref: ${r.referenceNo}) has been approved. Pickup is scheduled at our J.C. Aquino Ave branch on ${formatDate(r.startDate)}.`,
          date: r.updatedAt || r.createdAt,
          severity: 'success',
          actionLabel: 'View Claim Voucher',
          actionTab: 'my-reservations'
        });
      });

    // 2. Active in-field rentals return due
    myReservations
      .filter((r) => r.status === 'CHECKED_OUT')
      .forEach((r) => {
        list.push({
          id: `notif-ret-${r.id}`,
          category: 'RETURN_DUE',
          title: 'Camera In-Field — Return Notice',
          message: `${r.cameraName} (Ref: ${r.referenceNo}) is due for return on ${formatDate(r.endDate)} before 7:00 PM at IDIO Butuan. Please include all kit accessories.`,
          date: r.startDate,
          severity: 'warning',
          actionLabel: 'View Return Guidelines',
          actionTab: 'my-rentals'
        });
      });

    // 3. Pending Review Reservations
    myReservations
      .filter((r) => r.status === 'PENDING_APPROVAL')
      .forEach((r) => {
        list.push({
          id: `notif-pen-${r.id}`,
          category: 'SYSTEM',
          title: 'Reservation Request Received',
          message: `Your request for ${r.cameraName} (${formatDate(r.startDate)} – ${formatDate(r.endDate)}) has been queued for counter verification.`,
          date: r.createdAt,
          severity: 'info',
          actionLabel: 'View Reservation Status',
          actionTab: 'my-reservations'
        });
      });

    // 4. Completed Rentals
    myReservations
      .filter((r) => r.status === 'COMPLETED')
      .forEach((r) => {
        list.push({
          id: `notif-comp-${r.id}`,
          category: 'APPROVAL',
          title: 'Rental Completed & Inspected',
          message: `Your rental for ${r.cameraName} (Ref: ${r.referenceNo}) is completed. Optical inspection passed and deposit settlement is finalized.`,
          date: r.updatedAt || r.createdAt,
          severity: 'success',
          actionLabel: 'View Inspection Details',
          actionTab: 'my-rentals'
        });
      });

    // 5. Deposit refunds & settlements
    myPayments
      .filter((p) => p.depositStatus === 'REFUNDED')
      .forEach((p) => {
        list.push({
          id: `notif-dep-ref-${p.id}`,
          category: 'DEPOSIT',
          title: 'Security Deposit Refund Processed',
          message: `Security deposit of ${formatPHP(p.securityDeposit)} for ${p.cameraName || 'your camera'} was refunded in full following return inspection.`,
          date: p.settledAt || p.updatedAt,
          severity: 'purple',
          actionLabel: 'View Payment Ledger',
          actionTab: 'payments'
        });
      });

    // Sort newest first
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [myReservations, myPayments]);

  const filteredNotifications = useMemo(() => {
    if (filterType === 'ALL') return allNotifications;
    return allNotifications.filter((n) => n.category === filterType);
  }, [allNotifications, filterType]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900 flex items-center gap-2">
            <Bell className="w-5 h-5 text-zinc-700" />
            <span>Customer Notifications &amp; Alerts</span>
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Real-time updates regarding your reservations, counter approvals, return deadlines, and deposit releases.
          </p>
        </div>

        {/* Filter categories */}
        <div className="flex items-center p-1 bg-zinc-100 border border-zinc-200 rounded-lg text-xs self-start sm:self-auto">
          <button
            onClick={() => setFilterType('ALL')}
            className={`px-3 py-1.5 rounded-md font-medium transition ${
              filterType === 'ALL'
                ? 'bg-white text-zinc-900 shadow-xs font-semibold'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            All ({allNotifications.length})
          </button>
          <button
            onClick={() => setFilterType('APPROVAL')}
            className={`px-3 py-1.5 rounded-md font-medium transition ${
              filterType === 'APPROVAL'
                ? 'bg-white text-zinc-900 shadow-xs font-semibold'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            Approvals
          </button>
          <button
            onClick={() => setFilterType('RETURN_DUE')}
            className={`px-3 py-1.5 rounded-md font-medium transition ${
              filterType === 'RETURN_DUE'
                ? 'bg-white text-zinc-900 shadow-xs font-semibold'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            Returns Due
          </button>
          <button
            onClick={() => setFilterType('DEPOSIT')}
            className={`px-3 py-1.5 rounded-md font-medium transition ${
              filterType === 'DEPOSIT'
                ? 'bg-white text-zinc-900 shadow-xs font-semibold'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            Deposits
          </button>
        </div>
      </div>

      {/* Notifications List */}
      {filteredNotifications.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-zinc-200 p-8 space-y-3">
          <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mx-auto text-zinc-400">
            <Bell className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-zinc-900">No Notifications</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            You are all caught up. Notifications regarding your camera bookings, status changes, and returns will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((notif) => (
            <div
              key={notif.id}
              className="bg-white border border-zinc-200 rounded-xl p-5 hover:border-zinc-300 transition shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    notif.severity === 'success'
                      ? 'bg-emerald-50 text-emerald-700'
                      : notif.severity === 'warning'
                        ? 'bg-amber-50 text-amber-700'
                        : notif.severity === 'purple'
                          ? 'bg-purple-50 text-purple-700'
                          : 'bg-zinc-100 text-zinc-700'
                  }`}
                >
                  {notif.severity === 'success' ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : notif.severity === 'warning' ? (
                    <Clock className="w-4 h-4" />
                  ) : notif.severity === 'purple' ? (
                    <ShieldCheck className="w-4 h-4" />
                  ) : (
                    <Bell className="w-4 h-4" />
                  )}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-zinc-900">{notif.title}</h4>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      {formatDate(notif.date)}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-600 leading-relaxed max-w-2xl">
                    {notif.message}
                  </p>
                </div>
              </div>

              <button
                onClick={() => onNavigateTab(notif.actionTab)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-800 text-xs font-semibold self-start sm:self-center transition shrink-0"
              >
                <span>{notif.actionLabel}</span>
                <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
