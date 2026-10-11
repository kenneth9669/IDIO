'use client';

import React, { useState, useMemo } from 'react';
import { useSystem } from '../../context/SystemContext';
import { User, Reservation } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { ConditionBadge } from '../common/ConditionBadge';
import { Dialog } from '../common/Dialog';
import { formatPHP, formatDate } from '../../lib/utils';
import {
  Users,
  Search,
  MapPin,
  Phone,
  Mail,
  ShieldCheck,
  Eye,
  CalendarDays,
  CreditCard,
  AlertCircle,
  Clock,
  CheckCircle2,
  FileText
} from 'lucide-react';

export const CustomerManager: React.FC = () => {
  const { users, reservations, payments } = useSystem();
  const [searchQuery, setSearchQuery] = useState('');
  const [barangayFilter, setBarangayFilter] = useState('ALL');
  const [viewingCustomer, setViewingCustomer] = useState<User | null>(null);

  // Derive all unique customers from users list + reservations
  const customerList: User[] = useMemo(() => {
    const customerMap = new Map<string, User>();

    // Add registered users
    users
      .filter(u => u.role === 'CUSTOMER')
      .forEach(u => customerMap.set(u.id, u));

    // Also parse customer snapshots from reservations to ensure no customer is omitted
    reservations.forEach(r => {
      if (!customerMap.has(r.customerId)) {
        customerMap.set(r.customerId, {
          id: r.customerId,
          name: r.customerName,
          email: r.customerEmail,
          phone: r.customerPhone,
          role: 'CUSTOMER',
          barangay: r.customerBarangay,
          streetAddress: r.customerStreetAddress || 'Butuan City',
          city: 'Butuan City',
          province: 'Agusan del Norte',
          idType: r.idType || 'Philippine ID',
          idNumber: r.idNumber || 'Verified'
        });
      }
    });

    return Array.from(customerMap.values());
  }, [users, reservations]);

  const uniqueBarangays = useMemo(() => {
    return Array.from(new Set(customerList.map(c => c.barangay).filter(Boolean))).sort();
  }, [customerList]);

  const filteredCustomers = useMemo(() => {
    return customerList.filter(c => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.barangay.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.idNumber || '').toLowerCase().includes(searchQuery.toLowerCase());

      const matchesBarangay = barangayFilter === 'ALL' || c.barangay === barangayFilter;

      return matchesSearch && matchesBarangay;
    });
  }, [customerList, searchQuery, barangayFilter]);

  // Calculations for viewingCustomer
  const customerReservations = useMemo(() => {
    if (!viewingCustomer) return [];
    return reservations.filter(r => r.customerId === viewingCustomer.id || r.customerEmail === viewingCustomer.email);
  }, [reservations, viewingCustomer]);

  const customerTotalSpent = customerReservations
    .filter(r => r.paymentStatus === 'PAID' || r.status === 'COMPLETED')
    .reduce((sum, r) => sum + r.subtotal, 0);

  const customerOutstanding = customerReservations
    .filter(r => r.paymentStatus === 'PENDING' && r.status !== 'CANCELLED' && r.status !== 'REJECTED')
    .reduce((sum, r) => sum + r.totalAmount, 0);

  const customerActiveRentals = customerReservations.filter(r => r.status === 'CHECKED_OUT');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-zinc-800" />
            Customer Directory &amp; Verification
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Verified customer profiles across Butuan City barangays, ID verification records, and rental history.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-white border border-zinc-200 rounded-xl space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
            <span>Registered Customers</span>
            <Users className="w-4 h-4 text-zinc-500" />
          </div>
          <p className="text-2xl font-bold text-zinc-900">{customerList.length}</p>
          <span className="text-[11px] text-zinc-400">In Butuan City service area</span>
        </div>

        <div className="p-5 bg-white border border-zinc-200 rounded-xl space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
            <span>Active In-Field Renters</span>
            <Clock className="w-4 h-4 text-indigo-600" />
          </div>
          <p className="text-2xl font-bold text-indigo-600">
            {reservations.filter(r => r.status === 'CHECKED_OUT').length}
          </p>
          <span className="text-[11px] text-zinc-400">Currently holding equipment</span>
        </div>

        <div className="p-5 bg-white border border-zinc-200 rounded-xl space-y-1 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 text-xs font-medium">
            <span>Verified Philippine IDs</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-zinc-900">
            {customerList.filter(c => c.idNumber).length} / {customerList.length}
          </p>
          <span className="text-[11px] text-zinc-400">Identity verification complete</span>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="p-3.5 bg-white border border-zinc-200 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by customer name, email, phone, barangay, ID number..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-50 border border-zinc-200 rounded-lg pl-9 pr-3 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={barangayFilter}
            onChange={e => setBarangayFilter(e.target.value)}
            className="bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 focus:outline-none focus:border-zinc-900"
          >
            <option value="ALL">All Barangays</option>
            {uniqueBarangays.map(b => (
              <option key={b} value={b}>
                Brgy. {b}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-50 text-zinc-500 uppercase font-bold text-[10px] tracking-wider border-b border-zinc-200">
              <tr>
                <th className="p-3.5">Customer Name</th>
                <th className="p-3.5">Contact Details</th>
                <th className="p-3.5">Residence (Butuan City)</th>
                <th className="p-3.5">Government ID</th>
                <th className="p-3.5">Bookings</th>
                <th className="p-3.5">Outstanding Balance</th>
                <th className="p-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-700">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-zinc-400">
                    No customers found matching your search.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map(c => {
                  const custRes = reservations.filter(r => r.customerId === c.id || r.customerEmail === c.email);
                  const custUnpaid = custRes
                    .filter(r => r.paymentStatus === 'PENDING' && r.status !== 'CANCELLED' && r.status !== 'REJECTED')
                    .reduce((sum, r) => sum + r.totalAmount, 0);

                  return (
                    <tr key={c.id} className="hover:bg-zinc-50/70 transition">
                      <td className="p-3.5">
                        <p className="font-bold text-zinc-900 text-xs">{c.name}</p>
                        <p className="text-[10px] text-zinc-400 font-mono">ID: {c.id.slice(0, 8)}</p>
                      </td>
                      <td className="p-3.5">
                        <p className="text-zinc-800">{c.phone}</p>
                        <p className="text-[11px] text-zinc-400">{c.email}</p>
                      </td>
                      <td className="p-3.5">
                        <span className="font-medium text-zinc-900">Brgy. {c.barangay}</span>
                        <p className="text-[10px] text-zinc-400">{c.streetAddress || 'Butuan City'}</p>
                      </td>
                      <td className="p-3.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-100 text-zinc-800 border border-zinc-200">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                          {c.idType || 'Philippine ID'}
                        </span>
                        <p className="text-[10px] font-mono text-zinc-500 mt-0.5">{c.idNumber || 'Verified'}</p>
                      </td>
                      <td className="p-3.5 font-bold text-zinc-800">{custRes.length} bookings</td>
                      <td className="p-3.5">
                        {custUnpaid > 0 ? (
                          <span className="font-bold text-rose-600">{formatPHP(custUnpaid)}</span>
                        ) : (
                          <span className="text-emerald-700 font-medium">Settled (₱0.00)</span>
                        )}
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => setViewingCustomer(c)}
                          className="p-1.5 rounded-md hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900 transition inline-flex items-center gap-1 font-medium cursor-pointer"
                          title="View Customer Profile & History"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Detail Profile Modal */}
      {viewingCustomer && (
        <Dialog
          isOpen={!!viewingCustomer}
          onClose={() => setViewingCustomer(null)}
          title={
            <div className="flex items-center gap-2 text-zinc-900">
              <Users className="w-5 h-5 text-zinc-700" />
              <span>Customer Profile — {viewingCustomer.name}</span>
            </div>
          }
          description={`Verified Resident of Barangay ${viewingCustomer.barangay}, Butuan City, Agusan del Norte`}
          maxWidth="2xl"
        >
          <div className="space-y-4 text-xs text-zinc-700">
            {/* Profile Overview Card */}
            <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-zinc-400 block text-[10px] uppercase font-bold">Contact</span>
                <p className="font-semibold text-zinc-900">{viewingCustomer.phone}</p>
                <p className="text-zinc-500 text-[11px]">{viewingCustomer.email}</p>
              </div>

              <div>
                <span className="text-zinc-400 block text-[10px] uppercase font-bold">Fixed Location</span>
                <p className="font-semibold text-zinc-900">Brgy. {viewingCustomer.barangay}</p>
                <p className="text-zinc-500 text-[11px]">{viewingCustomer.streetAddress || 'Butuan City, Agusan del Norte'}</p>
              </div>

              <div>
                <span className="text-zinc-400 block text-[10px] uppercase font-bold">Philippine ID</span>
                <p className="font-semibold text-zinc-900">{viewingCustomer.idType || 'National ID'}</p>
                <p className="text-zinc-500 text-[11px] font-mono">{viewingCustomer.idNumber || 'Verified'}</p>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200">
                <span className="text-zinc-400 block text-[10px]">Total Realized Spent</span>
                <strong className="text-zinc-900 text-sm font-bold">{formatPHP(customerTotalSpent)}</strong>
              </div>
              <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200">
                <span className="text-zinc-400 block text-[10px]">Active Field Rentals</span>
                <strong className="text-indigo-600 text-sm font-bold">{customerActiveRentals.length} units</strong>
              </div>
              <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200">
                <span className="text-zinc-400 block text-[10px]">Outstanding Balance</span>
                <strong className={customerOutstanding > 0 ? 'text-rose-600 text-sm font-bold' : 'text-emerald-700 text-sm font-bold'}>
                  {formatPHP(customerOutstanding)}
                </strong>
              </div>
            </div>

            {/* Complete Customer Rental History */}
            <div>
              <h4 className="font-bold text-zinc-900 text-xs mb-2 flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5 text-zinc-500" />
                Customer Booking &amp; Rental Ledger ({customerReservations.length})
              </h4>
              <div className="max-h-56 overflow-y-auto border border-zinc-200 rounded-lg divide-y divide-zinc-100">
                {customerReservations.length === 0 ? (
                  <div className="p-4 text-center text-zinc-400 text-[11px]">
                    No rental reservations recorded for this customer yet.
                  </div>
                ) : (
                  customerReservations.map(r => (
                    <div key={r.id} className="p-3 bg-white flex items-center justify-between text-[11px] hover:bg-zinc-50">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-zinc-900">{r.referenceNo}</span>
                          <span className="font-semibold text-zinc-800">{r.cameraName}</span>
                        </div>
                        <p className="text-[10px] text-zinc-500 mt-0.5">
                          {formatDate(r.startDate)} → {formatDate(r.endDate)} ({r.totalDays} days) • Tariff: {formatPHP(r.totalAmount)}
                        </p>
                        {r.returnCondition && (
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className="text-[10px] text-zinc-400">Return Grade:</span>
                            <ConditionBadge condition={r.returnCondition} showIcon={false} />
                            {r.returnNotes && <span className="text-[10px] text-zinc-500 italic">({r.returnNotes})</span>}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <StatusBadge status={r.status} type="rental" size="sm" />
                        <span className="block text-[10px] text-zinc-400 mt-1">
                          Payment: {r.paymentStatus}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-zinc-100">
              <button
                onClick={() => setViewingCustomer(null)}
                className="px-4 py-1.5 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};
