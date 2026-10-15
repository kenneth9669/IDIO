'use client';

import React, { useMemo, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, X, AlertCircle, Info } from 'lucide-react';
import { RentalStatus } from '../../types';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BookedRange {
  startDate: string;        // YYYY-MM-DD
  endDate: string;          // YYYY-MM-DD
  referenceNo: string;
  status: RentalStatus | 'MAINTENANCE' | 'DAMAGED';
}

export type DateStatus =
  | 'available'
  | 'reserved'       // PENDING_APPROVAL or APPROVED booking
  | 'checked-out'    // CHECKED_OUT (camera physically out)
  | 'unavailable'    // camera is MAINTENANCE or DAMAGED
  | 'past'           // before today
  | 'selected-start'
  | 'selected-end'
  | 'selected-range'
  | 'selected-single';

interface Props {
  /** Whether the camera is currently globally unavailable (MAINTENANCE/DAMAGED/CHECKED_OUT) */
  cameraUnavailable?: boolean;
  cameraUnavailableReason?: string;
  /** All booked intervals for this specific camera */
  bookedRanges: BookedRange[];
  /** Currently selected start date (YYYY-MM-DD) */
  startDate: string;
  /** Currently selected end date (YYYY-MM-DD) */
  endDate: string;
  /** Called when the user picks a new range */
  onChange: (start: string, end: string) => void;
  /** Optional: error message from parent about the selected range */
  rangeError?: string;
  /** Whether availability data is loading */
  isLoading?: boolean;
  /** Optional: error message if availability retrieval from database failed */
  fetchError?: string;
  /** Optional: callback when calendar month changes */
  onMonthChange?: (year: number, month: number) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toYMD(date: Date): string {
  return date.toISOString().split('T')[0];
}

function parseYMD(ymd: string): Date {
  // Parse as local date (not UTC) to avoid timezone shift
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function todayYMD(): string {
  return toYMD(new Date());
}

function getMonthDays(year: number, month: number): Date[] {
  // month is 0-indexed
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days: Date[] = [];
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d));
  }
  return days;
}

function rangeIncludes(ymd: string, ranges: BookedRange[], status?: (RentalStatus | 'MAINTENANCE' | 'DAMAGED')[]): boolean {
  const d = parseYMD(ymd).getTime();
  return ranges.some(r => {
    if (status && !status.includes(r.status)) return false;
    return d >= parseYMD(r.startDate).getTime() && d <= parseYMD(r.endDate).getTime();
  });
}

