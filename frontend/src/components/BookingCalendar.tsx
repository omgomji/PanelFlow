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
  fetchSlots: (date: string) => Promise<PublicSlotItem[]>;
  onSlotSelect: (slotIso: string, hostDate: string) => void;
  timezone: string;
}

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
      <div className="mb-6 border-b-2 border-ink pb-4">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-stamp">
          Availability
        </p>
        <h2 className="mt-1 font-display text-xl font-bold tracking-tight text-ink">
          Select a date and time
        </h2>
      </div>

      <div className="mb-6 flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          disabled={isBefore(startOfMonth(currentMonth), startOfMonth(new Date()))}
          className="inline-flex h-10 w-10 items-center justify-center border border-clay/40 text-ink/70 transition-colors hover:bg-clay/10 hover:text-ink disabled:pointer-events-none disabled:opacity-30"
          aria-label="Previous month"
        >
          <span className="material-symbols-outlined text-[20px]">chevron_left</span>
        </button>
        <span className="font-display text-base font-bold uppercase tracking-wide text-ink">
          {format(currentMonth, 'MMMM yyyy')}
        </span>
        <button
          type="button"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="inline-flex h-10 w-10 items-center justify-center border border-clay/40 text-ink/70 transition-colors hover:bg-clay/10 hover:text-ink"
          aria-label="Next month"
        >
          <span className="material-symbols-outlined text-[20px]">chevron_right</span>
        </button>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="min-w-0 flex-1">
          <div className="mb-2 grid grid-cols-7 gap-1">
            {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day) => (
              <div
                key={day}
                className="py-2 text-center font-mono text-[10px] font-semibold tracking-wider text-ink/45 sm:text-[11px]"
              >
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {paddingDays.map((_, index) => <div key={`pad-${index}`} />)}
            {daysInMonth.map((day, index) => {
              const past = isBefore(day, startOfDay(new Date()));
              const isSelected = selectedDate && isSameDay(day, selectedDate);

              return (
                <button
                  key={index}
                  type="button"
                  disabled={past}
                  onClick={() => handleDateClick(day)}
                  className={`aspect-square min-h-10 border text-sm font-display font-semibold transition-colors
                    ${past ? 'cursor-not-allowed border-transparent text-ink/20' : 'border-transparent text-ink hover:border-clay/40 hover:bg-clay/5'}
                    ${isSelected ? 'border-ink bg-ink text-paper hover:bg-ink hover:text-paper' : ''}
                    ${isToday(day) && !isSelected ? 'border-stamp/60 text-stamp' : ''}`}
                  aria-label={format(day, 'EEEE, MMMM d, yyyy')}
                  aria-pressed={Boolean(isSelected)}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>

          <div className="mt-7 flex items-start gap-2 border-t border-clay/30 pt-4 text-xs text-ink/55">
            <span className="material-symbols-outlined text-[16px]">public</span>
            <span>
              Times are shown in <strong className="font-mono text-[11px] text-ink/75">{timezone}</strong>.
            </span>
          </div>
        </div>

        <div className="w-full border-t-2 border-ink pt-6 lg:w-64 lg:border-l-2 lg:border-t-0 lg:pl-6 lg:pt-0">
          {!selectedDate ? (
            <div className="flex h-full min-h-40 items-center justify-center text-center">
              <div>
                <span className="material-symbols-outlined text-3xl text-ink/25">event</span>
                <p className="mt-2 font-display text-sm font-bold uppercase tracking-wide text-ink/50">
                  Pick a date
                </p>
                <p className="mt-1 text-xs text-ink/40">Available times will appear here.</p>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/45">
                  Selected date
                </p>
                <h3 className="mt-1 font-display text-base font-bold text-ink">
                  {format(selectedDate, 'EEEE, MMMM d')}
                </h3>
              </div>

              <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {slotsLoading ? (
                  <div className="flex flex-col items-center justify-center py-10">
                    <div className="h-6 w-6 animate-spin border-2 border-clay/30 border-b-stamp" />
                    <span className="mt-3 font-mono text-[10px] font-semibold uppercase tracking-wider text-ink/45">
                      Checking
                    </span>
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div className="border border-clay/40 bg-clay/5 px-4 py-6 text-center">
                    <span className="material-symbols-outlined text-2xl text-ink/30">schedule</span>
                    <p className="mt-2 font-display text-sm font-bold text-ink/60">No times available</p>
                    <p className="mt-1 text-xs text-ink/45">Try another date.</p>
                  </div>
                ) : (
                  availableSlots.map((slotIso) => {
                    const slotTime = formatInTimeZone(new Date(slotIso), timezone, 'h:mma');
                    const isSelected = selectedSlot === slotIso;

                    return (
                      <button
                        key={slotIso}
                        type="button"
                        onClick={() => {
                          setSelectedSlot(slotIso);
                          onSlotSelect(slotIso, format(selectedDate, 'yyyy-MM-dd'));
                        }}
                        className={`w-full border-2 px-4 py-3 text-left font-display text-sm font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-stamp
                          ${isSelected
                            ? 'border-ink bg-ink text-paper'
                            : 'border-ink bg-paper text-stamp hover:bg-clay/5'}
                        `}
                      >
                        <span className="flex items-center justify-between gap-3">
                          <span>{slotTime}</span>
                          <span className="font-mono text-[10px] uppercase tracking-wider opacity-60">
                            Select
                          </span>
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
