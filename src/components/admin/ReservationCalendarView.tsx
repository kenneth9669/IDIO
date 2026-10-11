'use client';

import React, { useState, useMemo } from 'react';
import { useSystem } from '../../context/SystemContext';
import { Reservation } from '../../types';
import { formatDate } from '../../lib/utils';
import {
  ChevronLeft,
  ChevronRight,
  Filter
} from 'lucide-react';

interface ReservationCalendarViewProps {
  onSelectReservation?: (reservation: Reservation) => void;
}

export const ReservationCalendarView: React.FC<ReservationCalendarViewProps> = ({
  onSelectReservation
}) => {
  const { reservations, cameras } = useSystem();
  const [selectedCameraId, setSelectedCameraId] = useState<string>('ALL');
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(() => new Date());

  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();

  const prevMonth = () => {
    setCurrentMonthDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonthDate(new Date(year, month + 1, 1));
  };

  const monthName = currentMonthDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Filter reservations by camera if selected
  const activeReservations = useMemo(() => {
    return reservations.filter(r => {
      const matchesCamera = selectedCameraId === 'ALL' || r.cameraId === selectedCameraId;
      const isActiveStatus = ['PENDING_APPROVAL', 'APPROVED', 'CHECKED_OUT'].includes(r.status);
      return matchesCamera && isActiveStatus;
    });
  }, [reservations, selectedCameraId]);

  // Calendar Grid generation
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const days: {
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      reservations: Reservation[];
    }[] = [];

    // Prev month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const m = month === 0 ? 12 : month;
      const y = month === 0 ? year - 1 : year;
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: false,
        reservations: []
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayRes = activeReservations.filter(r => {
        return dateStr >= r.startDate && dateStr <= r.endDate;
      });

      days.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: true,
        reservations: dayRes
      });
    }

    // Next month padding to fill complete weeks (42 cells)
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const m = month === 11 ? 1 : month + 2;
      const y = month === 11 ? year + 1 : year;
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: false,
        reservations: []
      });
    }

    return days;
  }, [year, month, activeReservations]);

  return (
    <div className="space-y-4">
      {/* Calendar Controls & Camera Filter */}
      <div className="p-3.5 bg-white border border-zinc-200 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={prevMonth}
              className="p-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-100 text-zinc-600 transition"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-bold text-sm text-zinc-900 px-2 min-w-[140px] text-center">
              {monthName}
            </span>
            <button
              onClick={nextMonth}
              className="p-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-100 text-zinc-600 transition"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setCurrentMonthDate(new Date())}
            className="px-2.5 py-1 rounded-md bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-semibold"
          >
            Today
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-zinc-400" />
          <span className="text-xs text-zinc-500 font-medium">Filter Fleet:</span>
          <select
            value={selectedCameraId}
            onChange={e => setSelectedCameraId(e.target.value)}
            className="bg-white border border-zinc-200 rounded-lg px-2.5 py-1.5 text-xs text-zinc-800 font-medium focus:outline-none focus:border-zinc-900"
          >
            <option value="ALL">All Fleet Cameras ({cameras.length})</option>
            {cameras.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.serialNumber})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Legend Bar */}
      <div className="flex flex-wrap items-center gap-4 text-xs px-1 text-zinc-600">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-blue-500" />
          <span>Approved (Scheduled Pickup)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-indigo-600" />
          <span>Checked Out (In-Field Active)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-amber-500" />
          <span>Pending Approval</span>
        </div>
      </div>

      {/* Monthly Grid */}
      <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden shadow-xs">
        {/* Days of Week Header */}
        <div className="grid grid-cols-7 bg-zinc-50 border-b border-zinc-200 text-center text-[11px] font-bold text-zinc-500 uppercase py-2">
          <span>Sun</span>
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
        </div>

        {/* Days Cells */}
        <div className="grid grid-cols-7 divide-x divide-y divide-zinc-100">
          {calendarDays.map((cell, idx) => {
            const isToday = cell.dateStr === new Date().toISOString().split('T')[0];

            return (
              <div
                key={idx}
                className={`min-h-[100px] p-1.5 flex flex-col justify-between transition ${
                  cell.isCurrentMonth ? 'bg-white' : 'bg-zinc-50/50 text-zinc-300'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span
                    className={`font-semibold text-[11px] px-1.5 py-0.5 rounded ${
                      isToday
                        ? 'bg-zinc-900 text-white font-bold'
                        : cell.isCurrentMonth
                        ? 'text-zinc-700'
                        : 'text-zinc-400'
                    }`}
                  >
                    {cell.dayNum}
                  </span>
                  {cell.reservations.length > 0 && (
                    <span className="text-[10px] text-zinc-400 font-medium">
                      {cell.reservations.length} booking{cell.reservations.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                <div className="space-y-1 mt-1 flex-1">
                  {cell.reservations.slice(0, 2).map(r => {
                    let badgeClass = 'bg-amber-100 text-amber-900 border-amber-300';
                    if (r.status === 'APPROVED') {
                      badgeClass = 'bg-blue-100 text-blue-900 border-blue-300';
                    } else if (r.status === 'CHECKED_OUT') {
                      badgeClass = 'bg-indigo-100 text-indigo-900 border-indigo-300';
                    }

                    return (
                      <div
                        key={r.id}
                        onClick={() => onSelectReservation && onSelectReservation(r)}
                        className={`p-1 rounded border text-[10px] font-medium truncate cursor-pointer hover:opacity-80 transition ${badgeClass}`}
                        title={`${r.referenceNo}: ${r.customerName} - ${r.cameraName}`}
                      >
                        <span className="font-bold">{r.cameraName.split(' ')[0]}</span> • {r.customerName.split(' ')[0]}
                      </div>
                    );
                  })}

                  {cell.reservations.length > 2 && (
                    <div className="text-[9px] text-zinc-500 font-bold px-1">
                      +{cell.reservations.length - 2} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
