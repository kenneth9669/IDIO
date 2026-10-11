'use client';

import React, { useState, useMemo } from 'react';
import { useSystem } from '../../context/SystemContext';
import { StatusBadge } from '../common/StatusBadge';
import { formatPHP, formatDate, getCameraImageUrl } from '../../lib/utils';
import { RentalVoucherModal } from './RentalVoucherModal';
import {
  Camera,
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  Clock,
  RotateCcw,
  AlertCircle,
  MapPin,
  FileText,
  DollarSign,
  SlidersHorizontal,
  Coins,
  Package,
  Layers,
  ArrowRight
} from 'lucide-react';

export const CustomerRentalsAndPayments: React.FC<{ initialSubTab?: 'rentals' | 'payments' | 'deposits' }> = ({
  initialSubTab = 'rentals'
}) => {
  const { rentals, reservations, payments, currentUser } = useSystem();
  const [activeTab, setActiveTab] = useState<'rentals' | 'payments' | 'deposits'>(initialSubTab);
  const [selectedRentalForVoucher, setSelectedRentalForVoucher] = useState<any | null>(null);

  const customerId = currentUser.id;

  // Filter scoped rentals & reservations for active customer
  const customerRentals = useMemo(() => {
    return rentals.filter(r => r.customerId === customerId);
  }, [rentals, customerId]);

  const customerReservationsWithRentals = useMemo(() => {
    return reservations.filter(
      res => res.customerId === customerId && ['CHECKED_OUT', 'RETURNED', 'COMPLETED'].includes(res.status)
    );
  }, [reservations, customerId]);

  // Unified rentals
  const unifiedRentals = useMemo(() => {
    return customerReservationsWithRentals.map(res => {
      const matchedRental = customerRentals.find(r => r.reservationId === res.id);
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
        status: res.status,
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

  // Scoped payments list
  const customerPayments = useMemo(() => {
    const list = payments.filter(p => p.customerId === customerId);

    return reservations
      .filter(r => r.customerId === customerId)
      .map(r => {
        const existing = list.find(p => p.reservationId === r.id);
        if (existing) return existing;
        return {
          id: `pay-${r.id}`,
          reservationId: r.id,
          referenceNo: r.referenceNo,
          customerId: r.customerId,
          customerName: r.customerName,
          customerEmail: r.customerEmail,
          customerPhone: r.customerPhone,
          cameraName: r.cameraName,
          cameraSerial: r.cameraSerial,
          rentalAmount: r.subtotal,
          paymentMethod: r.paymentMethod,
          paymentStatus: r.paymentStatus,
          paymentReference: r.paymentReference,
          securityDeposit: r.securityDeposit,
          depositStatus: r.depositStatus,
          depositDeduction: r.depositDeduction,
          depositDeductionReason: r.depositNotes,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt
        };
      });
  }, [payments, reservations, customerId]);

  // Financial aggregates
  const totalPaidTariffs = customerPayments
    .filter(p => p.paymentStatus === 'PAID')
    .reduce((sum, p) => sum + p.rentalAmount, 0);

  const pendingTariffs = customerPayments
    .filter(p => p.paymentStatus === 'PENDING')
    .reduce((sum, p) => sum + p.rentalAmount, 0);

  const totalHeldDeposits = customerPayments
    .filter(p => p.depositStatus === 'HELD')
    .reduce((sum, p) => sum + p.securityDeposit, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-zinc-800" />
            My Rentals &amp; Payments
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Track active field equipment, cash payment receipts, and refundable security deposit escrow.
          </p>
        </div>

        {/* Sub-tab Navigation */}
        <div className="flex items-center p-1 bg-zinc-100 rounded-lg border border-zinc-200 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('rentals')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'rentals'
                ? 'bg-white text-zinc-900 shadow-xs font-semibold'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            Field Rentals ({unifiedRentals.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('payments')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'payments'
                ? 'bg-white text-zinc-900 shadow-xs font-semibold'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <Coins className="w-3.5 h-3.5" />
            Cash Invoices &amp; Receipts
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('deposits')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'deposits'
                ? 'bg-white text-zinc-900 shadow-xs font-semibold'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Security Deposit Escrow
          </button>
        </div>
      </div>

      {/* Financial Metric Overview Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white border border-zinc-200 rounded-xl space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
            <span>Settled Rental Payments</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-zinc-900">{formatPHP(totalPaidTariffs)}</p>
          <span className="text-[11px] text-zinc-400">Verified cash payments at counter</span>
        </div>

        <div className="p-4 bg-white border border-zinc-200 rounded-xl space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
            <span>Pending Cash on Pickup</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-600">{formatPHP(pendingTariffs)}</p>
          <span className="text-[11px] text-zinc-400">Due upon camera collection</span>
        </div>

        <div className="p-4 bg-white border border-zinc-200 rounded-xl space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
            <span>Held Security Deposits</span>
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-bold text-indigo-600">{formatPHP(totalHeldDeposits)}</p>
          <span className="text-[11px] text-zinc-400">Refundable upon return inspection</span>
        </div>
      </div>

      {/* TAB 1: FIELD RENTALS */}
      {activeTab === 'rentals' && (
        <div className="space-y-4">
          {unifiedRentals.length === 0 ? (
            <div className="p-12 bg-white border border-zinc-200 rounded-xl text-center space-y-3">
              <Camera className="w-10 h-10 text-zinc-300 mx-auto" />
              <h3 className="text-sm font-bold text-zinc-900">No In-Field Rentals Yet</h3>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                When an approved reservation is checked out by the administrator at our Butuan hub, your active rental equipment will appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {unifiedRentals.map(rental => (
                <div
                  key={rental.id}
                  className="p-5 bg-white border border-zinc-200 rounded-xl shadow-xs space-y-4 hover:border-zinc-300 transition"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-100">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-zinc-100 rounded-lg p-1.5 flex items-center justify-center shrink-0">
                        <img
                          src={getCameraImageUrl(rental.cameraId, rental.cameraImageUrl)}
                          alt={rental.cameraName}
                          className="w-full h-full object-contain mix-blend-multiply"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-zinc-900">{rental.cameraName}</h3>
                          <span className="font-mono text-[11px] text-zinc-400 bg-zinc-50 px-1.5 py-0.5 rounded border border-zinc-100">
                            SN: {rental.cameraSerial}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500">Ref: {rental.referenceNo}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      <StatusBadge status={rental.status} size="sm" />
                      <button
                        type="button"
                        onClick={() => setSelectedRentalForVoucher(rental)}
                        className="px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 text-xs font-medium text-zinc-700 inline-flex items-center gap-1 transition cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Rental Voucher</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-zinc-400 block">Rental Duration</span>
                      <p className="font-semibold text-zinc-900 mt-0.5">
                        {formatDate(rental.startDate)} → {formatDate(rental.endDate)} ({rental.totalDays} days)
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-zinc-400 block">Handover Inspection</span>
                      <p className="font-semibold text-zinc-900 mt-0.5">
                        Condition: {rental.checkoutCondition}
                      </p>
                      <p className="text-[11px] text-zinc-500">Checked out by: {rental.checkoutAdminName}</p>
                    </div>

                    <div>
                      <span className="text-[10px] uppercase font-bold text-zinc-400 block">Deposit Escrow</span>
                      <p className="font-semibold text-indigo-600 mt-0.5">{formatPHP(rental.securityDeposit)}</p>
                      <span className="text-[10px] text-zinc-400">Status: {rental.depositStatus}</span>
                    </div>
                  </div>

                  {rental.returnInspectionNotes && (
                    <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-100 text-xs space-y-1">
                      <span className="font-bold text-zinc-700 block">Return Inspection Record:</span>
                      <p className="text-zinc-600">{rental.returnInspectionNotes}</p>
                      {rental.returnedAt && (
                        <p className="text-[11px] text-zinc-400">Recorded: {formatDate(rental.returnedAt)} by {rental.returnAdminName || 'Admin'}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CASH INVOICES & RECEIPTS */}
      {activeTab === 'payments' && (
        <div className="space-y-4">
          <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl flex items-start gap-3">
            <Coins className="w-5 h-5 text-zinc-800 shrink-0 mt-0.5" />
            <div className="text-xs text-zinc-600 space-y-1">
              <h4 className="font-bold text-zinc-900">Cash on Counter Pickup Workflow</h4>
              <p>
                All new camera rentals are paid in cash at our <strong>Butuan City counter (J.C. Aquino Ave)</strong> upon camera inspection and release. The counter administrator will verify cash payment and issue an official receipt.
              </p>
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-600">
                <thead className="bg-zinc-50 text-[10px] uppercase font-bold text-zinc-400 border-b border-zinc-200 tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Booking Ref</th>
                    <th className="py-3 px-4">Camera Asset</th>
                    <th className="py-3 px-4">Rental Tariff</th>
                    <th className="py-3 px-4">Payment Method</th>
                    <th className="py-3 px-4">Payment Status</th>
                    <th className="py-3 px-4">Reference / Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {customerPayments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-zinc-400 text-xs">
                        No payment records found.
                      </td>
                    </tr>
                  ) : (
                    customerPayments.map(pay => (
                      <tr key={pay.id} className="hover:bg-zinc-50/80 transition">
                        <td className="py-3 px-4 font-mono font-bold text-zinc-900">{pay.referenceNo}</td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-zinc-800">{pay.cameraName}</span>
                          <span className="block font-mono text-[10px] text-zinc-400">SN: {pay.cameraSerial}</span>
                        </td>
                        <td className="py-3 px-4 font-bold text-zinc-900">{formatPHP(pay.rentalAmount)}</td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-zinc-100 text-zinc-700">
                            {pay.paymentMethod === 'CASH_PICKUP' ? 'Cash on Pickup' : pay.paymentMethod}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <StatusBadge status={pay.paymentStatus} size="sm" />
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-zinc-500">
                          {pay.paymentReference || '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SECURITY DEPOSIT ESCROW */}
      {activeTab === 'deposits' && (
        <div className="space-y-4">
          <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
            <div className="text-xs text-zinc-600 space-y-1">
              <h4 className="font-bold text-zinc-900">Security Deposit Protection Policy</h4>
              <p>
                Security deposits are held in escrow during your rental period. Upon return and physical inspection (optical sensor, lens glass, controls), the full deposit is refunded unless physical damage is detected.
              </p>
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-600">
                <thead className="bg-zinc-50 text-[10px] uppercase font-bold text-zinc-400 border-b border-zinc-200 tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Booking Ref</th>
                    <th className="py-3 px-4">Camera Asset</th>
                    <th className="py-3 px-4">Escrow Amount</th>
                    <th className="py-3 px-4">Deposit Status</th>
                    <th className="py-3 px-4">Deductions</th>
                    <th className="py-3 px-4">Settlement Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {customerPayments.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-zinc-400 text-xs">
                        No security deposit records found.
                      </td>
                    </tr>
                  ) : (
                    customerPayments.map(pay => (
                      <tr key={pay.id} className="hover:bg-zinc-50/80 transition">
                        <td className="py-3 px-4 font-mono font-bold text-zinc-900">{pay.referenceNo}</td>
                        <td className="py-3 px-4 font-semibold text-zinc-800">{pay.cameraName}</td>
                        <td className="py-3 px-4 font-bold text-indigo-600">{formatPHP(pay.securityDeposit)}</td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <StatusBadge status={pay.depositStatus} size="sm" />
                        </td>
                        <td className="py-3 px-4 text-rose-600 font-semibold">
                          {pay.depositDeduction ? formatPHP(pay.depositDeduction) : '₱0'}
                        </td>
                        <td className="py-3 px-4 text-zinc-500 text-[11px]">
                          {pay.depositDeductionReason || (pay.depositStatus === 'REFUNDED' ? 'Refunded in full' : 'Held in escrow')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Rental Voucher Modal */}
      {selectedRentalForVoucher && (
        <RentalVoucherModal
          reservation={selectedRentalForVoucher}
          isOpen={!!selectedRentalForVoucher}
          onClose={() => setSelectedRentalForVoucher(null)}
        />
      )}
    </div>
  );
};
