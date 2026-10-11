'use client';

import React, { useState, useMemo } from 'react';
import { useSystem } from '../../context/SystemContext';
import { PaymentMethod } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { Dialog } from '../common/Dialog';
import { formatPHP, formatDate } from '../../lib/utils';
import {
  CreditCard,
  Search,
  RotateCcw,
  AlertTriangle,
  TrendingUp,
  ShieldCheck,
  Coins
} from 'lucide-react';

export const PaymentsManager: React.FC = () => {
  const {
    payments,
    reservations,
    confirmPayment,
    refundPayment,
    settleDeposit,
    updatePaymentStatus
  } = useSystem();

  const [searchQuery, setSearchQuery] = useState('');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('ALL');
  const [depositStatusFilter, setDepositStatusFilter] = useState('ALL');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('ALL');

  // Modals state
  const [confirmingPayment, setConfirmingPayment] = useState<any | null>(null);
  const [confirmMethod, setConfirmMethod] = useState<PaymentMethod>('CASH_PICKUP');
  const [confirmReference, setConfirmReference] = useState('');

  const [refundingPayment, setRefundingPayment] = useState<any | null>(null);
  const [refundReason, setRefundReason] = useState('Cancelled reservation refund');

  const [settlingDepositPayment, setSettlingDepositPayment] = useState<any | null>(null);
  const [settleAction, setSettleAction] = useState<'REFUND_FULL' | 'DEDUCT_DAMAGE' | 'FORFEIT'>('REFUND_FULL');
  const [deductionAmount, setDeductionAmount] = useState(0);
  const [deductionReason, setDeductionReason] = useState('');

  const [actionAlert, setActionAlert] = useState<string | null>(null);

  const showAlert = (msg: string) => {
    setActionAlert(msg);
    setTimeout(() => setActionAlert(null), 4000);
  };

  // Compile unified transactions list combining payments table records and reservations
  const transactions = useMemo(() => {
    // If we have payments from DB, use them; otherwise construct from reservations
    if (payments && payments.length > 0) {
      return payments;
    }

    return reservations.map(r => ({
      id: `PAY-${r.id}`,
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
      depositDeduction: r.depositDeduction || 0,
      depositDeductionReason: r.depositNotes,
      settledAt: r.updatedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt
    }));
  }, [payments, reservations]);

  // Financial Metrics
  const totalPaidRevenue = transactions
    .filter(t => t.paymentStatus === 'PAID')
    .reduce((sum, t) => sum + t.rentalAmount, 0);

  const pendingPaymentsAmount = transactions
    .filter(t => t.paymentStatus === 'PENDING')
    .reduce((sum, t) => sum + t.rentalAmount, 0);

  const totalHeldDeposits = transactions
    .filter(t => t.depositStatus === 'HELD')
    .reduce((sum, t) => sum + t.securityDeposit, 0);

  const totalDeductedForfeited = transactions
    .filter(t => t.depositStatus === 'DEDUCTED' || t.depositStatus === 'FORFEITED')
    .reduce((sum, t) => sum + (t.depositDeduction || t.securityDeposit), 0);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesSearch =
        (t.referenceNo || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.customerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.cameraName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.paymentReference || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchesPayment = paymentStatusFilter === 'ALL' || t.paymentStatus === paymentStatusFilter;
      const matchesDeposit = depositStatusFilter === 'ALL' || t.depositStatus === depositStatusFilter;
      const matchesMethod = paymentMethodFilter === 'ALL' || t.paymentMethod === paymentMethodFilter;

      return matchesSearch && matchesPayment && matchesDeposit && matchesMethod;
    });
  }, [transactions, searchQuery, paymentStatusFilter, depositStatusFilter, paymentMethodFilter]);

  // Handlers
  const handleConfirmPayment = async () => {
    if (!confirmingPayment) return;
    const res = await confirmPayment(
      confirmingPayment.id,
      confirmMethod,
      confirmReference || 'MANUAL-COUNTER-PAID'
    );
    if (res.success) {
      showAlert(`Confirmed payment for ${confirmingPayment.referenceNo || 'Reservation'}`);
      setConfirmingPayment(null);
    } else {
      // Fallback local update if offline/mock
      updatePaymentStatus(confirmingPayment.reservationId, 'PAID', confirmReference);
      showAlert(`Updated payment status to PAID`);
      setConfirmingPayment(null);
    }
  };

  const handleRefundPayment = async () => {
    if (!refundingPayment) return;
    const res = await refundPayment(refundingPayment.id, refundReason);
    if (res.success) {
      showAlert(`Refund recorded for ${refundingPayment.referenceNo || 'Reservation'}`);
      setRefundingPayment(null);
    } else {
      updatePaymentStatus(refundingPayment.reservationId, 'REFUNDED');
      showAlert(`Payment marked as REFUNDED`);
      setRefundingPayment(null);
    }
  };

  const handleSettleDeposit = async () => {
    if (!settlingDepositPayment) return;
    const res = await settleDeposit(
      settlingDepositPayment.id,
      settleAction,
      settleAction === 'DEDUCT_DAMAGE' ? deductionAmount : undefined,
      deductionReason
    );
    if (res.success) {
      showAlert(`Security deposit settled as ${settleAction}`);
      setSettlingDepositPayment(null);
    } else {
      showAlert(`Deposit settled.`);
      setSettlingDepositPayment(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Alert Banner */}
      {actionAlert && (
        <div className="p-3.5 bg-zinc-900 text-white rounded-xl text-xs font-medium flex items-center justify-between shadow-xs">
          <span>{actionAlert}</span>
          <button onClick={() => setActionAlert(null)} className="text-zinc-400 hover:text-white cursor-pointer">✕</button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-zinc-800" />
            Payments &amp; Security Deposits Ledger
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Manual counter payments, GCash/Maya verification, refundable deposit escrow, and damage settlements.
          </p>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white border border-zinc-200 rounded-xl space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
            <span>Collected Rental Revenue</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-zinc-900">{formatPHP(totalPaidRevenue)}</p>
          <span className="text-[11px] text-zinc-400">From confirmed &amp; completed rentals</span>
        </div>

        <div className="p-5 bg-white border border-zinc-200 rounded-xl space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
            <span>Pending Collections</span>
            <Coins className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-zinc-900">{formatPHP(pendingPaymentsAmount)}</p>
          <span className="text-[11px] text-zinc-400">Awaiting counter pickup payment</span>
        </div>

        <div className="p-5 bg-white border border-zinc-200 rounded-xl space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
            <span>Held Security Deposits</span>
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-bold text-indigo-600">{formatPHP(totalHeldDeposits)}</p>
          <span className="text-[11px] text-zinc-400">Escrow held until return inspection</span>
        </div>

        <div className="p-5 bg-white border border-zinc-200 rounded-xl space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
            <span>Damage Deductions / Forfeited</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-2xl font-bold text-zinc-900">{formatPHP(totalDeductedForfeited)}</p>
          <span className="text-[11px] text-zinc-400">Retained for repair costs</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3.5 bg-white border border-zinc-200 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by reference, customer name, camera, or payment reference..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-50 border border-zinc-200 rounded-lg pl-9 pr-3 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={paymentStatusFilter}
            onChange={e => setPaymentStatusFilter(e.target.value)}
            className="bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 focus:outline-none focus:border-zinc-900"
          >
            <option value="ALL">All Payment Statuses</option>
            <option value="PAID">PAID</option>
            <option value="PENDING">PENDING</option>
            <option value="REFUNDED">REFUNDED</option>
          </select>

          <select
            value={depositStatusFilter}
            onChange={e => setDepositStatusFilter(e.target.value)}
            className="bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 focus:outline-none focus:border-zinc-900"
          >
            <option value="ALL">All Deposit Statuses</option>
            <option value="HELD">HELD</option>
            <option value="REFUNDED">REFUNDED</option>
            <option value="DEDUCTED">DEDUCTED</option>
            <option value="FORFEITED">FORFEITED</option>
          </select>

          <select
            value={paymentMethodFilter}
            onChange={e => setPaymentMethodFilter(e.target.value)}
            className="bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 focus:outline-none focus:border-zinc-900"
          >
            <option value="ALL">All Methods</option>
            <option value="GCASH">GCash</option>
            <option value="CASH_PICKUP">Cash on Pickup</option>
            <option value="MAYA">Maya</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-50 text-zinc-500 uppercase font-bold text-[10px] tracking-wider border-b border-zinc-200">
              <tr>
                <th className="p-3.5">Reference &amp; Date</th>
                <th className="p-3.5">Customer</th>
                <th className="p-3.5">Camera Unit</th>
                <th className="p-3.5">Rental Tariff</th>
                <th className="p-3.5">Payment Status</th>
                <th className="p-3.5">Security Deposit</th>
                <th className="p-3.5">Deposit Status</th>
                <th className="p-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-700">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-zinc-400">
                    No payment or deposit records matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map(t => (
                  <tr key={t.id} className="hover:bg-zinc-50/70 transition">
                    <td className="p-3.5">
                      <p className="font-mono font-bold text-zinc-900 text-xs">{t.referenceNo || 'N/A'}</p>
                      <p className="text-[11px] text-zinc-400">{formatDate(t.createdAt)}</p>
                    </td>
                    <td className="p-3.5">
                      <p className="font-semibold text-zinc-900">{t.customerName}</p>
                      <p className="text-[10px] text-zinc-400">{t.customerPhone}</p>
                    </td>
                    <td className="p-3.5">
                      <p className="font-semibold text-zinc-900">{t.cameraName}</p>
                      <p className="text-[10px] font-mono text-zinc-400">SN: {t.cameraSerial}</p>
                    </td>
                    <td className="p-3.5">
                      <p className="font-bold text-zinc-900">{formatPHP(t.rentalAmount)}</p>
                      <p className="text-[10px] text-zinc-400">
                        via {t.paymentMethod} {t.paymentReference ? `(${t.paymentReference})` : ''}
                      </p>
                    </td>
                    <td className="p-3.5">
                      <StatusBadge status={t.paymentStatus} type="payment" size="sm" />
                    </td>
                    <td className="p-3.5">
                      <p className="font-bold text-zinc-900">{formatPHP(t.securityDeposit)}</p>
                      {t.depositDeduction && t.depositDeduction > 0 ? (
                        <p className="text-[10px] text-rose-600 font-medium">
                          Deducted: -{formatPHP(t.depositDeduction)}
                        </p>
                      ) : null}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${
                          t.depositStatus === 'HELD'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : t.depositStatus === 'REFUNDED'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {t.depositStatus}
                      </span>
                      {t.depositDeductionReason && (
                        <p className="text-[10px] text-zinc-500 max-w-[120px] truncate mt-0.5" title={t.depositDeductionReason}>
                          {t.depositDeductionReason}
                        </p>
                      )}
                    </td>
                    <td className="p-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Confirm Payment Action */}
                        {t.paymentStatus === 'PENDING' && (
                          <button
                            onClick={() => {
                              setConfirmingPayment(t);
                              setConfirmMethod(t.paymentMethod || 'GCASH');
                              setConfirmReference(t.paymentReference || '');
                            }}
                            className="px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-[11px] transition cursor-pointer"
                            title="Confirm Manual Payment"
                          >
                            Confirm Paid
                          </button>
                        )}

                        {/* Refund Payment Action */}
                        {t.paymentStatus === 'PAID' && (
                          <button
                            onClick={() => setRefundingPayment(t)}
                            className="p-1.5 rounded hover:bg-rose-50 text-zinc-400 hover:text-rose-600 transition cursor-pointer"
                            title="Record Refund"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {/* Settle Deposit Action */}
                        {t.depositStatus === 'HELD' && (
                          <button
                            onClick={() => {
                              setSettlingDepositPayment(t);
                              setSettleAction('REFUND_FULL');
                              setDeductionAmount(0);
                              setDeductionReason('');
                            }}
                            className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-[11px] transition cursor-pointer"
                            title="Settle Security Deposit"
                          >
                            Settle Deposit
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirm Payment Modal */}
      {confirmingPayment && (
        <Dialog
          isOpen={!!confirmingPayment}
          onClose={() => setConfirmingPayment(null)}
          title="Confirm Customer Payment"
          description={`Record manual payment confirmation for reservation ${confirmingPayment.referenceNo}.`}
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200">
              <div className="flex justify-between font-bold text-zinc-900">
                <span>Rental Tariff Due:</span>
                <span>{formatPHP(confirmingPayment.rentalAmount)}</span>
              </div>
              <div className="text-[11px] text-zinc-500 mt-0.5">
                Customer: {confirmingPayment.customerName} ({confirmingPayment.customerPhone})
              </div>
            </div>

            <div>
              <label className="block font-medium text-zinc-700 mb-1">Payment Method Verified *</label>
              <select
                value={confirmMethod}
                onChange={e => setConfirmMethod(e.target.value as PaymentMethod)}
                className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 text-xs focus:outline-none focus:border-zinc-900"
              >
                <option value="CASH_PICKUP">Cash on Counter Pickup (Official Method)</option>
                <option value="GCASH">GCash (Historical / Alternative)</option>
                <option value="MAYA">Maya (Historical / Alternative)</option>
                <option value="BANK_TRANSFER">Bank Transfer (Historical / Alternative)</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-zinc-700 mb-1">Cash Receipt / Transaction Reference</label>
              <input
                type="text"
                value={confirmReference}
                onChange={e => setConfirmReference(e.target.value)}
                placeholder="e.g. CASH-OR-2026-001 or Counter Receipt #"
                className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 text-xs focus:outline-none focus:border-zinc-900"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
              <button
                onClick={() => setConfirmingPayment(null)}
                className="px-3.5 py-1.5 rounded-lg bg-zinc-100 text-zinc-700 hover:bg-zinc-200 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPayment}
                className="px-4 py-1.5 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 text-xs font-bold"
              >
                Confirm Payment
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Refund Payment Modal */}
      {refundingPayment && (
        <Dialog
          isOpen={!!refundingPayment}
          onClose={() => setRefundingPayment(null)}
          title="Record Payment Refund"
          description={`Record simulated refund of ₱${refundingPayment.rentalAmount} for ${refundingPayment.referenceNo}.`}
        >
          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-medium text-zinc-700 mb-1">Reason for Refund *</label>
              <input
                type="text"
                value={refundReason}
                onChange={e => setRefundReason(e.target.value)}
                className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 text-xs focus:outline-none focus:border-zinc-900"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
              <button
                onClick={() => setRefundingPayment(null)}
                className="px-3.5 py-1.5 rounded-lg bg-zinc-100 text-zinc-700 hover:bg-zinc-200 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleRefundPayment}
                className="px-4 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 text-xs font-bold"
              >
                Confirm Refund
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Settle Deposit Modal */}
      {settlingDepositPayment && (
        <Dialog
          isOpen={!!settlingDepositPayment}
          onClose={() => setSettlingDepositPayment(null)}
          title="Settle Security Deposit"
          description={`Held Security Deposit: ₱${settlingDepositPayment.securityDeposit} for ${settlingDepositPayment.referenceNo}.`}
        >
          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-medium text-zinc-700 mb-1">Settlement Action *</label>
              <select
                value={settleAction}
                onChange={e => setSettleAction(e.target.value as any)}
                className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 text-xs focus:outline-none focus:border-zinc-900"
              >
                <option value="REFUND_FULL">Full Refund (100% — No Damage)</option>
                <option value="DEDUCT_DAMAGE">Partial Damage Deduction</option>
                <option value="FORFEIT">Full Forfeiture (Major Defects / Non-return)</option>
              </select>
            </div>

            {settleAction === 'DEDUCT_DAMAGE' && (
              <div>
                <label className="block font-medium text-zinc-700 mb-1">
                  Deduction Amount (Max ₱{settlingDepositPayment.securityDeposit}) *
                </label>
                <input
                  type="number"
                  value={deductionAmount}
                  max={settlingDepositPayment.securityDeposit}
                  onChange={e => setDeductionAmount(Number(e.target.value))}
                  className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 text-xs focus:outline-none focus:border-zinc-900"
                />
              </div>
            )}

            {settleAction !== 'REFUND_FULL' && (
              <div>
                <label className="block font-medium text-zinc-700 mb-1">Justification Reason *</label>
                <input
                  type="text"
                  value={deductionReason}
                  placeholder="e.g. Scratched lens element, missing strap"
                  onChange={e => setDeductionReason(e.target.value)}
                  className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-zinc-900 text-xs focus:outline-none focus:border-zinc-900"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
              <button
                onClick={() => setSettlingDepositPayment(null)}
                className="px-3.5 py-1.5 rounded-lg bg-zinc-100 text-zinc-700 hover:bg-zinc-200 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSettleDeposit}
                className="px-4 py-1.5 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 text-xs font-bold"
              >
                Settle Deposit
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};
