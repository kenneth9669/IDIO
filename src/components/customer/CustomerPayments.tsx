'use client';
import React, { useState, useMemo } from 'react';
import { useSystem } from '../../context/SystemContext';
import { PaymentAndDeposit } from '../../types';
import { formatPHP, formatDate } from '../../lib/utils';
import {
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  Clock,
  RotateCcw,
  AlertCircle,
  QrCode,
  MapPin,
  FileText,
  DollarSign,
  Layers,
  Sparkles
} from 'lucide-react';

export const CustomerPayments: React.FC = () => {
  const { payments, reservations, currentUser } = useSystem();
  const [filterMethod, setFilterMethod] = useState<string>('ALL');

  const customerId = currentUser.id;

  // Scoped payments for this customer (strictly scoped to verified user ID)
  const customerPayments = useMemo(() => {
    if (!customerId) return [];
    // Also build records from reservations if payments table is empty or missing reservations
    const list = payments.filter((p) => p.customerId === customerId);

    // If reservation has payment info not yet synced to payments array
    const reservationPayments: PaymentAndDeposit[] = reservations
      .filter((r) => r.customerId === customerId)
      .map((r) => {
        const existing = list.find((p) => p.reservationId === r.id);
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

    return reservationPayments;
  }, [payments, reservations, customerId]);

  const filteredPayments = useMemo(() => {
    if (filterMethod === 'ALL') return customerPayments;
    return customerPayments.filter((p) => p.paymentMethod === filterMethod);
  }, [customerPayments, filterMethod]);

  // Aggregate financial metrics
  const totalPaidTariffs = customerPayments
    .filter((p) => p.paymentStatus === 'PAID')
    .reduce((sum, p) => sum + p.rentalAmount, 0);

  const totalHeldDeposits = customerPayments
    .filter((p) => p.depositStatus === 'HELD')
    .reduce((sum, p) => sum + p.securityDeposit, 0);

  const totalRefundedDeposits = customerPayments
    .filter((p) => p.depositStatus === 'REFUNDED')
    .reduce((sum, p) => sum + p.securityDeposit, 0);

  const totalDeductions = customerPayments
    .filter((p) => p.depositStatus === 'DEDUCTED')
    .reduce((sum, p) => sum + (p.depositDeduction || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-zinc-700" />
            <span>Payments &amp; Security Deposits Ledger</span>
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Review your rental payments, GCash/Maya transfer references, and security deposit escrow accounts.
          </p>
        </div>

        {/* Filter by Payment Method */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-500 font-medium">Method:</label>
          <select
            value={filterMethod}
            onChange={(e) => setFilterMethod(e.target.value)}
            className="bg-white border border-zinc-300 rounded-lg px-3 py-1.5 text-xs text-zinc-800 font-medium focus:outline-none focus:ring-1 focus:ring-zinc-900"
          >
            <option value="ALL">All Methods</option>
            <option value="CASH_PICKUP">Cash on Counter Pickup (Active)</option>
            <option value="GCASH">GCash (Historical)</option>
            <option value="MAYA">Maya (Historical)</option>
            <option value="BANK_TRANSFER">Bank Transfer (Historical)</option>
          </select>
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Paid Tariffs</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xl font-bold text-zinc-900">{formatPHP(totalPaidTariffs)}</p>
          <p className="text-[10px] text-zinc-500 mt-0.5">Settled rental fees</p>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Held in Escrow</span>
            <ShieldCheck className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-xl font-bold text-zinc-900">{formatPHP(totalHeldDeposits)}</p>
          <p className="text-[10px] text-zinc-500 mt-0.5">Refundable upon return</p>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Refunded Deposits</span>
            <RotateCcw className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-xl font-bold text-zinc-900">{formatPHP(totalRefundedDeposits)}</p>
          <p className="text-[10px] text-zinc-500 mt-0.5">Returned to customer</p>
        </div>

        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Damage Deductions</span>
            <AlertCircle className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-xl font-bold text-zinc-900">{formatPHP(totalDeductions)}</p>
          <p className="text-[10px] text-zinc-500 mt-0.5">Assessed for repair</p>
        </div>
      </div>

      {/* Payment Records Table & Cards */}
      {filteredPayments.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-zinc-200 p-8 space-y-3">
          <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mx-auto text-zinc-400">
            <CreditCard className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-zinc-900">No Payment Records</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            You don&apos;t have any payment transactions yet. When you book a digital camera, your payment and deposit status will appear here.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-600">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                <tr>
                  <th className="px-5 py-3">Reservation / Camera</th>
                  <th className="px-5 py-3">Rental Tariff</th>
                  <th className="px-5 py-3">Payment Method</th>
                  <th className="px-5 py-3">Payment Status</th>
                  <th className="px-5 py-3">Security Deposit</th>
                  <th className="px-5 py-3">Deposit Status</th>
                  <th className="px-5 py-3">Reference / Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredPayments.map((pay) => (
                  <tr key={pay.id} className="hover:bg-zinc-50/50 transition">
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-zinc-900">{pay.cameraName || 'Digital Camera'}</div>
                      <div className="text-[11px] font-mono text-zinc-500">Ref: {pay.referenceNo}</div>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-zinc-900">
                      {formatPHP(pay.rentalAmount)}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1 font-medium text-zinc-700 bg-zinc-100 px-2 py-0.5 rounded text-[11px]">
                        {pay.paymentMethod}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                          pay.paymentStatus === 'PAID'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : pay.paymentStatus === 'REFUNDED'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {pay.paymentStatus === 'PAID' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {pay.paymentStatus}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-zinc-900">
                      {formatPHP(pay.securityDeposit)}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                          pay.depositStatus === 'REFUNDED'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : pay.depositStatus === 'HELD'
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {pay.depositStatus}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-zinc-500">
                      <div className="font-mono text-[11px] text-zinc-700 truncate max-w-[140px]">
                        {pay.paymentReference || '—'}
                      </div>
                      <div className="text-[10px] text-zinc-400">{formatDate(pay.createdAt)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Security Deposit & Payment Policies Note */}
      <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-5 text-xs text-zinc-600 space-y-2">
        <h4 className="font-bold text-zinc-900 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-zinc-700" />
          <span>IDIO Butuan Payment &amp; Escrow Security Guarantee</span>
        </h4>
        <p className="leading-relaxed">
          • <strong>Manual Counter Verification:</strong> All GCash, Maya, and Bank Transfer payments are verified manually by counter staff upon digital voucher presentation.
        </p>
        <p className="leading-relaxed">
          • <strong>Deposit Escrow:</strong> Security deposits are held securely in escrow during the rental period and refunded immediately upon return inspection.
        </p>
      </div>
    </div>
  );
};
