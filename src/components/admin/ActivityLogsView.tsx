'use client';

import React, { useState, useMemo } from 'react';
import { useSystem } from '../../context/SystemContext';
import { ActivityLog } from '../../types';
import { formatDateTime } from '../../lib/utils';
import {
  Activity,
  Search,
  Filter,
  Shield,
  Camera,
  CalendarDays,
  Wrench,
  User,
  CreditCard
} from 'lucide-react';

export const ActivityLogsView: React.FC = () => {
  const { activityLogs } = useSystem();
  const [searchQuery, setSearchQuery] = useState('');
  const [targetTypeFilter, setTargetTypeFilter] = useState('ALL');

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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200">
        <div>
          <h2 className="text-xl font-bold text-zinc-900 flex items-center gap-2">
            <Activity className="w-5 h-5 text-zinc-800" />
            Operational Audit Trail &amp; Activity Logs
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Immutable system activity log recording camera updates, booking approvals, checkouts, returns, payments, and service tickets.
          </p>
        </div>
      </div>

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
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-zinc-50 text-zinc-500 uppercase font-bold text-[10px] tracking-wider border-b border-zinc-200">
              <tr>
                <th className="p-3.5">Timestamp</th>
                <th className="p-3.5">Actor</th>
                <th className="p-3.5">Action</th>
                <th className="p-3.5">Target</th>
                <th className="p-3.5">Target ID</th>
                <th className="p-3.5">Audit Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 text-zinc-700">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-zinc-400">
                    No activity logs recorded matching your filter.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-zinc-50/70 transition">
                    <td className="p-3.5 font-mono text-[11px] text-zinc-500 whitespace-nowrap">
                      {formatDateTime(log.timestamp)}
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-1.5 font-semibold text-zinc-900">
                        <Shield className="w-3.5 h-3.5 text-zinc-600" />
                        <span>{log.actorName}</span>
                      </div>
                      <span className="text-[10px] uppercase font-bold text-zinc-400">{log.actorRole}</span>
                    </td>
                    <td className="p-3.5">
                      <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-100 text-zinc-800 border border-zinc-200">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <div className="flex items-center gap-1.5 text-zinc-800 font-medium">
                        {getTargetIcon(log.targetType)}
                        <span>{log.targetType}</span>
                      </div>
                    </td>
                    <td className="p-3.5 font-mono text-[11px] text-zinc-600">
                      {log.targetId}
                    </td>
                    <td className="p-3.5 text-zinc-800 font-medium max-w-md">
                      {log.details}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
