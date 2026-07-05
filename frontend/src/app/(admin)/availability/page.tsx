'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { getAvailability, getEventTypes, updateAvailability } from '@/lib/api';
import type {
  AvailabilityDateOverridePayload,
  AvailabilitySchedule,
} from '@/types/availability';
import type { EventType } from '@/types/event-types';
import { addMonths, endOfMonth, format, startOfMonth, subMonths } from 'date-fns';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const FULL_DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;

type AvailabilityTab = 'Schedules' | 'Calendar settings' | 'Advanced settings';

type AvailabilityDay = {
  dayOfWeek: number;
  startTime?: string;
  endTime?: string;
  isUnavailable?: boolean;
  intervals?: { startTime: string; endTime: string }[];
};

type DateOverrideTimeDropdownState = {
  date: string;
  intervalIndex: number;
  type: 'start' | 'end';
};

export default function AvailabilityPage() {
  const [activeMainTab, setActiveMainTab] = useState<AvailabilityTab>('Schedules');
  const [viewMode, setViewMode] = useState<'List' | 'Calendar'>('List');
  const [availability, setAvailability] = useState<AvailabilityDay[]>([]);
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dateOverrides, setDateOverrides] = useState<AvailabilityDateOverridePayload[]>([]);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(null);
  const [showWorkingHoursModal, setShowWorkingHoursModal] = useState(false);
  const [showActiveOnModal, setShowActiveOnModal] = useState(false);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [selectedEventTypes, setSelectedEventTypes] = useState<number[]>([]);
  const [loadingEventTypes, setLoadingEventTypes] = useState(true);
  const [showTimeDropdown, setShowTimeDropdown] = useState<{ dayId: number; intervalIndex: number; type: 'start' | 'end' } | null>(null);
  const [showDateOverrideTimeDropdown, setShowDateOverrideTimeDropdown] =
    useState<DateOverrideTimeDropdownState | null>(null);
  const [copyMenuDay, setCopyMenuDay] = useState<number | null>(null);
  const [copyTargets, setCopyTargets] = useState<number[]>([]);
  const [showTimezoneDropdown, setShowTimezoneDropdown] = useState(false);

  const timezoneOptions = [
    'Pacific/Honolulu',
    'America/Anchorage',
    'America/Los_Angeles',
    'America/Denver',
    'America/Chicago',
    'America/New_York',
    'America/Sao_Paulo',
    'Atlantic/Reykjavik',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Europe/Moscow',
    'Africa/Cairo',
    'Asia/Dubai',
    'Asia/Kolkata',
    'Asia/Dhaka',
    'Asia/Bangkok',
    'Asia/Singapore',
    'Asia/Shanghai',
    'Asia/Tokyo',
    'Asia/Seoul',
    'Australia/Sydney',
    'Pacific/Auckland',
  ];

  // Generate time options from 12:00am to 11:30pm
  const generateTimeOptions = () => {
    const times = [];
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const h = hour % 12 || 12;
        const ampm = hour < 12 ? 'am' : 'pm';
        const m = minute.toString().padStart(2, '0');
        times.push(`${h}:${m}${ampm}`);
      }
    }
    return times;
  };

  const timeOptions = generateTimeOptions();

  const [calendarSettings, setCalendarSettings] = useState({
    checkConflicts: true,
    autoAddEvents: true,
    markAsBusy: true,
    conflictCalendar: 'Google - alex@orchestrator.io',
    connectedCalendars: [
      { id: 'g-main', name: 'Google - alex@orchestrator.io', type: 'Google Calendar', status: 'Connected' },
      { id: 'o-work', name: 'Outlook - team@orchestrator.io', type: 'Outlook', status: 'Connected' },
    ],
  });

  const [advancedSettings, setAdvancedSettings] = useState({
    beforeEventBuffer: '15',
    afterEventBuffer: '15',
    minimumNotice: '4',
    maximumDaysInFuture: '60',
    startIncrements: '30',
    allowBackToBack: true,
  });

  const mainTabs: AvailabilityTab[] = ['Schedules', 'Calendar settings', 'Advanced settings'];

  useEffect(() => {
    fetchAvailability();
    fetchEventTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!showTimeDropdown) return;

    const handlePointerDown = (event: MouseEvent | PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      if (target.closest('[data-time-picker="true"]')) return;
      setShowTimeDropdown(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowTimeDropdown(null);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showTimeDropdown]);

  useEffect(() => {
    if (!showDateOverrideTimeDropdown) return;

    const handlePointerDown = (event: MouseEvent | PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      if (target.closest('[data-override-time-picker="true"]')) return;
      setShowDateOverrideTimeDropdown(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowDateOverrideTimeDropdown(null);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showDateOverrideTimeDropdown]);

  useEffect(() => {
    if (copyMenuDay === null) return;

    const handlePointerDown = (event: MouseEvent | PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      if (target.closest('[data-copy-menu="true"]')) return;
      setCopyMenuDay(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCopyMenuDay(null);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [copyMenuDay]);

  useEffect(() => {
    if (!showTimezoneDropdown) return;

    const handlePointerDown = (event: MouseEvent | PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      if (target.closest('[data-timezone-dropdown="true"]')) return;
      setShowTimezoneDropdown(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowTimezoneDropdown(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showTimezoneDropdown]);

  const fetchEventTypes = async () => {
    try {
      setLoadingEventTypes(true);
      const eventTypesArray = await getEventTypes();
      setEventTypes(eventTypesArray);
      
      // Initialize with all event types selected
      if (eventTypesArray.length > 0) {
        setSelectedEventTypes(eventTypesArray.map((et: EventType) => et.id));
      }
    } catch (error) {
      console.error('Error fetching event types:', error);
      setEventTypes([]);
    } finally {
      setLoadingEventTypes(false);
    }
  };

  const normalizeDateKey = (value: string | Date) => {
    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }

    const rawValue = String(value || '').trim();
    if (!rawValue) return '';
    if (DATE_KEY_REGEX.test(rawValue)) return rawValue;

    const parsed = new Date(rawValue);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toISOString().slice(0, 10);
  };

  const sortDateOverrides = (items: AvailabilityDateOverridePayload[]) =>
    [...items].sort((a, b) => a.date.localeCompare(b.date));

  const getDateKey = (date: Date) => format(date, 'yyyy-MM-dd');

  const getDateOverride = (dateKey: string) =>
    dateOverrides.find((override) => override.date === dateKey);

  const fetchAvailability = async () => {
    try {
      setLoading(true);
      const data = (await getAvailability()) as AvailabilitySchedule | AvailabilityDay[];

      if (!Array.isArray(data) && data.message === 'No schedule found') {
        setAvailability(DAY_NAMES.map((_, index) => ({ dayOfWeek: index, isUnavailable: true, intervals: [] })));
        setDateOverrides([]);
        setSelectedCalendarDate(null);
        setIsDirty(false);
        setSaveMessage(null);
        setSaveError(null);
        return;
      }

      const rawDays = Array.isArray(data) ? data : (data.days ?? []);
      const rawDateOverrides = Array.isArray(data)
        ? []
        : (data.dateOverrides ?? []);

      if (!Array.isArray(data) && data.timezone) {
        setTimezone(data.timezone);
        setAdvancedSettings((prev) => ({
          ...prev,
          beforeEventBuffer: String(
            data.beforeEventBufferMinutes ?? prev.beforeEventBuffer
          ),
          afterEventBuffer: String(
            data.afterEventBufferMinutes ?? prev.afterEventBuffer
          ),
          minimumNotice: String(
            Math.max(0, Math.floor((data.minimumNoticeMinutes ?? 0) / 60))
          ),
          maximumDaysInFuture: String(
            data.maximumDaysInFuture ?? prev.maximumDaysInFuture
          ),
          startIncrements: String(
            data.startTimeIncrementMinutes ?? prev.startIncrements
          ),
          allowBackToBack: data.allowBackToBack ?? prev.allowBackToBack,
        }));
      }

      const fullWeek = DAY_NAMES.map((_, index) => {
        const found = rawDays.find((a) => a.dayOfWeek === index);
        if (found) {
          const intervals = Array.isArray(found.intervals)
            ? found.intervals
                .map((interval) => ({
                  startTime: formatTime(interval.startTime),
                  endTime: formatTime(interval.endTime),
                }))
                .filter((interval) => interval.startTime && interval.endTime)
            : [];

          const hasPrimaryInterval = intervals.length > 0;
          return {
            ...found,
            isUnavailable: !hasPrimaryInterval,
            intervals,
            startTime: hasPrimaryInterval ? intervals[0].startTime : undefined,
            endTime: hasPrimaryInterval ? intervals[0].endTime : undefined,
          };
        }

        return { dayOfWeek: index, isUnavailable: true, intervals: [] };
      });

      const normalizedDateOverrides = sortDateOverrides(
        rawDateOverrides
          .map((override) => {
            const date = normalizeDateKey(override.date);
            if (!DATE_KEY_REGEX.test(date)) {
              return null;
            }

            const intervals = Array.isArray(override.intervals)
              ? override.intervals
                  .map((interval) => ({
                    startTime: formatTime(interval.startTime),
                    endTime: formatTime(interval.endTime),
                  }))
                  .filter((interval) => interval.startTime && interval.endTime)
              : [];

            return {
              date,
              intervals,
            };
          })
          .filter(
            (override): override is AvailabilityDateOverridePayload =>
              override !== null
          )
      );

      setAvailability(fullWeek);
      setDateOverrides(normalizedDateOverrides);
      setIsDirty(false);
      setSaveMessage(null);
      setSaveError(null);
    } catch (error) {
      console.error('Error fetching availability:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';

    const normalized = timeStr.trim().toLowerCase();
    if (normalized.includes('am') || normalized.includes('pm')) {
      return normalized.replace(/\s+/g, '');
    }

    const [hour = '0', minute = '00'] = normalized.split(':');
    const h = parseInt(hour, 10);
    const ampm = h >= 12 ? 'pm' : 'am';
    const displayHour = h % 12 || 12;
    return `${displayHour}:${minute}${ampm}`;
  };

  const toMinutes = (timeStr?: string) => {
    if (!timeStr) return 0;
    const normalized = timeStr.trim().toLowerCase();

    if (normalized.includes('am') || normalized.includes('pm')) {
      const match = normalized.match(/^(\d{1,2}):(\d{2})(am|pm)$/);
      if (!match) return 0;
      let hour = parseInt(match[1], 10);
      const minute = parseInt(match[2], 10);
      const period = match[3];
      if (period === 'pm' && hour !== 12) hour += 12;
      if (period === 'am' && hour === 12) hour = 0;
      return hour * 60 + minute;
    }

    const [hour = '0', minute = '00'] = normalized.split(':');
    return parseInt(hour, 10) * 60 + parseInt(minute, 10);
  };

  const isValidTime = (timeStr?: string) => {
    if (!timeStr) return false;
    const normalized = timeStr.trim().toLowerCase();

    if (normalized.includes('am') || normalized.includes('pm')) {
      return /^(0?[1-9]|1[0-2]):[0-5]\d(am|pm)$/.test(normalized);
    }

    return /^([01]?\d|2[0-3]):[0-5]\d$/.test(normalized);
  };

  const minutesTo12h = (minutes: number) => {
    const normalized = ((minutes % 1440) + 1440) % 1440;
    const hour24 = Math.floor(normalized / 60);
    const minute = normalized % 60;
    const hour12 = hour24 % 12 || 12;
    const ampm = hour24 < 12 ? 'am' : 'pm';
    return `${hour12}:${minute.toString().padStart(2, '0')}${ampm}`;
  };

  const to24Hour = (timeStr: string): string | null => {
    if (!isValidTime(timeStr)) return null;

    const minutes = toMinutes(timeStr);
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  };

  const markDirty = () => {
    setIsDirty(true);
    setSaveMessage(null);
    setSaveError(null);
  };

  const getDayIntervals = (day: AvailabilityDay) => {
    if (Array.isArray(day.intervals) && day.intervals.length > 0) return day.intervals;
    if (day.startTime && day.endTime) return [{ startTime: day.startTime, endTime: day.endTime }];
    return [];
  };

  const syncDayWithIntervals = (day: AvailabilityDay, intervals: { startTime: string; endTime: string }[]): AvailabilityDay => {
    const isUnavailable = intervals.length === 0;
    return {
      ...day,
      intervals,
      isUnavailable,
      startTime: isUnavailable ? undefined : intervals[0].startTime,
      endTime: isUnavailable ? undefined : intervals[0].endTime,
    };
  };

  const getDayTotalHours = (day: AvailabilityDay) => {
    const intervals = getDayIntervals(day);
    return getIntervalsTotalHours(intervals);
  };

  const getIntervalsTotalHours = (
    intervals: { startTime: string; endTime: string }[]
  ) => {
    if (intervals.length === 0) return 0;

    const totalMinutes = intervals.reduce((acc, interval) => {
      const diff = toMinutes(interval.endTime) - toMinutes(interval.startTime);
      return acc + (diff > 0 ? diff : 0);
    }, 0);

    return Math.round((totalMinutes / 60) * 10) / 10;
  };

  const getWeeklyIntervalsForDate = (date: Date) => {
    const weeklyRule = availability.find((item) => item.dayOfWeek === date.getDay());
    if (!weeklyRule) return [];

    return getDayIntervals(weeklyRule).map((interval) => ({ ...interval }));
  };

  const upsertDateOverride = (
    date: string,
    intervals: { startTime: string; endTime: string }[]
  ) => {
    setDateOverrides((prev) => {
      const next = [...prev];
      const existingIndex = next.findIndex((override) => override.date === date);
      const payload: AvailabilityDateOverridePayload = {
        date,
        intervals,
      };

      if (existingIndex >= 0) {
        next[existingIndex] = payload;
      } else {
        next.push(payload);
      }

      return sortDateOverrides(next);
    });

    markDirty();
  };

  const removeDateOverride = (date: string) => {
    setDateOverrides((prev) => prev.filter((override) => override.date !== date));
    setShowDateOverrideTimeDropdown((current) =>
      current?.date === date ? null : current
    );
    markDirty();
  };

  const handleCreateDateOverrideFromWeekly = (date: Date) => {
    const dateKey = getDateKey(date);
    const weeklyIntervals = getWeeklyIntervalsForDate(date);

    upsertDateOverride(
      dateKey,
      weeklyIntervals.length > 0
        ? weeklyIntervals
        : [{ startTime: '9:00am', endTime: '5:00pm' }]
    );
  };

  const handleMarkDateUnavailable = (date: Date) => {
    const dateKey = getDateKey(date);
    upsertDateOverride(dateKey, []);
  };

  const handleAddDateOverrideInterval = (
    date: string,
    insertAfterIndex?: number
  ) => {
    const existing = getDateOverride(date);
    const intervals = [...(existing?.intervals ?? [])];
    let newInterval = { startTime: '9:00am', endTime: '5:00pm' };

    if (
      typeof insertAfterIndex === 'number' &&
      insertAfterIndex >= 0 &&
      insertAfterIndex < intervals.length
    ) {
      const previous = intervals[insertAfterIndex];
      if (isValidTime(previous.endTime)) {
        const startMinutes = toMinutes(previous.endTime) + 60;
        const endMinutes = startMinutes + 60;
        newInterval = {
          startTime: minutesTo12h(startMinutes),
          endTime: minutesTo12h(endMinutes),
        };
      } else {
        newInterval = { startTime: '9:00am', endTime: '10:00am' };
      }
    }

    if (
      typeof insertAfterIndex === 'number' &&
      insertAfterIndex >= 0 &&
      insertAfterIndex < intervals.length
    ) {
      intervals.splice(insertAfterIndex + 1, 0, newInterval);
    } else {
      intervals.push(newInterval);
    }

    upsertDateOverride(date, intervals);
  };

  const handleRemoveDateOverrideInterval = (date: string, intervalIndex: number) => {
    const existing = getDateOverride(date);
    if (!existing) return;

    const intervals = [...existing.intervals];
    if (intervalIndex < 0 || intervalIndex >= intervals.length) return;

    intervals.splice(intervalIndex, 1);
    upsertDateOverride(date, intervals);

    setShowDateOverrideTimeDropdown((current) =>
      current && current.date === date && current.intervalIndex === intervalIndex
        ? null
        : current
    );
  };

  const handleChangeDateOverrideIntervalTime = (
    date: string,
    intervalIndex: number,
    type: 'start' | 'end',
    time: string
  ) => {
    const existing = getDateOverride(date);
    if (!existing) return;

    const intervals = [...existing.intervals];
    if (intervalIndex < 0 || intervalIndex >= intervals.length) return;

    const nextValue = time.trim().toLowerCase();
    intervals[intervalIndex] = {
      ...intervals[intervalIndex],
      [type === 'start' ? 'startTime' : 'endTime']: nextValue,
    };

    upsertDateOverride(date, intervals);
  };

  const handleAddInterval = (dayOfWeek: number, insertAfterIndex?: number) => {
    setAvailability((prev) =>
      prev.map((day) => {
        if (day.dayOfWeek !== dayOfWeek) return day;

        const intervals = [...getDayIntervals(day)];
        let newInterval = { startTime: '9:00am', endTime: '5:00pm' };

        if (typeof insertAfterIndex === 'number' && insertAfterIndex >= 0 && insertAfterIndex < intervals.length) {
          const previous = intervals[insertAfterIndex];
          if (isValidTime(previous.endTime)) {
            const startMinutes = toMinutes(previous.endTime) + 60;
            const endMinutes = startMinutes + 60;
            newInterval = {
              startTime: minutesTo12h(startMinutes),
              endTime: minutesTo12h(endMinutes),
            };
          } else {
            newInterval = { startTime: '9:00am', endTime: '10:00am' };
          }
        }

        if (typeof insertAfterIndex === 'number' && insertAfterIndex >= 0 && insertAfterIndex < intervals.length) {
          intervals.splice(insertAfterIndex + 1, 0, newInterval);
        } else {
          intervals.push(newInterval);
        }

        return syncDayWithIntervals(day, intervals);
      })
    );

    markDirty();
  };

  const handleRemoveInterval = (dayOfWeek: number, intervalIndex: number) => {
    setAvailability((prev) =>
      prev.map((day) => {
        if (day.dayOfWeek !== dayOfWeek) return day;

        const intervals = [...getDayIntervals(day)];
        if (intervalIndex < 0 || intervalIndex >= intervals.length) return day;

        intervals.splice(intervalIndex, 1);
        return syncDayWithIntervals(day, intervals);
      })
    );

    markDirty();

    setShowTimeDropdown((current) =>
      current && current.dayId === dayOfWeek && current.intervalIndex === intervalIndex ? null : current
    );
  };

  const handleChangeIntervalTime = (
    dayOfWeek: number,
    intervalIndex: number,
    type: 'start' | 'end',
    time: string
  ) => {
    setAvailability((prev) =>
      prev.map((day) => {
        if (day.dayOfWeek !== dayOfWeek) return day;

        const intervals = [...getDayIntervals(day)];
        if (intervalIndex < 0 || intervalIndex >= intervals.length) return day;

        const nextValue = time.trim().toLowerCase();
        intervals[intervalIndex] = {
          ...intervals[intervalIndex],
          [type === 'start' ? 'startTime' : 'endTime']: nextValue,
        };

        return syncDayWithIntervals(day, intervals);
      })
    );

    markDirty();
  };

  const handleOpenCopyMenu = (dayOfWeek: number) => {
    setCopyMenuDay(dayOfWeek);
    setCopyTargets([dayOfWeek]);
  };

  const handleToggleCopyTarget = (dayOfWeek: number) => {
    if (copyMenuDay === null || dayOfWeek === copyMenuDay) return;

    setCopyTargets((prev) =>
      prev.includes(dayOfWeek) ? prev.filter((d) => d !== dayOfWeek) : [...prev, dayOfWeek]
    );
  };

  const handleApplyCopyToDays = () => {
    if (copyMenuDay === null) return;

    const sourceDay = availability.find((d) => d.dayOfWeek === copyMenuDay);
    if (!sourceDay) return;

    const sourceIntervals = getDayIntervals(sourceDay);
    if (sourceIntervals.length === 0) {
      setCopyMenuDay(null);
      return;
    }

    setAvailability((prev) =>
      prev.map((day) => {
        if (!copyTargets.includes(day.dayOfWeek) || day.dayOfWeek === copyMenuDay) return day;
        return syncDayWithIntervals(
          day,
          sourceIntervals.map((interval) => ({ ...interval }))
        );
      })
    );

    markDirty();

    setCopyMenuDay(null);
  };

  const handleSaveAvailability = async () => {
    try {
      setSaving(true);
      setSaveError(null);
      setSaveMessage(null);

      const days = availability
        .map((day) => {
          const normalizedIntervals = getDayIntervals(day)
            .map((interval) => {
              const startTime = to24Hour(interval.startTime);
              const endTime = to24Hour(interval.endTime);

              if (!startTime || !endTime) {
                throw new Error(`Invalid time format for ${FULL_DAY_NAMES[day.dayOfWeek]}. Use HH:mm or h:mma format.`);
              }

              if (toMinutes(startTime) >= toMinutes(endTime)) {
                throw new Error(`Start time must be earlier than end time for ${FULL_DAY_NAMES[day.dayOfWeek]}.`);
              }

              return { startTime, endTime };
            })
            .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));

          for (let i = 1; i < normalizedIntervals.length; i += 1) {
            if (toMinutes(normalizedIntervals[i].startTime) < toMinutes(normalizedIntervals[i - 1].endTime)) {
              throw new Error(`Intervals overlap on ${FULL_DAY_NAMES[day.dayOfWeek]}.`);
            }
          }

          return {
            dayOfWeek: day.dayOfWeek,
            intervals: normalizedIntervals,
          };
        })
        .sort((a, b) => a.dayOfWeek - b.dayOfWeek);

      const seenOverrideDates = new Set<string>();
      const normalizedDateOverrides = dateOverrides
        .map((override) => {
          const date = normalizeDateKey(override.date);
          if (!DATE_KEY_REGEX.test(date)) {
            throw new Error(`Invalid override date: ${override.date}`);
          }
          if (seenOverrideDates.has(date)) {
            throw new Error(`Duplicate date override found for ${date}.`);
          }
          seenOverrideDates.add(date);

          const normalizedIntervals = override.intervals
            .map((interval) => {
              const startTime = to24Hour(interval.startTime);
              const endTime = to24Hour(interval.endTime);

              if (!startTime || !endTime) {
                throw new Error(`Invalid time format for date override ${date}.`);
              }

              if (toMinutes(startTime) >= toMinutes(endTime)) {
                throw new Error(`Start time must be earlier than end time for ${date}.`);
              }

              return { startTime, endTime };
            })
            .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime));

          for (let i = 1; i < normalizedIntervals.length; i += 1) {
            if (
              toMinutes(normalizedIntervals[i].startTime) <
              toMinutes(normalizedIntervals[i - 1].endTime)
            ) {
              throw new Error(`Date override intervals overlap on ${date}.`);
            }
          }

          return {
            date,
            intervals: normalizedIntervals,
          };
        })
        .sort((a, b) => a.date.localeCompare(b.date));

      const beforeEventBufferMinutes = Number.parseInt(
        advancedSettings.beforeEventBuffer,
        10
      );
      const afterEventBufferMinutes = Number.parseInt(
        advancedSettings.afterEventBuffer,
        10
      );
      const startTimeIncrementMinutes = Number.parseInt(
        advancedSettings.startIncrements,
        10
      );
      const minimumNoticeHours = Number.parseInt(
        advancedSettings.minimumNotice,
        10
      );
      const maximumDaysInFuture = Number.parseInt(
        advancedSettings.maximumDaysInFuture,
        10
      );

      if (!Number.isInteger(beforeEventBufferMinutes) || beforeEventBufferMinutes < 0) {
        throw new Error('Before event buffer must be a non-negative integer.');
      }

      if (!Number.isInteger(afterEventBufferMinutes) || afterEventBufferMinutes < 0) {
        throw new Error('After event buffer must be a non-negative integer.');
      }

      if (!Number.isInteger(startTimeIncrementMinutes) || startTimeIncrementMinutes < 5) {
        throw new Error('Start time increment must be at least 5 minutes.');
      }

      if (!Number.isInteger(minimumNoticeHours) || minimumNoticeHours < 0) {
        throw new Error('Minimum scheduling notice must be a non-negative integer.');
      }

      if (!Number.isInteger(maximumDaysInFuture) || maximumDaysInFuture < 1) {
        throw new Error('Maximum days in advance must be at least 1.');
      }

      await updateAvailability({
        timezone,
        days,
        dateOverrides: normalizedDateOverrides,
        beforeEventBufferMinutes,
        afterEventBufferMinutes,
        startTimeIncrementMinutes,
        minimumNoticeMinutes: minimumNoticeHours * 60,
        maximumDaysInFuture,
        allowBackToBack: advancedSettings.allowBackToBack,
      });
      await fetchAvailability();
      setSaveMessage('Availability saved successfully.');
    } catch (error) {
      if (axios.isAxiosError<{ error?: string }>(error)) {
        setSaveError(error.response?.data?.error || 'Failed to save availability.');
      } else if (error instanceof Error) {
        setSaveError(error.message);
      } else {
        setSaveError('Failed to save availability.');
      }
    } finally {
      setSaving(false);
    }
  };

  const renderSchedulesList = () => (
    <div className="px-5 py-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[12px] font-medium font-bold text-ink">Weekly hours</span>
        <span className="text-[10px] text-ink/60">Set when you are regularly available each week.</span>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="h-6 w-6 animate-spin rounded-sm border-b-2 border-stamp border-2" />
        </div>
      ) : (
        <div className="space-y-3">
          {availability.map((item) => {
            const intervals = getDayIntervals(item);
            const dayLabel = DAY_NAMES[item.dayOfWeek][0];

            if (intervals.length === 0) {
              return (
                <div key={item.dayOfWeek} className="flex flex-wrap items-center gap-2 sm:gap-3">
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-sm bg-stamp text-paper">
                    <span className="text-[11px] font-bold">{dayLabel}</span>
                  </div>
                  <span className="text-[13px] font-medium text-ink/60">Unavailable</span>
                  <button
                    type="button"
                    onClick={() => handleAddInterval(item.dayOfWeek)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded text-ink/70 hover:bg-clay/10 sm:h-6 sm:w-6"
                    title="Add interval"
                  >
                    <span className="material-symbols-outlined text-[18px]">add_circle</span>
                  </button>
                </div>
              );
            }

            return (
              <div key={item.dayOfWeek} className="space-y-2">
                {intervals.map((interval, intervalIndex) => {
                  const hasInvalidRange =
                    isValidTime(interval.startTime) &&
                    isValidTime(interval.endTime) &&
                    toMinutes(interval.startTime) > toMinutes(interval.endTime);

                  return (
                  <div key={`${item.dayOfWeek}-${intervalIndex}`} className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    {intervalIndex === 0 ? (
                      <div className="inline-flex h-8 w-8 items-center justify-center rounded-sm bg-stamp text-paper">
                        <span className="text-[11px] font-bold">{dayLabel}</span>
                      </div>
                    ) : (
                      <div className="h-8 w-8" />
                    )}

                    <div className="relative" data-time-picker="true">
                      <div className={`flex min-w-[96px] items-center rounded-sm bg-clay/5 px-2 py-1 ${hasInvalidRange ? 'ring-1 ring-red-400' : ''}`}>
                        <input
                          type="text"
                          value={interval.startTime}
                          onChange={(e) => handleChangeIntervalTime(item.dayOfWeek, intervalIndex, 'start', e.target.value)}
                          onFocus={() =>
                            setShowTimeDropdown({ dayId: item.dayOfWeek, intervalIndex, type: 'start' })
                          }
                          onBlur={() => {
                            if (isValidTime(interval.startTime)) {
                              handleChangeIntervalTime(item.dayOfWeek, intervalIndex, 'start', formatTime(interval.startTime));
                            }
                          }}
                          className="w-full bg-transparent px-1 py-1 text-[12px] font-medium text-ink/90 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowTimeDropdown(
                              showTimeDropdown?.dayId === item.dayOfWeek &&
                                showTimeDropdown?.intervalIndex === intervalIndex &&
                                showTimeDropdown?.type === 'start'
                                ? null
                                : { dayId: item.dayOfWeek, intervalIndex, type: 'start' }
                            )
                          }
                          className="inline-flex h-8 w-8 items-center justify-center text-ink/60 sm:h-5 sm:w-5"
                        >
                          <span className="material-symbols-outlined text-[14px] font-display font-semibold tracking-wide">unfold_more</span>
                        </button>
                      </div>

                      {showTimeDropdown?.dayId === item.dayOfWeek &&
                        showTimeDropdown?.intervalIndex === intervalIndex &&
                        showTimeDropdown?.type === 'start' && (
                          <div className="absolute top-full left-0 z-20 mt-1 max-h-48 w-28 overflow-y-auto rounded-sm border-2 border-ink bg-paper">
                            {timeOptions.map((time) => (
                              <button
                                key={time}
                                type="button"
                                onClick={() => {
                                  handleChangeIntervalTime(item.dayOfWeek, intervalIndex, 'start', time);
                                  setShowTimeDropdown(null);
                                }}
                                className={`block w-full px-3 py-2 text-left text-[12px] font-medium hover:bg-clay/10 ${
 interval.startTime === time ? 'bg-clay/10 font-bold text-ink' : 'text-ink/80'
 }`}
                              >
                                {time}
                              </button>
                            ))}
                          </div>
                        )}
                    </div>

                    <span className="text-[12px] font-medium text-ink/60">-</span>

                    <div className="relative" data-time-picker="true">
                      <div className={`flex min-w-[96px] items-center rounded-sm bg-clay/5 px-2 py-1 ${hasInvalidRange ? 'ring-1 ring-red-400' : ''}`}>
                        <input
                          type="text"
                          value={interval.endTime}
                          onChange={(e) => handleChangeIntervalTime(item.dayOfWeek, intervalIndex, 'end', e.target.value)}
                          onFocus={() =>
                            setShowTimeDropdown({ dayId: item.dayOfWeek, intervalIndex, type: 'end' })
                          }
                          onBlur={() => {
                            if (isValidTime(interval.endTime)) {
                              handleChangeIntervalTime(item.dayOfWeek, intervalIndex, 'end', formatTime(interval.endTime));
                            }
                          }}
                          className="w-full bg-transparent px-1 py-1 text-[12px] font-medium text-ink/90 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowTimeDropdown(
                              showTimeDropdown?.dayId === item.dayOfWeek &&
                                showTimeDropdown?.intervalIndex === intervalIndex &&
                                showTimeDropdown?.type === 'end'
                                ? null
                                : { dayId: item.dayOfWeek, intervalIndex, type: 'end' }
                            )
                          }
                          className="inline-flex h-8 w-8 items-center justify-center text-ink/60 sm:h-5 sm:w-5"
                        >
                          <span className="material-symbols-outlined text-[14px] font-display font-semibold tracking-wide">unfold_more</span>
                        </button>
                      </div>

                      {showTimeDropdown?.dayId === item.dayOfWeek &&
                        showTimeDropdown?.intervalIndex === intervalIndex &&
                        showTimeDropdown?.type === 'end' && (
                          <div className="absolute top-full left-0 z-20 mt-1 max-h-48 w-28 overflow-y-auto rounded-sm border-2 border-ink bg-paper">
                            {timeOptions.map((time) => (
                              <button
                                key={time}
                                type="button"
                                onClick={() => {
                                  handleChangeIntervalTime(item.dayOfWeek, intervalIndex, 'end', time);
                                  setShowTimeDropdown(null);
                                }}
                                className={`block w-full px-3 py-2 text-left text-[12px] font-medium hover:bg-clay/10 ${
 interval.endTime === time ? 'bg-clay/10 font-bold text-ink' : 'text-ink/80'
 }`}
                              >
                                {time}
                              </button>
                            ))}
                          </div>
                        )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveInterval(item.dayOfWeek, intervalIndex)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded text-ink/80 hover:bg-clay/10 sm:h-6 sm:w-6"
                      title="Remove interval"
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleAddInterval(item.dayOfWeek, intervalIndex)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded text-ink/80 hover:bg-clay/10 sm:h-6 sm:w-6"
                      title="Add interval"
                    >
                      <span className="material-symbols-outlined text-[18px]">add_circle</span>
                    </button>

                    {intervalIndex === 0 && (
                      <div className="relative" data-copy-menu="true">
                        <button
                          type="button"
                          onClick={() =>
                            copyMenuDay === item.dayOfWeek ? setCopyMenuDay(null) : handleOpenCopyMenu(item.dayOfWeek)
                          }
                          className={`inline-flex h-10 w-10 items-center justify-center rounded text-ink/80 hover:bg-clay/10 sm:h-8 sm:w-8 ${
 copyMenuDay === item.dayOfWeek ? 'bg-clay/20' : ''
 }`}
                          title="Copy times to other days"
                        >
                          <span className="material-symbols-outlined text-[18px]">content_copy</span>
                        </button>

                        {copyMenuDay === item.dayOfWeek && (
                          <div className="absolute right-0 top-full z-30 mt-2 w-[172px] rounded-sm border-2 border-ink bg-paper p-3">
                            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-ink/60">Copy times to...</p>
                            <div className="space-y-1">
                              {FULL_DAY_NAMES.map((name, dayIndex) => {
                                const isSourceDay = dayIndex === item.dayOfWeek;
                                const isChecked = isSourceDay || copyTargets.includes(dayIndex);

                                return (
                                  <label key={name} className="flex items-center justify-between gap-2 py-0.5 text-[13px] font-medium text-ink/90">
                                    <span>{name}</span>
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      disabled={isSourceDay}
                                      onChange={() => handleToggleCopyTarget(dayIndex)}
                                      className="h-4 w-4 rounded border-ink border-2 text-stamp disabled:opacity-50"
                                    />
                                  </label>
                                );
                              })}
                            </div>

                            <button
                              type="button"
                              onClick={handleApplyCopyToDays}
                              className="mt-3 w-full rounded-sm bg-stamp py-2 text-[12px] font-medium font-bold text-paper hover:bg-blue-700"
                            >
                              Apply
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    </div>
                    {hasInvalidRange && (
                      <div className="ml-0 pl-10 text-[11px] text-oxblood sm:ml-[44px] sm:pl-0">Start time cannot be later than end time.</div>
                    )}
                  </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderDateOverrideEditor = (selectedDate: Date) => {
    const dateKey = getDateKey(selectedDate);
    const dateOverride = getDateOverride(dateKey);
    const overrideIntervals = dateOverride?.intervals ?? [];
    const weeklyIntervals = getWeeklyIntervalsForDate(selectedDate);
    const hasOverride = Boolean(dateOverride);

    return (
      <div className="mt-4 rounded-sm border-2 border-ink bg-paper p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[14px] font-display font-semibold tracking-wide font-bold text-ink">
              {format(selectedDate, 'EEE, MMM d, yyyy')}
            </p>
            <p className="text-[11px] text-ink/60">
              {FULL_DAY_NAMES[selectedDate.getDay()]}
            </p>
          </div>
          <span
            className={`inline-flex rounded-sm px-2.5 py-1 text-[10px] font-bold ${
 hasOverride
 ? 'bg-sage/20 text-sage'
 : 'bg-clay/10 text-ink/70'
 }`}
          >
            {hasOverride ? 'Date override active' : 'Using weekly hours'}
          </span>
        </div>

        {!hasOverride && (
          <div className="mt-3 space-y-3">
            <div className="rounded-sm border-2 border-ink bg-clay/5 px-3 py-2 text-[11px] text-ink/70">
              {weeklyIntervals.length > 0 ? (
                <p>
                  Weekly hours:{' '}
                  {weeklyIntervals
                    .map((interval) => `${interval.startTime} - ${interval.endTime}`)
                    .join(', ')}
                </p>
              ) : (
                <p>This date is currently unavailable based on weekly schedule.</p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleCreateDateOverrideFromWeekly(selectedDate)}
                className="rounded-sm border-2 border-ink px-3 py-1.5 text-[11px] font-bold text-ink/80 hover:bg-clay/5"
              >
                Add custom hours override
              </button>
              <button
                type="button"
                onClick={() => handleMarkDateUnavailable(selectedDate)}
                className="rounded-sm border border-oxblood px-3 py-1.5 text-[11px] font-bold text-oxblood hover:bg-oxblood/10"
              >
                Mark unavailable
              </button>
            </div>
          </div>
        )}

        {hasOverride && (
          <div className="mt-3 space-y-3">
            {overrideIntervals.length === 0 ? (
              <div className="rounded-sm border border-oxblood bg-oxblood/10 px-3 py-2 text-[11px] text-oxblood">
                This date is marked unavailable.
              </div>
            ) : (
              <div className="space-y-2">
                {overrideIntervals.map((interval, intervalIndex) => {
                  const hasInvalidRange =
                    isValidTime(interval.startTime) &&
                    isValidTime(interval.endTime) &&
                    toMinutes(interval.startTime) >= toMinutes(interval.endTime);

                  return (
                    <div key={`${dateKey}-${intervalIndex}`} className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="relative" data-override-time-picker="true">
                          <div
                            className={`flex min-w-[96px] items-center rounded-sm bg-clay/5 px-2 py-1 ${
 hasInvalidRange ? 'ring-1 ring-red-400' : ''
 }`}
                          >
                            <input
                              type="text"
                              value={interval.startTime}
                              onChange={(e) =>
                                handleChangeDateOverrideIntervalTime(
                                  dateKey,
                                  intervalIndex,
                                  'start',
                                  e.target.value
                                )
                              }
                              onFocus={() =>
                                setShowDateOverrideTimeDropdown({
                                  date: dateKey,
                                  intervalIndex,
                                  type: 'start',
                                })
                              }
                              onBlur={() => {
                                if (isValidTime(interval.startTime)) {
                                  handleChangeDateOverrideIntervalTime(
                                    dateKey,
                                    intervalIndex,
                                    'start',
                                    formatTime(interval.startTime)
                                  );
                                }
                              }}
                              className="w-full bg-transparent px-1 py-1 text-[12px] font-medium text-ink/90 outline-none"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setShowDateOverrideTimeDropdown(
                                  showDateOverrideTimeDropdown?.date === dateKey &&
                                    showDateOverrideTimeDropdown?.intervalIndex ===
                                      intervalIndex &&
                                    showDateOverrideTimeDropdown?.type === 'start'
                                    ? null
                                    : {
                                        date: dateKey,
                                        intervalIndex,
                                        type: 'start',
                                      }
                                )
                              }
                              className="inline-flex h-8 w-8 items-center justify-center text-ink/60"
                            >
                              <span className="material-symbols-outlined text-[14px] font-display font-semibold tracking-wide">
                                unfold_more
                              </span>
                            </button>
                          </div>

                          {showDateOverrideTimeDropdown?.date === dateKey &&
                            showDateOverrideTimeDropdown?.intervalIndex === intervalIndex &&
                            showDateOverrideTimeDropdown?.type === 'start' && (
                              <div className="absolute left-0 top-full z-20 mt-1 max-h-48 w-28 overflow-y-auto rounded-sm border-2 border-ink bg-paper">
                                {timeOptions.map((time) => (
                                  <button
                                    key={`override-start-${dateKey}-${intervalIndex}-${time}`}
                                    type="button"
                                    onClick={() => {
                                      handleChangeDateOverrideIntervalTime(
                                        dateKey,
                                        intervalIndex,
                                        'start',
                                        time
                                      );
                                      setShowDateOverrideTimeDropdown(null);
                                    }}
                                    className={`block w-full px-3 py-2 text-left text-[12px] font-medium hover:bg-clay/10 ${
 interval.startTime === time
 ? 'bg-clay/10 font-bold text-ink'
 : 'text-ink/80'
 }`}
                                  >
                                    {time}
                                  </button>
                                ))}
                              </div>
                            )}
                        </div>

                        <span className="text-[12px] font-medium text-ink/60">-</span>

                        <div className="relative" data-override-time-picker="true">
                          <div
                            className={`flex min-w-[96px] items-center rounded-sm bg-clay/5 px-2 py-1 ${
 hasInvalidRange ? 'ring-1 ring-red-400' : ''
 }`}
                          >
                            <input
                              type="text"
                              value={interval.endTime}
                              onChange={(e) =>
                                handleChangeDateOverrideIntervalTime(
                                  dateKey,
                                  intervalIndex,
                                  'end',
                                  e.target.value
                                )
                              }
                              onFocus={() =>
                                setShowDateOverrideTimeDropdown({
                                  date: dateKey,
                                  intervalIndex,
                                  type: 'end',
                                })
                              }
                              onBlur={() => {
                                if (isValidTime(interval.endTime)) {
                                  handleChangeDateOverrideIntervalTime(
                                    dateKey,
                                    intervalIndex,
                                    'end',
                                    formatTime(interval.endTime)
                                  );
                                }
                              }}
                              className="w-full bg-transparent px-1 py-1 text-[12px] font-medium text-ink/90 outline-none"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setShowDateOverrideTimeDropdown(
                                  showDateOverrideTimeDropdown?.date === dateKey &&
                                    showDateOverrideTimeDropdown?.intervalIndex ===
                                      intervalIndex &&
                                    showDateOverrideTimeDropdown?.type === 'end'
                                    ? null
                                    : {
                                        date: dateKey,
                                        intervalIndex,
                                        type: 'end',
                                      }
                                )
                              }
                              className="inline-flex h-8 w-8 items-center justify-center text-ink/60"
                            >
                              <span className="material-symbols-outlined text-[14px] font-display font-semibold tracking-wide">
                                unfold_more
                              </span>
                            </button>
                          </div>

                          {showDateOverrideTimeDropdown?.date === dateKey &&
                            showDateOverrideTimeDropdown?.intervalIndex === intervalIndex &&
                            showDateOverrideTimeDropdown?.type === 'end' && (
                              <div className="absolute left-0 top-full z-20 mt-1 max-h-48 w-28 overflow-y-auto rounded-sm border-2 border-ink bg-paper">
                                {timeOptions.map((time) => (
                                  <button
                                    key={`override-end-${dateKey}-${intervalIndex}-${time}`}
                                    type="button"
                                    onClick={() => {
                                      handleChangeDateOverrideIntervalTime(
                                        dateKey,
                                        intervalIndex,
                                        'end',
                                        time
                                      );
                                      setShowDateOverrideTimeDropdown(null);
                                    }}
                                    className={`block w-full px-3 py-2 text-left text-[12px] font-medium hover:bg-clay/10 ${
 interval.endTime === time
 ? 'bg-clay/10 font-bold text-ink'
 : 'text-ink/80'
 }`}
                                  >
                                    {time}
                                  </button>
                                ))}
                              </div>
                            )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveDateOverrideInterval(dateKey, intervalIndex)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded text-ink/80 hover:bg-clay/10"
                          title="Remove interval"
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            close
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleAddDateOverrideInterval(dateKey, intervalIndex)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded text-ink/80 hover:bg-clay/10"
                          title="Add interval"
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            add_circle
                          </span>
                        </button>
                      </div>

                      {hasInvalidRange && (
                        <p className="text-[11px] text-oxblood">
                          Start time must be earlier than end time.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleAddDateOverrideInterval(dateKey)}
                className="rounded-sm border-2 border-ink px-3 py-1.5 text-[11px] font-bold text-ink/80 hover:bg-clay/5"
              >
                {overrideIntervals.length > 0 ? 'Add interval' : 'Add custom hours'}
              </button>
              <button
                type="button"
                onClick={() => handleMarkDateUnavailable(selectedDate)}
                className="rounded-sm border border-oxblood px-3 py-1.5 text-[11px] font-bold text-oxblood hover:bg-oxblood/10"
              >
                Mark unavailable
              </button>
              <button
                type="button"
                onClick={() => removeDateOverride(dateKey)}
                className="rounded-sm border-2 border-ink px-3 py-1.5 text-[11px] font-bold text-ink/80 hover:bg-clay/5"
              >
                Use weekly hours
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSchedulesCalendar = () => {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(calendarMonth);
    const startWeekDay = monthStart.getDay();
    const days = monthEnd.getDate();

    const calendarCells = Array.from(
      { length: startWeekDay + days },
      (_, index) => {
        const dayNumber = index - startWeekDay + 1;
        if (dayNumber < 1 || dayNumber > days) return null;
        return dayNumber;
      }
    );

    return (
      <div className="px-5 py-5">
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setCalendarMonth(subMonths(calendarMonth, 1))}
            className="inline-flex h-9 items-center gap-1 rounded-sm border-2 border-ink px-3 text-[11px] font-bold text-ink/80 hover:bg-clay/5 sm:h-8"
          >
            <span className="material-symbols-outlined text-[14px] font-display font-semibold tracking-wide">chevron_left</span>
            Prev
          </button>

          <h3 className="text-[14px] font-display font-semibold tracking-wide font-bold text-ink">
            {format(calendarMonth, 'MMMM yyyy')}
          </h3>

          <button
            type="button"
            onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
            className="inline-flex h-9 items-center gap-1 rounded-sm border-2 border-ink px-3 text-[11px] font-bold text-ink/80 hover:bg-clay/5 sm:h-8"
          >
            Next
            <span className="material-symbols-outlined text-[14px] font-display font-semibold tracking-wide">chevron_right</span>
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center sm:gap-2">
          {FULL_DAY_NAMES.map((dayName) => (
            <div
              key={dayName}
              className="py-1 text-[10px] font-bold uppercase tracking-wide text-ink/60"
            >
              {dayName.slice(0, 3)}
            </div>
          ))}

          {calendarCells.map((dayNumber, index) => {
            if (dayNumber === null) {
              return (
                <div
                  key={`empty-${index}`}
                  className="h-[72px] rounded-sm border border-transparent sm:h-[82px]"
                />
              );
            }

            const date = new Date(
              calendarMonth.getFullYear(),
              calendarMonth.getMonth(),
              dayNumber
            );
            const dateKey = getDateKey(date);
            const dateOverride = getDateOverride(dateKey);
            const weeklyRule = availability.find(
              (item) => item.dayOfWeek === date.getDay()
            );
            const weeklyHours = weeklyRule ? getDayTotalHours(weeklyRule) : 0;
            const overrideHours = dateOverride
              ? getIntervalsTotalHours(dateOverride.intervals)
              : 0;

            const statusText = dateOverride
              ? dateOverride.intervals.length > 0
                ? `${overrideHours}h override`
                : 'Unavailable (override)'
              : weeklyHours > 0
                ? `${weeklyHours}h available`
                : 'Unavailable';

            const statusClass = dateOverride
              ? dateOverride.intervals.length > 0
                ? 'text-sage'
                : 'text-oxblood'
              : weeklyHours > 0
                ? 'text-sage'
                : 'text-ink/50';

            const isSelected =
              selectedCalendarDate !== null &&
              getDateKey(selectedCalendarDate) === dateKey;

            return (
              <button
                key={dayNumber}
                type="button"
                onClick={() => setSelectedCalendarDate(date)}
                className={`h-[72px] rounded-sm border bg-paper px-1.5 py-1 text-left hover:border-stamp border-2 sm:h-[82px] sm:px-2 ${
 isSelected
 ? 'border-stamp border-2 ring-1 ring-stamp/30'
 : 'border-ink border-2'
 }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-ink/90">{dayNumber}</span>
                  {dateOverride && (
                    <span className="rounded-sm bg-sage/20 px-1.5 py-0.5 text-[9px] font-bold text-sage">
                      OVR
                    </span>
                  )}
                </div>
                <div className={`mt-1 text-[10px] ${statusClass}`}>{statusText}</div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 rounded-sm bg-clay/5 px-3 py-2 text-[10px] text-ink/60">
          Calendar view reflects weekly rules. Click a date to add one-off custom
          hours or mark it unavailable.
        </div>

        {selectedCalendarDate && renderDateOverrideEditor(selectedCalendarDate)}
      </div>
    );
  };

  const renderCalendarSettings = () => (
    <div className="flex flex-col">
      <div className="border-b-2 border-ink p-5">
        <h2 className="text-[14px] font-display font-semibold tracking-wide font-bold text-ink">Connected calendars</h2>
        <p className="mt-1 text-[11px] text-ink/60">Choose which calendars should be checked for conflicts.</p>

        <div className="mt-4 space-y-2">
          {calendarSettings.connectedCalendars.map((calendar) => (
            <div key={calendar.id} className="flex items-center justify-between rounded-sm border-2 border-ink px-3 py-2">
              <div>
                <p className="text-[12px] font-medium font-bold text-ink/90">{calendar.name}</p>
                <p className="text-[10px] text-ink/60">{calendar.type}</p>
              </div>
              <span className="rounded-sm bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-sage">{calendar.status}</span>
            </div>
          ))}
        </div>

        <button
          type="button"
          className="mt-4 inline-flex items-center gap-1 rounded-sm border-2 border-ink px-3 py-1.5 text-[11px] font-bold text-ink/80 hover:bg-clay/5"
        >
          <span className="material-symbols-outlined text-[14px] font-display font-semibold tracking-wide">add</span>
          Connect calendar
        </button>
      </div>

      <div className="p-5">
        <h2 className="text-[14px] font-display font-semibold tracking-wide font-bold text-ink">Conflict checks</h2>

        <div className="mt-4 space-y-3">
          <label className="flex items-center justify-between rounded-sm border-2 border-ink px-3 py-2">
            <span className="text-[12px] font-medium text-ink/80">Check connected calendars for conflicts</span>
            <input
              type="checkbox"
              checked={calendarSettings.checkConflicts}
              onChange={(event) => setCalendarSettings((prev) => ({ ...prev, checkConflicts: event.target.checked }))}
              className="h-4 w-4 rounded border-ink border-2 text-stamp"
            />
          </label>

          <label className="flex items-center justify-between rounded-sm border-2 border-ink px-3 py-2">
            <span className="text-[12px] font-medium text-ink/80">Add events to selected calendar automatically</span>
            <input
              type="checkbox"
              checked={calendarSettings.autoAddEvents}
              onChange={(event) => setCalendarSettings((prev) => ({ ...prev, autoAddEvents: event.target.checked }))}
              className="h-4 w-4 rounded border-ink border-2 text-stamp"
            />
          </label>

          <label className="flex items-center justify-between rounded-sm border-2 border-ink px-3 py-2">
            <span className="text-[12px] font-medium text-ink/80">Mark booked events as busy</span>
            <input
              type="checkbox"
              checked={calendarSettings.markAsBusy}
              onChange={(event) => setCalendarSettings((prev) => ({ ...prev, markAsBusy: event.target.checked }))}
              className="h-4 w-4 rounded border-ink border-2 text-stamp"
            />
          </label>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-[11px] font-bold text-ink/80">Calendar used for conflict checks</label>
          <select
            value={calendarSettings.conflictCalendar}
            onChange={(event) => setCalendarSettings((prev) => ({ ...prev, conflictCalendar: event.target.value }))}
            className="w-full rounded-sm border-2 border-ink bg-paper px-3 py-2 text-[12px] font-medium text-ink/80 focus:border-stamp border-2 focus:outline-none"
          >
            {calendarSettings.connectedCalendars.map((calendar) => (
              <option key={calendar.id} value={calendar.name}>
                {calendar.name}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );

  const renderAdvancedSettings = () => (
    <div className="flex flex-col gap-5">
      <div className="rounded-sm border-2 border-ink bg-paper p-5">
        <h2 className="text-[14px] font-display font-semibold tracking-wide font-bold text-ink">Buffer time</h2>
        <p className="mt-1 text-[11px] text-ink/60">Add padding before and after meetings.</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label>
            <span className="mb-1 block text-[11px] font-bold text-ink/80">Before event</span>
            <select
              value={advancedSettings.beforeEventBuffer}
              onChange={(event) => {
                setAdvancedSettings((prev) => ({ ...prev, beforeEventBuffer: event.target.value }));
                markDirty();
              }}
              className="w-full rounded-sm border-2 border-ink px-3 py-2 text-[12px] font-medium"
            >
              <option value="0">0 minutes</option>
              <option value="5">5 minutes</option>
              <option value="10">10 minutes</option>
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
            </select>
          </label>

          <label>
            <span className="mb-1 block text-[11px] font-bold text-ink/80">After event</span>
            <select
              value={advancedSettings.afterEventBuffer}
              onChange={(event) => {
                setAdvancedSettings((prev) => ({ ...prev, afterEventBuffer: event.target.value }));
                markDirty();
              }}
              className="w-full rounded-sm border-2 border-ink px-3 py-2 text-[12px] font-medium"
            >
              <option value="0">0 minutes</option>
              <option value="5">5 minutes</option>
              <option value="10">10 minutes</option>
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
            </select>
          </label>
        </div>
      </div>

      <div className="rounded-sm border-2 border-ink bg-paper p-5">
        <h2 className="text-[14px] font-display font-semibold tracking-wide font-bold text-ink">Scheduling limits</h2>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label>
            <span className="mb-1 block text-[11px] font-bold text-ink/80">Minimum scheduling notice (hours)</span>
            <input
              type="number"
              min={0}
              value={advancedSettings.minimumNotice}
              onChange={(event) => {
                setAdvancedSettings((prev) => ({ ...prev, minimumNotice: event.target.value }));
                markDirty();
              }}
              className="w-full rounded-sm border-2 border-ink px-3 py-2 text-[12px] font-medium"
            />
          </label>

          <label>
            <span className="mb-1 block text-[11px] font-bold text-ink/80">Maximum days in advance</span>
            <input
              type="number"
              min={1}
              value={advancedSettings.maximumDaysInFuture}
              onChange={(event) => {
                setAdvancedSettings((prev) => ({ ...prev, maximumDaysInFuture: event.target.value }));
                markDirty();
              }}
              className="w-full rounded-sm border-2 border-ink px-3 py-2 text-[12px] font-medium"
            />
          </label>
        </div>
      </div>

      <div className="rounded-sm border-2 border-ink bg-paper p-5">
        <h2 className="text-[14px] font-display font-semibold tracking-wide font-bold text-ink">Start time increments</h2>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label>
            <span className="mb-1 block text-[11px] font-bold text-ink/80">Offer start times every</span>
            <select
              value={advancedSettings.startIncrements}
              onChange={(event) => {
                setAdvancedSettings((prev) => ({ ...prev, startIncrements: event.target.value }));
                markDirty();
              }}
              className="w-full rounded-sm border-2 border-ink px-3 py-2 text-[12px] font-medium"
            >
              <option value="15">15 minutes</option>
              <option value="30">30 minutes</option>
              <option value="45">45 minutes</option>
              <option value="60">60 minutes</option>
            </select>
          </label>

          <label className="flex items-center justify-between rounded-sm border-2 border-ink px-3 py-2 sm:mt-6">
            <span className="text-[12px] font-medium text-ink/80">Allow back-to-back meetings</span>
            <input
              type="checkbox"
              checked={advancedSettings.allowBackToBack}
              onChange={(event) => {
                setAdvancedSettings((prev) => ({ ...prev, allowBackToBack: event.target.checked }));
                markDirty();
              }}
              className="h-4 w-4 rounded border-ink border-2 text-stamp"
            />
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t-2 border-ink pt-3 sm:flex-row sm:items-center sm:justify-end">
        {saveError && <p className="text-[11px] text-oxblood">{saveError}</p>}
        {!saveError && saveMessage && <p className="text-[11px] text-sage">{saveMessage}</p>}
        <button
          type="button"
          onClick={handleSaveAvailability}
          disabled={loading || saving || !isDirty}
          className="inline-flex h-10 w-full items-center justify-center rounded-sm bg-stamp px-4 text-[11px] font-bold text-paper hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:h-8 sm:w-auto"
        >
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </div>
  );

  const renderWorkingHoursModal = () => (
    <>
      {showWorkingHoursModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center bg-black/50 px-4 py-4">
          <div className="w-full max-w-sm rounded-sm border-2 border-ink bg-paper sm:rounded-sm">
            {/* Header */}
            <div className="flex items-center justify-between border-b-2 border-ink px-5 py-4 sm:px-6">
              <h2 className="text-[16px] font-bold text-ink">Working hours</h2>
              <button
                type="button"
                onClick={() => setShowWorkingHoursModal(false)}
                className="inline-flex h-6 w-6 items-center justify-center rounded text-ink/60 hover:bg-clay/10"
              >
                <span className="material-symbols-outlined text-[20px] font-display font-semibold tracking-wide">close</span>
              </button>
            </div>

            {/* Content */}
            <div className="max-h-[60vh] overflow-y-auto space-y-2 px-5 py-4 sm:px-6">
              <label className="flex items-center gap-3 cursor-pointer rounded-sm p-2 hover:bg-clay/5">
                <input type="radio" name="workingHours" defaultChecked className="h-4 w-4" />
                <div>
                  <p className="text-[12px] font-medium font-bold text-ink">Working hours (default)</p>
                  <p className="text-[10px] text-ink/60">Mon-Fri 9am-5pm</p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer rounded-sm p-2 hover:bg-clay/5">
                <input type="radio" name="workingHours" className="h-4 w-4" />
                <div>
                  <p className="text-[12px] font-medium font-bold text-ink">Weekend availability</p>
                  <p className="text-[10px] text-ink/60">Custom schedule</p>
                </div>
              </label>

              <label className="flex items-center gap-3 cursor-pointer rounded-sm p-2 hover:bg-clay/5">
                <input type="radio" name="workingHours" className="h-4 w-4" />
                <div>
                  <p className="text-[12px] font-medium font-bold text-ink">Holiday hours</p>
                  <p className="text-[10px] text-ink/60">Custom schedule</p>
                </div>
              </label>

              <div className="border-t-2 border-ink pt-2 mt-2">
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-sm p-2 text-[12px] font-medium font-bold text-ink/80 hover:bg-clay/5"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  Create schedule
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="flex flex-col gap-2 border-t-2 border-ink px-5 py-4 sm:flex-row sm:justify-end sm:gap-3 sm:px-6">
              <button
                type="button"
                onClick={() => setShowWorkingHoursModal(false)}
                className="rounded-sm border-2 border-ink px-4 py-2 text-[13px] font-medium font-bold text-ink/80 hover:bg-clay/5"
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-sm bg-stamp px-4 py-2 text-[13px] font-medium font-bold text-paper hover:bg-blue-700"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  const renderActiveOnModal = () => (
    <>
      {showActiveOnModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center bg-black/50 px-4 py-4">
          <div className="w-full max-w-md rounded-sm border-2 border-ink bg-paper sm:rounded-sm">
            {/* Header */}
            <div className="flex items-center justify-between border-b-2 border-ink px-5 py-4 sm:px-6">
              <h2 className="text-[16px] font-bold text-ink">Active on</h2>
              <button
                type="button"
                onClick={() => setShowActiveOnModal(false)}
                className="inline-flex h-6 w-6 items-center justify-center rounded text-ink/60 hover:bg-clay/10"
              >
                <span className="material-symbols-outlined text-[20px] font-display font-semibold tracking-wide">close</span>
              </button>
            </div>

            {/* Content */}
            <div className="max-h-[60vh] overflow-y-auto px-5 py-4 sm:px-6">
              {loadingEventTypes ? (
                <div className="flex justify-center py-8">
                  <div className="h-6 w-6 animate-spin rounded-sm border-b-2 border-stamp border-2" />
                </div>
              ) : (
                <>
                  <div className="mb-3">
                    <div className="flex items-center justify-between gap-2 pb-2">
                      <button
                        type="button"
                        onClick={() => setSelectedEventTypes(eventTypes.map(et => et.id))}
                        className="text-[12px] font-medium font-bold text-stamp hover:underline"
                      >
                        select all
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedEventTypes([])}
                        className="text-[12px] font-medium font-bold text-stamp hover:underline"
                      >
                        clear
                      </button>
                    </div>
                  </div>

                  {eventTypes.length === 0 ? (
                    <div className="rounded-sm border border-dashed border-ink border-2 bg-clay/5 p-3 text-center">
                      <p className="text-[12px] font-medium text-ink/60">No meeting types available</p>
                    </div>
                  ) : (
                    <div className="mb-4 space-y-2">
                      <div className="rounded-sm border-2 border-ink bg-clay/5 px-3 py-2">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-ink/60 mb-3">Meeting types</p>
                        <div className="space-y-2">
                          {eventTypes.map((eventType) => (
                            <label key={eventType.id} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedEventTypes.includes(eventType.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedEventTypes([...selectedEventTypes, eventType.id]);
                                  } else {
                                    setSelectedEventTypes(selectedEventTypes.filter(id => id !== eventType.id));
                                  }
                                }}
                                className="h-4 w-4 rounded"
                              />
                              <span className="text-[12px] font-medium text-ink/80">{eventType.title}</span>
                              <span className="text-[11px] text-ink/60 ml-auto">{eventType.duration} mins</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex flex-col gap-2 border-t-2 border-ink px-5 py-4 sm:flex-row sm:justify-end sm:gap-3 sm:px-6">
              <button
                type="button"
                onClick={() => setShowActiveOnModal(false)}
                className="rounded-sm border-2 border-ink px-4 py-2 text-[13px] font-medium font-bold text-ink/80 hover:bg-clay/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setShowActiveOnModal(false)}
                className="rounded-sm bg-stamp px-4 py-2 text-[13px] font-medium font-bold text-paper hover:bg-blue-700"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="pb-16 pt-4">
      <div className="mb-4 flex items-center gap-2">
        <h1 className="text-[20px] font-display font-semibold tracking-wide font-bold text-ink">Availability</h1>
      </div>

      <div className="relative max-w-[980px] border-2 border-ink bg-paper shadow-sm">
        <div className="flex flex-col gap-3 border-b-2 border-ink px-4 py-3 sm:flex-row sm:items-center sm:justify-between bg-clay/5">
          <div className="flex items-center gap-6 overflow-x-auto pb-1">
          {mainTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveMainTab(tab)}
              className={`relative inline-flex items-center gap-1 font-display text-[12px] font-bold uppercase tracking-wider ${
 activeMainTab === tab ? 'text-ink' : 'text-ink/60 hover:text-ink'
 }`}
            >
              {tab}
              {activeMainTab === tab && (
                <span className="absolute -bottom-[14px] left-0 right-0 h-[2px] bg-ink" />
              )}
            </button>
          ))}
          </div>
        </div>

      {activeMainTab === 'Schedules' && (
        <div>
          <div className="border-b-2 border-ink px-4 py-4 sm:px-5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-ink/60">This schedule</p>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setShowWorkingHoursModal(true)}
                  className="inline-flex items-center gap-1 text-[14px] font-display font-semibold tracking-wide font-bold text-stamp hover:text-blue-700 transition-colors"
                >
                  Working hours (default)
                  <span className="material-symbols-outlined text-[16px] text-ink/60">keyboard_arrow_down</span>
                </button>

                <div className="flex flex-wrap items-center gap-1 text-[11px] text-ink/60">
                  <span>Active on</span>
                  <button 
                    type="button" 
                    onClick={() => setShowActiveOnModal(true)}
                    className="inline-flex items-center gap-1 font-bold text-ink/80 hover:text-ink transition-colors"
                  >
                    {selectedEventTypes.length} {selectedEventTypes.length === 1 ? 'event type' : 'event types'}
                    <span className="material-symbols-outlined text-[14px] font-display font-semibold tracking-wide text-ink/60">keyboard_arrow_down</span>
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
                <div className="flex items-center overflow-hidden rounded-sm border-2 border-ink">
                  <button
                    type="button"
                    onClick={() => setViewMode('List')}
                    className={`inline-flex h-10 items-center gap-1 px-3 text-[11px] font-bold ${
 viewMode === 'List' ? 'bg-clay/10 text-ink' : 'bg-paper text-ink/70'
 }`}
                  >
                    <span className="material-symbols-outlined text-[14px] font-display font-semibold tracking-wide">view_list</span>
                    <span className="hidden sm:inline">List</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode('Calendar')}
                    className={`inline-flex h-10 items-center gap-1 border-l-2 border-ink px-3 text-[11px] font-bold ${
 viewMode === 'Calendar' ? 'bg-clay/10 text-ink' : 'bg-paper text-ink/70'
 }`}
                  >
                    <span className="material-symbols-outlined text-[14px] font-display font-semibold tracking-wide">calendar_month</span>
                    <span className="hidden sm:inline">Calendar</span>
                  </button>
                </div>

                <button
                  type="button"
                  aria-label="Working hours settings"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-sm border-2 border-ink text-ink/70 hover:bg-clay/5 sm:h-7 sm:w-7"
                >
                  <span className="material-symbols-outlined text-[16px]">more_horiz</span>
                </button>
              </div>
            </div>
          </div>

          {viewMode === 'List' ? renderSchedulesList() : renderSchedulesCalendar()}

          <div className="border-t-2 border-ink px-4 py-3 sm:px-5">
            <div className="relative inline-block" data-timezone-dropdown="true">
              <button
                type="button"
                onClick={() => setShowTimezoneDropdown((prev) => !prev)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-stamp hover:underline"
              >
                {timezone}
                <span className="material-symbols-outlined text-[13px] font-medium text-ink/60">keyboard_arrow_down</span>
              </button>

              {showTimezoneDropdown && (
                <div className="absolute left-0 top-full z-30 mt-2 max-h-60 w-56 overflow-y-auto rounded-sm border-2 border-ink bg-paper py-1">
                  {timezoneOptions.map((tz) => (
                    <button
                      key={tz}
                      type="button"
                      onClick={() => {
                        setTimezone(tz);
                        markDirty();
                        setShowTimezoneDropdown(false);
                      }}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-[12px] font-medium hover:bg-clay/5 ${
 timezone === tz ? 'bg-clay/5 font-bold text-ink' : 'text-ink/80'
 }`}
                    >
                      <span>{tz}</span>
                      {timezone === tz && <span className="material-symbols-outlined text-[14px] font-display font-semibold tracking-wide text-stamp">check</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-3 flex flex-col gap-2 sm:mt-0 sm:flex-row sm:items-center sm:justify-end">
              {saveError && <p className="text-[11px] text-oxblood">{saveError}</p>}
              {!saveError && saveMessage && <p className="text-[11px] text-sage">{saveMessage}</p>}
              <button
                type="button"
                onClick={handleSaveAvailability}
                disabled={loading || saving || !isDirty}
                className="inline-flex h-10 w-full items-center justify-center rounded-sm bg-stamp px-4 text-[11px] font-bold text-paper hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:h-8 sm:w-auto"
              >
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeMainTab === 'Calendar settings' && renderCalendarSettings()}
      {activeMainTab === 'Advanced settings' && renderAdvancedSettings()}
      </div>
      {renderWorkingHoursModal()}
      {renderActiveOnModal()}
    </div>
  );
}
