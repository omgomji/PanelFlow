'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isToday,
  isBefore,
  startOfDay,
} from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import type { PublicSlotItem } from '@/types/public';

interface BookingCalendarProps {
  /** Called when a new date is selected — should return available slot ISO strings */
  fetchSlots: (date: string) => Promise<PublicSlotItem[]>;
  /** Called when the user clicks Next on a slot */
  onSlotSelect: (slotIso: string, hostDate: string) => void;
  /** Timezone to display slot times in */
  timezone: string;
}

/**
 * Shared calendar + time-slot picker component.
 * Used by both the individual booking page and the panel booking page.
 * Parameterized by a slots-fetching function and a submit handler so
 * the two flows share one implementation.
 */
export default function BookingCalendar({
  fetchSlots,
  onSlotSelect,
  timezone,
}: BookingCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);

  const loadSlots = useCallback(
    async (date: Date) => {
      setSlotsLoading(true);
      setSelectedSlot(null);
      try {
        const formattedDate = format(date, 'yyyy-MM-dd');
        const data = await fetchSlots(formattedDate);
        setAvailableSlots(data.map((s) => s.time));
      } catch {
        setAvailableSlots([]);
      } finally {
        setSlotsLoading(false);
      }
    },
    [fetchSlots]
  );

  const handleDateClick = (date: Date) => {
    if (isBefore(date, startOfDay(new Date()))) return;
    setSelectedDate(date);
    loadSlots(date);
  };

  // Auto-refresh slots on window focus and every 15s
  useEffect(() => {
    if (!selectedDate) return;
    const refresh = () => void loadSlots(selectedDate);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [selectedDate, loadSlots]);

  useEffect(() => {
    if (!selectedDate) return;
    const id = window.setInterval(() => void loadSlots(selectedDate), 15000);
    return () => window.clearInterval(id);
  }, [selectedDate, loadSlots]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = monthStart.getDay();
  const paddingDays = Array(startDayOfWeek).fill(null);

  return (
    <div>
      <h2 className="text-[18px] font-bold text-slate-900 mb-4">Select a Date &amp; Time</h2>

      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          disabled={isBefore(startOfMonth(currentMonth), startOfMonth(new Date()))}
          className="inline-flex h-11 w-11 items-center justify-center rounded transition-colors hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <span className="material-symbols-outlined text-[20px] text-slate-600">chevron_left</span>
        </button>
        <span className="text-[16px] font-bold text-slate-900">{format(currentMonth, 'MMMM yyyy')}</span>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="inline-flex h-11 w-11 items-center justify-center rounded transition-colors hover:bg-slate-100"
        >
          <span className="material-symbols-outlined text-[20px] text-slate-600">chevron_right</span>
        </button>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Calendar Grid */}
        <div className="flex-1">
          <div className="mb-2 grid grid-cols-7 gap-1.5 sm:gap-2">
            {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((d) => (
              <div key={d} className="text-center text-[10px] font-bold text-slate-500 py-2 sm:text-[12px]">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {paddingDays.map((_, i) => <div key={`pad-${i}`} />)}
            {daysInMonth.map((day, i) => {
              const past = isBefore(day, startOfDay(new Date()));
              const isSelected = selectedDate && isSameDay(day, selectedDate);

              return (
                <button
                  key={i}
                  disabled={past}
                  onClick={() => handleDateClick(day)}
                  className={`aspect-square rounded-md text-[13px] font-medium transition-colors
 ${past ? 'text-slate-300 cursor-not-allowed' : ''}
 ${isSelected ? 'bg-primary text-white hover:bg-blue-700' : 'text-slate-600 hover:bg-slate-100'}
 ${isToday(day) && !isSelected ? 'bg-slate-100' : ''}`}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>

          {/* Timezone */}
          <div className="mt-6 text-[12px] text-slate-600">
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-[16px]">public</span>
              <strong>Time zone</strong>
            </div>
            <span className="text-primary font-bold">{timezone}</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">Times shown in host timezone.</p>
        </div>

        {/* Time Slots */}
        {selectedDate && (
          <div className="w-full rounded-lg border border-slate-200 bg-slate-50 p-4 lg:w-56">
            <div className="text-[14px] font-bold text-slate-900 mb-4">
              {format(selectedDate, 'EEEE, MMMM d')}
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {slotsLoading ? (
                <div className="text-center py-6">
                  <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-primary mx-auto" />
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-[12px]">
                  No time slots available
                </div>
              ) : (
                availableSlots.map((slotIso) => {
                  const slotDate = new Date(slotIso);
                  const slotTime = formatInTimeZone(slotDate, timezone, 'h:mma');
                  const isSelected = selectedSlot === slotIso;
                  const slotHostDate = formatInTimeZone(slotDate, timezone, 'yyyy-MM-dd');

                  return (
                    <div key={slotIso} className="flex gap-2">
                      <button
                        onClick={() => setSelectedSlot(slotIso)}
                        className={`flex-1 py-2 px-3 rounded-lg text-[12px] font-bold transition-colors
 ${isSelected
 ? 'bg-slate-700 text-white'
 : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-300'
 }`}
                      >
                        {slotTime}
                      </button>
                      {isSelected && (
                        <button
                          onClick={() => onSlotSelect(slotIso, slotHostDate)}
                          className="min-h-11 rounded-lg bg-primary px-4 py-2 text-[12px] font-bold text-white transition-colors hover:bg-blue-700"
                        >
                          Next
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
