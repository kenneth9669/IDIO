'use client';

import React, { useState, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSystem } from '../../context/SystemContext';
import { formatDateTime } from '../../lib/utils';
import {
  Settings,
  Shield,
  User,
  MapPin,
  Clock,
  KeyRound,
  LogOut,
  RotateCcw,
  CheckCircle2,
  Lock,
  Building,
  FileCheck,
  Activity,
  Search,
  Filter,
  Camera,
  CalendarDays,
  Wrench,
  CreditCard
} from 'lucide-react';
import { Dialog } from '../common/Dialog';

export const AdminSettings: React.FC<{ initialTab?: 'settings' | 'audit' }> = ({ initialTab = 'settings' }) => {
  const { profile, signOut } = useAuth();
  const { currentUser, resetToDefaults, activityLogs } = useSystem();
  const [activeSubTab, setActiveSubTab] = useState<'settings' | 'audit'>(initialTab);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetSuccessAlert, setResetSuccessAlert] = useState(false);

  // Audit search & filters
  const [searchQuery, setSearchQuery] = useState('');
  const [targetTypeFilter, setTargetTypeFilter] = useState('ALL');

  const activeAdminName = profile?.full_name || currentUser.name || 'Dave Admin';
  const activeAdminEmail = profile?.email || currentUser.email || 'admin@idio.ph';
  const activeAdminPhone = profile?.phone || currentUser.phone || '+63 917 555 0199';

  const handleReset = () => {
    resetToDefaults();
    setShowResetConfirm(false);
    setResetSuccessAlert(true);
    setTimeout(() => setResetSuccessAlert(false), 4000);
  };

  const filteredLogs = useMemo(() => {
    return activityLogs.filter(log => {
      const matchesSearch =
        log.actorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.details.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.targetId.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesTarget = targetTypeFilter === 'ALL' || log.targetType === targetTypeFilter;

      return matchesSearch && matchesTarget;
    });
  }, [activityLogs, searchQuery, targetTypeFilter]);

  const getTargetIcon = (targetType: string) => {
    switch (targetType) {
      case 'CAMERA':
        return <Camera className="w-3.5 h-3.5 text-blue-600" />;
      case 'RESERVATION':
        return <CalendarDays className="w-3.5 h-3.5 text-indigo-600" />;
      case 'MAINTENANCE':
        return <Wrench className="w-3.5 h-3.5 text-amber-600" />;
      case 'PROFILE':
        return <User className="w-3.5 h-3.5 text-emerald-600" />;
      case 'PAYMENT':
        return <CreditCard className="w-3.5 h-3.5 text-purple-600" />;
      default:
        return <Activity className="w-3.5 h-3.5 text-zinc-600" />;
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Alert */}
      {resetSuccessAlert && (
        <div className="p-3.5 bg-zinc-900 text-white rounded-xl text-xs font-medium flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>System seed data has been reset to pristine Butuan City default state.</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-zinc-800" />
            Settings &amp; Audit Logs
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Manage administrator credentials, Butuan City operational branch policies, and review immutable activity logs.
          </p>
        </div>

        {/* Sub-tab Pill Switcher */}
        <div className="flex items-center p-1 bg-zinc-100 rounded-lg border border-zinc-200 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveSubTab('settings')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer ${
              activeSubTab === 'settings'
                ? 'bg-white text-zinc-900 shadow-xs font-semibold'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            Branch &amp; Profile Settings
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('audit')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
              activeSubTab === 'audit'
                ? 'bg-white text-zinc-900 shadow-xs font-semibold'
                : 'text-zinc-600 hover:text-zinc-900'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Audit Trail ({activityLogs.length})
          </button>
        </div>
      </div>

      {activeSubTab === 'settings' && (
        <div className="space-y-6">
          {/* Admin Profile Overview */}
          <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 flex items-center gap-2">
                <User className="w-4 h-4 text-zinc-500" />
                Verified Administrator Profile
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-zinc-900 text-white font-bold text-[10px]">
                ROLE: ADMIN
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <span className="text-zinc-400 block text-[10px] uppercase font-bold">Full Name</span>
                <p className="font-semibold text-zinc-900 mt-0.5">{activeAdminName}</p>
              </div>
              <div>
                <span className="text-zinc-400 block text-[10px] uppercase font-bold">Email Address</span>
                <p className="font-semibold text-zinc-900 mt-0.5">{activeAdminEmail}</p>
              </div>
              <div>
                <span className="text-zinc-400 block text-[10px] uppercase font-bold">Contact Phone</span>
                <p className="font-semibold text-zinc-900 mt-0.5">{activeAdminPhone}</p>
              </div>
            </div>

            <div className="pt-2 border-t border-zinc-100 flex items-center justify-between">
              <span className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-zinc-400" />
                Role-Based Access Control enforced server-side via Supabase Auth &amp; PostgreSQL RLS.
              </span>
              <button
                onClick={() => signOut()}
                className="px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-rose-50 text-zinc-600 hover:text-rose-600 text-xs font-medium inline-flex items-center gap-1.5 transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>

          {/* Butuan City Branch Operations */}
          <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 flex items-center gap-2">
                <Building className="w-4 h-4 text-zinc-500" />
                Branch &amp; Service Area Specification
              </h3>
              <span className="text-[10px] text-zinc-400 font-medium">Local Operating Scope</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-zinc-900">
                  <MapPin className="w-4 h-4 text-zinc-600" />
                  <span>Physical Counter Branch</span>
                </div>
                <p className="text-zinc-600">J.C. Aquino Avenue, Butuan City, Agusan del Norte, Philippines</p>
                <p className="text-[11px] text-zinc-400">Fixed operational territory: Butuan City Barangays only.</p>
              </div>

              <div className="p-3 bg-zinc-50 rounded-lg border border-zinc-200 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-zinc-900">
                  <Clock className="w-4 h-4 text-zinc-600" />
                  <span>Counter Operating Hours</span>
                </div>
                <p className="text-zinc-600">Monday – Saturday: 8:00 AM – 7:00 PM</p>
                <p className="text-zinc-600">Sunday: 9:00 AM – 5:00 PM</p>
              </div>
            </div>
          </div>

          {/* System Policy & Security Architecture */}
          <div className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 flex items-center gap-2">
                <Shield className="w-4 h-4 text-zinc-500" />
                Security Rules &amp; Domain Policy Invariants
              </h3>
              <span className="text-[10px] text-emerald-600 font-bold">STRICT RBAC</span>
            </div>

            <div className="space-y-2 text-xs text-zinc-600">
              <div className="flex items-start gap-2 p-2.5 bg-zinc-50 rounded-lg border border-zinc-100">
                <FileCheck className="w-4 h-4 text-zinc-700 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-zinc-900 block">Strictly 2 Roles (ADMIN &amp; CUSTOMER)</strong>
                  <span>No Staff role exists in IDIO. All operational counter dispatches and management actions are executed exclusively by verified administrators.</span>
                </div>
              </div>

              <div className="flex items-start gap-2 p-2.5 bg-zinc-50 rounded-lg border border-zinc-100">
                <FileCheck className="w-4 h-4 text-zinc-700 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-zinc-900 block">PostgreSQL GiST Date Exclusion Constraints</strong>
                  <span>Database-level concurrency safeguards prevent overlapping reservations on the same camera asset.</span>
                </div>
              </div>

              <div className="flex items-start gap-2 p-2.5 bg-zinc-50 rounded-lg border border-zinc-100">
                <FileCheck className="w-4 h-4 text-zinc-700 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-zinc-900 block">Authoritative In-Person Handover Checklist</strong>
                  <span>Mandatory condition grading (Grade A/B/C/Damaged) and accessories verification prior to camera release.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Academic Defense Seed Data Reset (Development Safe) */}
          <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="text-xs font-bold text-zinc-900 flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4 text-zinc-600" />
                Restore Pristine Seed State (Development Environment)
              </h4>
              <p className="text-xs text-zinc-500 mt-0.5">
                Reset all digital cameras, reservations, maintenance tickets, and audit records to original seed data for evaluation.
              </p>
            </div>

            <button
              onClick={() => setShowResetConfirm(true)}
              className="px-3.5 py-1.5 rounded-lg border border-zinc-300 hover:bg-zinc-200 text-zinc-800 text-xs font-semibold transition cursor-pointer self-start sm:self-auto"
            >
              Reset Demo Data
            </button>
          </div>
        </div>
      )}

      {activeSubTab === 'audit' && (
        <div className="space-y-4">
          {/* Filter and Search Bar */}
          <div className="p-3.5 bg-white border border-zinc-200 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search logs by actor, action, target ID, details..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-zinc-50 border border-zinc-200 rounded-lg pl-9 pr-3 py-2 text-xs text-zinc-900 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/10 focus:border-zinc-900 transition"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-zinc-400" />
              <select
                value={targetTypeFilter}
                onChange={e => setTargetTypeFilter(e.target.value)}
                className="bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs text-zinc-700 focus:outline-none focus:border-zinc-900"
              >
                <option value="ALL">All Categories</option>
                <option value="CAMERA">Cameras</option>
                <option value="RESERVATION">Reservations &amp; Rentals</option>
                <option value="MAINTENANCE">Maintenance</option>
                <option value="PROFILE">Customer Profiles</option>
                <option value="PAYMENT">Payments &amp; Deposits</option>
              </select>
            </div>
          </div>

          {/* Logs Table */}
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-600">
                <thead className="bg-zinc-50 text-[10px] uppercase font-bold text-zinc-400 border-b border-zinc-200 tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Target Type</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-normal">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-zinc-400 text-xs">
                        No activity records found matching your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map(log => (
                      <tr key={log.id} className="hover:bg-zinc-50/80 transition">
                        <td className="py-3 px-4 whitespace-nowrap text-zinc-500 font-mono text-[11px]">
                          {formatDateTime(log.timestamp)}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="font-semibold text-zinc-900">{log.actorName}</span>
                          <span className="ml-1.5 text-[9px] uppercase px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 font-mono">
                            {log.actorRole}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-100 text-zinc-800">
                            {getTargetIcon(log.targetType)}
                            <span>{log.targetType}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] font-bold text-zinc-800">
                          {log.action}
                        </td>
                        <td className="py-3 px-4 text-zinc-600 text-xs">
                          {log.details}
                          {log.targetId && (
                            <span className="ml-2 font-mono text-[10px] text-zinc-400 bg-zinc-50 px-1 py-0.5 rounded border border-zinc-100">
                              ID: {log.targetId}
                            </span>
                          )}
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

      {/* Reset Confirmation Dialog */}
      {showResetConfirm && (
        <Dialog
          isOpen={showResetConfirm}
          onClose={() => setShowResetConfirm(false)}
          title="Confirm System State Reset"
          description="Are you sure you want to reset the system state? All cameras, bookings, and logs will be restored to seed values."
        >
          <div className="flex justify-end gap-2 pt-3">
            <button
              onClick={() => setShowResetConfirm(false)}
              className="px-3.5 py-1.5 rounded-lg bg-zinc-100 text-zinc-700 hover:bg-zinc-200 text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 text-xs font-bold"
            >
              Confirm Reset
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
};