function rangeOverlapsSelection(startYMD: string, endYMD: string, ranges: BookedRange[]): boolean {
  return ranges.some(r => {
    if (!['PENDING_APPROVAL', 'APPROVED', 'CHECKED_OUT', 'MAINTENANCE', 'DAMAGED'].includes(r.status as string)) return false;
    return startYMD <= r.endDate && endYMD >= r.startDate;
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

export const AvailabilityCalendar: React.FC<Props> = ({
  cameraUnavailable = false,
  cameraUnavailableReason,
  bookedRanges,
  startDate,
  endDate,
  onChange,
  rangeError,
  isLoading = false,
  fetchError,
  onMonthChange
}) => {
  const today = todayYMD();

  // Calendar navigation state
  const [viewYear, setViewYear] = useState<number>(() => {
    const ref = startDate || today;
    return parseYMD(ref).getFullYear();
  });
  const [viewMonth, setViewMonth] = useState<number>(() => {
    const ref = startDate || today;
    return parseYMD(ref).getMonth();
  });

  // Selection state: 'start' = user will pick start next, 'end' = user will pick end next
  const [picking, setPicking] = useState<'start' | 'end'>(startDate ? 'end' : 'start');
  const [clickExplanation, setClickExplanation] = useState<string>('');

  // ── Month Navigation ──────────────────────────────────────────────────────

  const prevMonth = () => {
    let newYear = viewYear;
    let newMonth = viewMonth;
    if (viewMonth === 0) {
      newMonth = 11;
      newYear = viewYear - 1;
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      newMonth = viewMonth - 1;
      setViewMonth(m => m - 1);
    }
    onMonthChange?.(newYear, newMonth);
  };

  const canGoNext = useMemo(() => {
    // Allow up to 12 months forward
    const nowDate = new Date();
    const maxYear = nowDate.getFullYear() + 1;
    return viewYear < maxYear || (viewYear === maxYear && viewMonth < nowDate.getMonth());
  }, [viewYear, viewMonth]);

  const nextMonth = () => {
    if (!canGoNext) return;
    let newYear = viewYear;
    let newMonth = viewMonth;
    if (viewMonth === 11) {
      newMonth = 0;
      newYear = viewYear + 1;
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      newMonth = viewMonth + 1;
      setViewMonth(m => m + 1);
    }
    onMonthChange?.(newYear, newMonth);
  };

  // ── Date Status Derivation ────────────────────────────────────────────────

  const getDateStatus = useCallback((ymd: string): DateStatus => {
    if (ymd < today) return 'past';

    // Check if camera is globally unavailable or if this specific date is blocked by maintenance/damage
    const isMaintenanceOrDamaged = rangeIncludes(ymd, bookedRanges, [
      'MAINTENANCE' as any,
      'DAMAGED' as any
    ]);
    if (cameraUnavailable || isMaintenanceOrDamaged) return 'unavailable';

    const isReserved = rangeIncludes(ymd, bookedRanges, [
      'PENDING_APPROVAL',
      'APPROVED'
    ]);
    const isCheckedOut = rangeIncludes(ymd, bookedRanges, ['CHECKED_OUT']);

    if (isCheckedOut) return 'checked-out';
    if (isReserved) return 'reserved';

    // Selection highlights
    if (startDate && endDate) {
      if (ymd === startDate && ymd === endDate) return 'selected-single';
      if (ymd === startDate) return 'selected-start';
      if (ymd === endDate) return 'selected-end';
      if (ymd > startDate && ymd < endDate) return 'selected-range';
    } else if (startDate && !endDate) {
      if (ymd === startDate) return 'selected-single';
    }

    return 'available';
  }, [today, cameraUnavailable, bookedRanges, startDate, endDate]);

  // ── Click Handler ─────────────────────────────────────────────────────────

  const handleDayClick = (ymd: string, status: DateStatus) => {
    if (fetchError) {
      setClickExplanation('Availability could not be verified from the database. Date selection is temporarily paused.');
      return;
    }

    if (status === 'reserved') {
      setClickExplanation(`${ymd} is already RESERVED by another customer.`);
      return;
    }
    if (status === 'checked-out') {
      setClickExplanation(`${ymd} is currently RENTED and checked out.`);
      return;
    }
    if (status === 'unavailable') {
      setClickExplanation(`${ymd} is UNAVAILABLE due to maintenance.`);
      return;
    }
    if (status === 'past') {
      setClickExplanation('Past dates cannot be selected.');
      return;
    }

    setClickExplanation('');

    if (picking === 'start') {
      onChange(ymd, '');
      setPicking('end');
    } else {
      // Picking end
      if (ymd < startDate) {
        // Treat as new start
        onChange(ymd, '');
        setPicking('end');
        return;
      }
      // Check if range crosses any blocked dates
      if (rangeOverlapsSelection(startDate, ymd, bookedRanges)) {
        setClickExplanation('Your selected rental period overlaps an existing reservation or rental.');
        onChange(startDate, '');
        setPicking('end');
        return;
      }
      onChange(startDate, ymd);
      setPicking('start'); // reset so next click starts fresh
    }
  };

  const handleClear = () => {
    onChange('', '');
    setPicking('start');
    setClickExplanation('');
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const days = getMonthDays(viewYear, viewMonth);
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const monthName = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  // Status-to-style mapping
  const cellStyles: Record<DateStatus, string> = {
    'available':       'bg-white hover:bg-zinc-50 text-zinc-900 cursor-pointer border border-zinc-200/70',
    'past':            'bg-zinc-50 text-zinc-300 cursor-not-allowed border border-transparent',
    'unavailable':     'bg-zinc-100 text-zinc-400 cursor-not-allowed border border-zinc-200 line-through',
    'reserved':        'bg-amber-50 text-amber-900 cursor-not-allowed border border-amber-200/90 font-medium',
    'checked-out':     'bg-rose-50 text-rose-800 cursor-not-allowed border border-rose-200/90 font-medium',
    'selected-single': 'bg-zinc-900 text-white cursor-pointer border border-zinc-900 font-bold',
    'selected-start':  'bg-zinc-900 text-white cursor-pointer border border-zinc-900 rounded-r-none font-bold',
    'selected-end':    'bg-zinc-900 text-white cursor-pointer border border-zinc-900 rounded-l-none font-bold',
    'selected-range':  'bg-zinc-100 text-zinc-900 cursor-pointer border-t border-b border-zinc-300 rounded-none',
  };

  const getAriaLabel = (ymd: string, status: DateStatus): string => {
    const labels: Record<DateStatus, string> = {
      available: `${ymd} — Available for rental`,
      past: `${ymd} — Past date`,
      unavailable: `${ymd} — Camera unavailable (maintenance)`,
      reserved: `${ymd} — RESERVED by another customer`,
      'checked-out': `${ymd} — RENTED (currently checked out)`,
      'selected-start': `${ymd} — Selected pickup date`,
      'selected-end': `${ymd} — Selected return date`,
      'selected-range': `${ymd} — Within selected rental period`,
      'selected-single': `${ymd} — Selected date`,
    };
    return labels[status];
  };

  // Hint about next click action
  const hint = picking === 'start'
    ? 'Click a date to set pickup date'
    : startDate
      ? `Pickup: ${startDate} — Click a date to set return date`
      : 'Click a date to set pickup date';

  return (
    <div className="space-y-3">
      {/* Camera unavailable banner */}
      {cameraUnavailable && (
        <div className="p-3 bg-white border border-zinc-200 rounded-lg text-xs text-zinc-700 flex items-start gap-2 shadow-xs">
          <AlertCircle className="w-4 h-4 text-zinc-500 shrink-0 mt-0.5" />
          <span>{cameraUnavailableReason || 'This camera is currently unavailable for rental.'}</span>
        </div>
      )}

      {/* Loading indicator */}
      {isLoading && (
        <div className="p-2 bg-white border border-zinc-200 rounded-lg text-xs text-zinc-500 flex items-center gap-2 shadow-xs">
          <span className="animate-pulse">⏳</span>
          <span>Verifying real-time database availability…</span>
        </div>
      )}

      {/* Database fetch error warning */}
      {fetchError && (
        <div className="p-2.5 bg-white border border-zinc-200 rounded-lg text-[11px] text-zinc-700 flex items-start gap-2 shadow-xs">
          <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
          <span>{fetchError}</span>
        </div>
      )}

      {/* Explanatory status hint when clicking a disabled date */}
      {clickExplanation && (
        <div className="p-2.5 bg-white border border-zinc-200 rounded-lg text-[11px] text-zinc-700 flex items-center justify-between shadow-xs">
          <span className="flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <span>{clickExplanation}</span>
          </span>
          <button
            type="button"
            onClick={() => setClickExplanation('')}
            className="text-zinc-400 hover:text-zinc-600 p-0.5 rounded cursor-pointer"
            aria-label="Dismiss message"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Calendar card */}
      <div
        className="border border-zinc-200 rounded-xl overflow-hidden bg-white"
        role="application"
        aria-label={`Availability calendar for ${monthName}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
          <button
            type="button"
            onClick={prevMonth}
            aria-label="Previous month"
            className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-600 transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-semibold text-zinc-900">{monthName}</span>
          <button
            type="button"
            onClick={nextMonth}
            disabled={!canGoNext}
            aria-label="Next month"
            className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-600 transition disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Day labels */}
        <div className="grid grid-cols-7 border-b border-zinc-100">
          {DAY_LABELS.map(d => (
            <div key={d} className="text-center text-[10px] font-semibold text-zinc-400 py-2">
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 p-2 gap-0.5">
          {/* Leading empty cells */}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}

          {days.map(day => {
            const ymd = toYMD(day);
            const status = getDateStatus(ymd);
            const dayNum = day.getDate();
            const isDisabled = ['past', 'unavailable', 'reserved', 'checked-out'].includes(status) || Boolean(fetchError);

            return (
              <button
                key={ymd}
                type="button"
                data-date={ymd}
                data-status={status}
                disabled={isDisabled}
                onClick={() => handleDayClick(ymd, status)}
                aria-label={getAriaLabel(ymd, status)}
                title={getAriaLabel(ymd, status)}
                aria-pressed={['selected-start', 'selected-end', 'selected-single'].includes(status)}
                className={`
                  relative text-[11px] font-medium h-8 w-full rounded-lg
                  flex items-center justify-center
                  transition-colors duration-100
                  ${cellStyles[status]}
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-1
                `}
              >
                {dayNum}
                {/* Dot indicators for reserved/checked-out */}
                {status === 'reserved' && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-amber-500" aria-hidden="true" />
                )}
                {status === 'checked-out' && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-rose-500" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selection hint */}
      <p className="text-[11px] text-zinc-500 flex items-center gap-1">
        <span>📅</span>
        <span>{hint}</span>
      </p>

      {/* Range error */}
      {rangeError && (
        <div className="p-2.5 bg-white border border-zinc-200 rounded-lg text-[11px] text-zinc-700 flex items-start gap-2 shadow-xs">
          <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
          <span>{rangeError}</span>
        </div>
      )}

      {/* Clear button */}
      {(startDate || endDate) && (
        <button
          type="button"
          onClick={handleClear}
          className="flex items-center gap-1 text-[11px] text-zinc-500 hover:text-zinc-800 transition cursor-pointer"
        >
          <X className="w-3 h-3" />
          <span>Clear selected dates</span>
        </button>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[10px] text-zinc-500 pt-1 border-t border-zinc-100">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded border border-zinc-200 bg-white inline-block" />
          Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-amber-100 border border-amber-300 inline-block" />
          Reserved
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-rose-100 border border-rose-300 inline-block" />
          Rented
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-zinc-100 border border-zinc-200 inline-block" />
          Unavailable
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-zinc-900 inline-block" />
          Selected
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-zinc-100 border border-zinc-300 inline-block" />
          In Range
        </span>
      </div>

    </div>
  );
};
