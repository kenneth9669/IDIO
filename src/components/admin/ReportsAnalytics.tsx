'use client';

import React, { useState, useMemo } from 'react';
import { useSystem } from '../../context/SystemContext';
import { formatPHP, formatDate } from '../../lib/utils';
import {
  BarChart3,
  TrendingUp,
  MapPin,
  Camera,
  ShieldCheck,
  Layers,
  Award,
  Download,
  AlertCircle
} from 'lucide-react';

export const ReportsAnalytics: React.FC = () => {
  const { cameras, reservations, maintenanceLogs } = useSystem();
  const [selectedPeriod, setSelectedPeriod] = useState<'ALL' | '30D' | '7D' | '1Y'>('ALL');

  // Filter reservations by selected period
  const filteredReservations = useMemo(() => {
    const now = new Date();
    const cutoff = new Date();
    if (selectedPeriod === '7D') cutoff.setDate(now.getDate() - 7);
    else if (selectedPeriod === '30D') cutoff.setDate(now.getDate() - 30);
    else if (selectedPeriod === '1Y') cutoff.setFullYear(now.getFullYear() - 1);
    else cutoff.setTime(0);

    const cutoffStr = cutoff.toISOString().split('T')[0];
    return reservations.filter(r => r.createdAt >= cutoffStr);
  }, [reservations, selectedPeriod]);

  // Financial calculations
  const totalRentalRevenue = filteredReservations
    .filter(r => r.status === 'COMPLETED' || r.paymentStatus === 'PAID')
    .reduce((sum, r) => sum + r.subtotal, 0);

  const totalDepositsHeld = filteredReservations
    .filter(r => r.depositStatus === 'HELD')
    .reduce((sum, r) => sum + r.securityDeposit, 0);

  const totalDepositsDeducted = filteredReservations
    .filter(r => r.depositStatus === 'DEDUCTED' || r.depositStatus === 'FORFEITED')
    .reduce((sum, r) => sum + (r.depositDeduction || r.securityDeposit), 0);

  const totalOutstanding = filteredReservations
    .filter(r => r.paymentStatus === 'PENDING' && r.status !== 'CANCELLED' && r.status !== 'REJECTED')
    .reduce((sum, r) => sum + r.totalAmount, 0);

  const totalMaintenanceExpense = maintenanceLogs.reduce((sum, l) => sum + (l.costEstimate || 0), 0);

  // Status Counts
  const statusCounts = {
    total: filteredReservations.length,
    approved: filteredReservations.filter(r => r.status === 'APPROVED').length,
    checkedOut: filteredReservations.filter(r => r.status === 'CHECKED_OUT').length,
    completed: filteredReservations.filter(r => r.status === 'COMPLETED').length,
    cancelled: filteredReservations.filter(r => r.status === 'CANCELLED').length,
    rejected: filteredReservations.filter(r => r.status === 'REJECTED').length,
    pending: filteredReservations.filter(r => r.status === 'PENDING_APPROVAL').length
  };

  // Barangay aggregation
  const barangayCounts: Record<string, number> = {};
  filteredReservations.forEach(r => {
    barangayCounts[r.customerBarangay] = (barangayCounts[r.customerBarangay] || 0) + 1;
  });
  const sortedBarangays = Object.entries(barangayCounts).sort((a, b) => b[1] - a[1]);

  // Camera demand ranking
  const cameraRentalsMap: Record<string, { name: string; category: string; count: number }> = {};
  filteredReservations.forEach(r => {
    if (!cameraRentalsMap[r.cameraName]) {
      cameraRentalsMap[r.cameraName] = { name: r.cameraName, category: r.cameraCategory, count: 0 };
    }
    cameraRentalsMap[r.cameraName].count += 1;
  });
  const sortedCameras = Object.values(cameraRentalsMap).sort((a, b) => b.count - a.count);

  // Condition counts
  const conditionCounts = {
    Excellent: cameras.filter(c => c.condition === 'Excellent').length,
    Good: cameras.filter(c => c.condition === 'Good').length,
    Fair: cameras.filter(c => c.condition === 'Fair').length,
    Damaged: cameras.filter(c => c.condition === 'Damaged').length
  };

  // CSV Export Handler
  const handleExportCSV = () => {
    const headers = [
      'Reference No',
      'Created Date',
      'Customer Name',
      'Customer Barangay',
      'Customer Phone',
      'Camera Name',
      'Camera Serial',
      'Start Date',
      'End Date',
      'Total Days',
      'Daily Rate (PHP)',
      'Rental Subtotal (PHP)',
      'Security Deposit (PHP)',
      'Total Amount (PHP)',
      'Status',
      'Payment Status',
      'Payment Method',
      'Deposit Status',
      'Deposit Deduction (PHP)'
    ];

    const rows = filteredReservations.map(r => [
      `"${r.referenceNo}"`,
      `"${r.createdAt.slice(0, 10)}"`,
      `"${r.customerName.replace(/"/g, '""')}"`,
      `"${r.customerBarangay}"`,
      `"${r.customerPhone}"`,
      `"${r.cameraName.replace(/"/g, '""')}"`,
      `"${r.cameraSerial}"`,
      `"${r.startDate}"`,
      `"${r.endDate}"`,
      r.totalDays,
      r.dailyRate,
      r.subtotal,
      r.securityDeposit,
      r.totalAmount,
      `"${r.status}"`,
      `"${r.paymentStatus}"`,
      `"${r.paymentMethod}"`,
      `"${r.depositStatus}"`,
      r.depositDeduction || 0
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `IDIO_Rental_Reports_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header with Period Filter & CSV Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-zinc-800" />
            Financial &amp; Operational Analytics
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Authoritative revenue reconciliation, fleet utilization, and geographical demand in Butuan City.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Period Selector */}
          <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-lg border border-zinc-200">
            {(['ALL', '1Y', '30D', '7D'] as const).map(p => (
              <button
                key={p}
                onClick={() => setSelectedPeriod(p)}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition ${
                  selectedPeriod === p ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600 hover:text-zinc-900'
                }`}
              >
                {p === 'ALL' ? 'All Time' : p === '1Y' ? '1 Year' : p === '30D' ? '30 Days' : '7 Days'}
              </button>
            ))}
          </div>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white font-medium text-xs shadow-xs transition inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Financial KPIs (Period Aware) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white border border-zinc-200 rounded-xl space-y-1 shadow-xs">
          <span className="text-xs text-zinc-500 font-medium flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-emerald-600" /> Realized Rental Revenue
          </span>
          <p className="text-2xl font-bold text-zinc-900">{formatPHP(totalRentalRevenue)}</p>
          <span className="text-[11px] text-zinc-400">Excludes held security deposits</span>
        </div>

        <div className="p-5 bg-white border border-zinc-200 rounded-xl space-y-1 shadow-xs">
          <span className="text-xs text-zinc-500 font-medium flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-indigo-600" /> Active Deposits Held
          </span>
          <p className="text-2xl font-bold text-indigo-600">{formatPHP(totalDepositsHeld)}</p>
          <span className="text-[11px] text-zinc-400">Held in escrow until return inspection</span>
        </div>

        <div className="p-5 bg-white border border-zinc-200 rounded-xl space-y-1 shadow-xs">
          <span className="text-xs text-zinc-500 font-medium flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-amber-500" /> Outstanding Balances
          </span>
          <p className="text-2xl font-bold text-zinc-900">{formatPHP(totalOutstanding)}</p>
          <span className="text-[11px] text-zinc-400">Uncollected booking balances</span>
        </div>

        <div className="p-5 bg-white border border-zinc-200 rounded-xl space-y-1 shadow-xs">
          <span className="text-xs text-zinc-500 font-medium flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-zinc-600" /> Maintenance Costs
          </span>
          <p className="text-2xl font-bold text-zinc-900">{formatPHP(totalMaintenanceExpense)}</p>
          <span className="text-[11px] text-zinc-400">Total optical and hardware servicing</span>
        </div>
      </div>

      {/* Reservation Status Funnel Bar */}
      <div className="p-5 bg-white border border-zinc-200 rounded-xl space-y-3 shadow-xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700">
          Reservation Lifecycle Breakdown ({statusCounts.total} Bookings in Period)
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-center text-xs">
          <div className="p-2.5 bg-zinc-50 border border-zinc-200 rounded-lg">
            <span className="text-[10px] text-zinc-400 block font-bold">COMPLETED</span>
            <strong className="text-base text-zinc-900">{statusCounts.completed}</strong>
          </div>
          <div className="p-2.5 bg-zinc-50 border border-zinc-200 rounded-lg">
            <span className="text-[10px] text-zinc-400 block font-bold">ACTIVE FIELD</span>
            <strong className="text-base text-indigo-600">{statusCounts.checkedOut}</strong>
          </div>
          <div className="p-2.5 bg-zinc-50 border border-zinc-200 rounded-lg">
            <span className="text-[10px] text-zinc-400 block font-bold">APPROVED</span>
            <strong className="text-base text-blue-600">{statusCounts.approved}</strong>
          </div>
          <div className="p-2.5 bg-zinc-50 border border-zinc-200 rounded-lg">
            <span className="text-[10px] text-zinc-400 block font-bold">PENDING</span>
            <strong className="text-base text-amber-600">{statusCounts.pending}</strong>
          </div>
          <div className="p-2.5 bg-zinc-50 border border-zinc-200 rounded-lg">
            <span className="text-[10px] text-zinc-400 block font-bold">CANCELLED</span>
            <strong className="text-base text-zinc-600">{statusCounts.cancelled}</strong>
          </div>
          <div className="p-2.5 bg-zinc-50 border border-zinc-200 rounded-lg">
            <span className="text-[10px] text-zinc-400 block font-bold">REJECTED</span>
            <strong className="text-base text-rose-600">{statusCounts.rejected}</strong>
          </div>
        </div>
      </div>

      {/* Grid: Most Rented Models & Barangay Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Rented Camera Models */}
        <div className="p-5 bg-white border border-zinc-200 rounded-xl space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 flex items-center gap-2">
              <Award className="w-4 h-4 text-zinc-500" />
              Top Camera Fleet Demand
            </h3>
            <span className="text-[10px] text-zinc-400">Utilization Rate</span>
          </div>

          <div className="space-y-3">
            {sortedCameras.length === 0 ? (
              <p className="text-center text-zinc-400 py-6 text-xs">No rental activity in this period.</p>
            ) : (
              sortedCameras.slice(0, 5).map((cam, idx) => {
                const maxCount = sortedCameras[0]?.count || 1;
                const percentage = Math.round((cam.count / maxCount) * 100);

                return (
                  <div key={cam.name} className="space-y-1 text-xs">
                    <div className="flex justify-between items-baseline">
                      <div className="flex items-center gap-2 font-medium text-zinc-900">
                        <span className="text-zinc-400 text-[11px]">#{idx + 1}</span>
                        <span>{cam.name}</span>
                        <span className="text-[10px] font-normal text-zinc-400">({cam.category})</span>
                      </div>
                      <span className="font-bold text-zinc-900">{cam.count} shoots</span>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                      <div className="h-full bg-zinc-900 rounded-full" style={{ width: `${percentage}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Butuan City Barangay Geographical Demand */}
        <div className="p-5 bg-white border border-zinc-200 rounded-xl space-y-4 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-zinc-500" />
              Geographical Demand across Butuan City
            </h3>
            <span className="text-[10px] text-zinc-400">Curated Local Area</span>
          </div>

          <div className="space-y-3">
            {sortedBarangays.length === 0 ? (
              <p className="text-center text-zinc-400 py-6 text-xs">No bookings in selected period.</p>
            ) : (
              sortedBarangays.slice(0, 6).map(([barangay, count]) => {
                const totalRes = filteredReservations.length || 1;
                const pct = Math.round((count / totalRes) * 100);

                return (
                  <div key={barangay} className="space-y-1 text-xs">
                    <div className="flex justify-between items-baseline">
                      <span className="font-medium text-zinc-800">Brgy. {barangay}</span>
                      <span className="text-zinc-500">
                        {count} booking{count > 1 ? 's' : ''} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                      <div className="h-full bg-zinc-700 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Fleet Physical Condition Quality Distribution */}
      <div className="p-5 bg-white border border-zinc-200 rounded-xl space-y-4 shadow-xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 flex items-center gap-2">
          <Camera className="w-4 h-4 text-zinc-500" />
          Fleet Condition Quality Distribution ({cameras.length} Assets)
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-lg space-y-1">
            <span className="text-emerald-700 font-bold block text-xs">Grade A: Excellent</span>
            <p className="text-xl font-bold text-zinc-900">{conditionCounts.Excellent}</p>
            <p className="text-[11px] text-zinc-500">Pristine optical &amp; body condition</p>
          </div>

          <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-lg space-y-1">
            <span className="text-blue-700 font-bold block text-xs">Grade B: Good</span>
            <p className="text-xl font-bold text-zinc-900">{conditionCounts.Good}</p>
            <p className="text-[11px] text-zinc-500">Minor cosmetic signs of use</p>
          </div>

          <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-lg space-y-1">
            <span className="text-amber-700 font-bold block text-xs">Grade C: Fair</span>
            <p className="text-xl font-bold text-zinc-900">{conditionCounts.Fair}</p>
            <p className="text-[11px] text-zinc-500">Scheduled for optical cleaning</p>
          </div>

          <div className="p-3.5 bg-zinc-50 border border-zinc-200 rounded-lg space-y-1">
            <span className="text-rose-700 font-bold block text-xs">Damaged / Offline</span>
            <p className="text-xl font-bold text-zinc-900">{conditionCounts.Damaged}</p>
            <p className="text-[11px] text-zinc-500">Locked out of rental availability</p>
          </div>
        </div>
      </div>
    </div>
  );
};
