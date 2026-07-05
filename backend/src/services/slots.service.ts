/**
 * Slot Generation Service
 *
 * Pure scheduling logic: given a date, user, and event type,
 * generates the list of available time slots in UTC.
 *
 * Key design decisions:
 *   1. Day-of-week is computed in the HOST's timezone (not UTC).
 *      "Monday" means Monday in New York, even if UTC has already
 *      rolled over to Tuesday.
 *
 *   2. Overlap check spans ALL event types for the user.
 *      A person can't attend a "15 Min Chat" at 10:00 AND
 *      a "30 Min Interview" at 10:15 — they're the same physical person.
 *
 *   3. Slot increment = event duration (no fixed-interval granularity).
 *      A 30-min event produces slots at :00, :30. A 15-min event at :00, :15, :30, :45.
 *
 *   4. Past slots are filtered out (slot must start after NOW in UTC).
 *
 *   5. Optional before/after event buffers are applied when checking overlaps.
 *
 *   6. Busy-time is now queried from BookingHost (not Booking directly) so that
 *      panel booking commitments are reflected in individual slot generation.
 */
import { addMinutes, subMinutes } from 'date-fns';
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { prisma } from '../config/prisma';

function toYyyyMmDd(value: Date | string): string {
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }

  return value.toISOString().slice(0, 10);
}

function addDaysToYyyyMmDd(date: string, days: number) {
  const base = new Date(`${date}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function toUtcFromLocalTime(
  date: string,
  time: string,
  timezone: string
): Date {
  const effectiveDate = time === '24:00' ? addDaysToYyyyMmDd(date, 1) : date;
  const effectiveTime = time === '24:00' ? '00:00:00' : `${time}:00`;
  const utcDate = fromZonedTime(`${effectiveDate}T${effectiveTime}`, timezone);

  if (Number.isNaN(utcDate.getTime())) {
    throw new Error(
      `Invalid local time for slot generation: ${date} ${time} (${timezone})`
    );
  }

  return utcDate;
}

/**
 * Returns the free UTC intervals for a given user on a given date,
 * already accounting for their weekly rules, date overrides, buffers,
 * and existing busy time (queried from BookingHost so both individual
 * and panel commitments are reflected).
 *
 * This is the shared helper used by both individual slot generation
 * and the panel intersection engine in panelSlots.service.ts.
 */
export async function getFreeIntervalsForUser(
  userId: number,
  date: string, // YYYY-MM-DD in the user's local timezone
  options?: {
    scheduleTimezone?: string;
    beforeEventBufferMinutes?: number;
    afterEventBufferMinutes?: number;
    allowBackToBack?: boolean;
  }
): Promise<{ start: Date; end: Date }[]> {
  const schedule = await prisma.availabilitySchedule.findUnique({
    where: { userId },
    include: {
      days: {
        include: { intervals: { orderBy: { order: 'asc' } } },
        orderBy: { dayOfWeek: 'asc' },
      },
      dateOverrides: {
        include: { intervals: { orderBy: { order: 'asc' } } },
        orderBy: { date: 'asc' },
      },
    },
  });

  if (!schedule) return [];

  const scheduleTimezone = options?.scheduleTimezone ?? schedule.timezone;
  const allowBackToBack = options?.allowBackToBack ?? schedule.allowBackToBack ?? true;
  const beforeEventBufferMinutes = allowBackToBack
    ? 0
    : Math.max(0, options?.beforeEventBufferMinutes ?? schedule.beforeEventBufferMinutes ?? 0);
  const afterEventBufferMinutes = allowBackToBack
    ? 0
    : Math.max(0, options?.afterEventBufferMinutes ?? schedule.afterEventBufferMinutes ?? 0);
  const totalBufferWindowMinutes = beforeEventBufferMinutes + afterEventBufferMinutes;

  // Determine day-of-week in the user's timezone
  const targetDateMidnight = fromZonedTime(`${date}T00:00:00`, scheduleTimezone);
  const isoDayOfWeek = parseInt(
    formatInTimeZone(targetDateMidnight, scheduleTimezone, 'i'),
    10
  );
  const dayOfWeek = isoDayOfWeek % 7;

  // Resolve date-specific override or fall back to weekly rule
  const dateOverride = schedule.dateOverrides.find(
    (override) => toYyyyMmDd(override.date) === date
  );
  if (dateOverride && dateOverride.intervals.length === 0) return [];

  const availableDay = schedule.days.find((d) => d.dayOfWeek === dayOfWeek);
  const effectiveIntervals = dateOverride?.intervals ?? availableDay?.intervals ?? [];
  if (effectiveIntervals.length === 0) return [];

  // Convert host-local interval bounds to UTC
  const utcIntervals = effectiveIntervals.map((interval) => ({
    startUtc: toUtcFromLocalTime(date, interval.startTime, scheduleTimezone),
    endUtc: toUtcFromLocalTime(date, interval.endTime, scheduleTimezone),
  }));

  const windowStartUtc = utcIntervals[0].startUtc;
  const windowEndUtc = utcIntervals[utcIntervals.length - 1].endUtc;
  const conflictWindowStartUtc = subMinutes(windowStartUtc, totalBufferWindowMinutes);
  const conflictWindowEndUtc = addMinutes(windowEndUtc, totalBufferWindowMinutes);

  // Query busy time from BookingHost — catches both individual and panel commitments.
  const busyBlocks = await prisma.bookingHost.findMany({
    where: {
      userId,
      status: 'SCHEDULED',
      startTime: { lt: conflictWindowEndUtc },
      endTime: { gt: conflictWindowStartUtc },
    },
    select: { startTime: true, endTime: true },
  });

  // Return UTC intervals with busy blocks carved out
  const freeIntervals: { start: Date; end: Date }[] = [];
  for (const interval of utcIntervals) {
    // Start with the full interval, then subtract busy blocks
    let free: { start: Date; end: Date }[] = [{ start: interval.startUtc, end: interval.endUtc }];

    for (const busy of busyBlocks) {
      const busyStart = subMinutes(busy.startTime, beforeEventBufferMinutes);
      const busyEnd = addMinutes(busy.endTime, afterEventBufferMinutes);

      free = free.flatMap((f) => {
        if (busyEnd <= f.start || busyStart >= f.end) return [f]; // no overlap
        const before = busyStart > f.start ? [{ start: f.start, end: busyStart }] : [];
        const after = busyEnd < f.end ? [{ start: busyEnd, end: f.end }] : [];
        return [...before, ...after];
      });
    }

    freeIntervals.push(...free);
  }

  return freeIntervals;
}

export async function generateSlots(
  userId: number,
  eventDuration: number,
  scheduleTimezone: string,
  days: Array<{
    dayOfWeek: number;
    intervals: Array<{ startTime: string; endTime: string }>;
  }>,
  dateOverrides: Array<{
    date: string | Date;
    intervals: Array<{ startTime: string; endTime: string }>;
  }> | undefined,
  date: string, // YYYY-MM-DD — interpreted as the host's local date
  options?: {
    beforeEventBufferMinutes?: number;
    afterEventBufferMinutes?: number;
    startTimeIncrementMinutes?: number;
    minimumNoticeMinutes?: number;
    maximumDaysInFuture?: number;
    allowBackToBack?: boolean;
  }
): Promise<string[]> {
  const allowBackToBack = options?.allowBackToBack ?? true;
  const beforeEventBufferMinutes = allowBackToBack
    ? 0
    : Math.max(0, options?.beforeEventBufferMinutes ?? 0);
  const afterEventBufferMinutes = allowBackToBack
    ? 0
    : Math.max(0, options?.afterEventBufferMinutes ?? 0);
  const startTimeIncrementMinutes = Math.max(
    5,
    options?.startTimeIncrementMinutes ?? eventDuration
  );
  const minimumNoticeMinutes = Math.max(0, options?.minimumNoticeMinutes ?? 0);
  const maximumDaysInFuture = Math.max(1, options?.maximumDaysInFuture ?? 60);
  const totalBufferWindowMinutes = beforeEventBufferMinutes + afterEventBufferMinutes;

  // ── Step 1: Determine day-of-week in the host's timezone ───
  // date-fns-tz `formatInTimeZone` with pattern 'i' returns ISO day-of-week:
  //   1 = Monday, 2 = Tuesday, ..., 7 = Sunday
  // We need JS convention: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const targetDateMidnight = fromZonedTime(`${date}T00:00:00`, scheduleTimezone);
  const isoDayOfWeek = parseInt(
    formatInTimeZone(targetDateMidnight, scheduleTimezone, 'i'),
    10
  );
  const dayOfWeek = isoDayOfWeek % 7; // 7 → 0 (Sunday), 1 → 1 (Monday), etc.

  const nowUtc = new Date();
  const todayHost = formatInTimeZone(nowUtc, scheduleTimezone, 'yyyy-MM-dd');
  const dayDiff =
    (fromZonedTime(`${date}T00:00:00`, scheduleTimezone).getTime() -
      fromZonedTime(`${todayHost}T00:00:00`, scheduleTimezone).getTime()) /
    (24 * 60 * 60 * 1000);
  if (dayDiff > maximumDaysInFuture) {
    return [];
  }

  // ── Step 2: Resolve date-specific override, fallback to weekly rule ─────
  const dateOverride = (dateOverrides ?? []).find(
    (override) => toYyyyMmDd(override.date) === date
  );

  if (dateOverride && dateOverride.intervals.length === 0) {
    return []; // Explicitly unavailable for this specific date
  }

  const availableDay = days.find((d) => d.dayOfWeek === dayOfWeek);
  const effectiveIntervals =
    dateOverride?.intervals ?? availableDay?.intervals ?? [];

  if (effectiveIntervals.length === 0) {
    return []; // No weekly hours and no date override for this date
  }

  // ── Step 3: Convert host-local interval bounds to UTC ──────
  const utcIntervals = effectiveIntervals.map((interval) => ({
    startUtc: toUtcFromLocalTime(date, interval.startTime, scheduleTimezone),
    endUtc: toUtcFromLocalTime(date, interval.endTime, scheduleTimezone),
  }));

  const windowStartUtc = utcIntervals[0].startUtc;
  const windowEndUtc = utcIntervals[utcIntervals.length - 1].endUtc;
  const conflictWindowStartUtc = subMinutes(windowStartUtc, totalBufferWindowMinutes);
  const conflictWindowEndUtc = addMinutes(windowEndUtc, totalBufferWindowMinutes);

  // ── Step 4: Load existing busy time for overlap check ──────
  // Now queries BookingHost — catches both individual and panel commitments.
  const existingBookings = await prisma.bookingHost.findMany({
    where: {
      userId,
      status: 'SCHEDULED',
      startTime: { lt: conflictWindowEndUtc },
      endTime: { gt: conflictWindowStartUtc },
    },
    select: { startTime: true, endTime: true },
  });

  // ── Step 5: Generate and filter slots ──────────────────────
  const slots: string[] = [];
  const nowWithNoticeUtc = addMinutes(nowUtc, minimumNoticeMinutes);

  for (const interval of utcIntervals) {
    let currentSlot = interval.startUtc;

    while (addMinutes(currentSlot, eventDuration) <= interval.endUtc) {
      const slotEnd = addMinutes(currentSlot, eventDuration);

      // Only include: (a) future slots, (b) non-overlapping with existing bookings
      if (
        currentSlot > nowWithNoticeUtc &&
        !hasOverlap(
          currentSlot,
          slotEnd,
          existingBookings,
          beforeEventBufferMinutes,
          afterEventBufferMinutes
        )
      ) {
        slots.push(currentSlot.toISOString());
      }

      currentSlot = addMinutes(currentSlot, startTimeIncrementMinutes);
    }
  }

  return slots;
}

/**
 * Half-open interval overlap check against buffered windows.
 *
 * [A, B) overlaps [C, D) iff A < D AND B > C
 *
 * Both the candidate slot and each existing booking are expanded
 * using the configured before/after buffer values before comparison.
 */
function hasOverlap(
  slotStart: Date,
  slotEnd: Date,
  bookings: Array<{ startTime: Date; endTime: Date }>,
  beforeEventBufferMinutes: number,
  afterEventBufferMinutes: number
): boolean {
  const slotWindowStart = subMinutes(slotStart, beforeEventBufferMinutes);
  const slotWindowEnd = addMinutes(slotEnd, afterEventBufferMinutes);

  return bookings.some((booking) => {
    const bookingWindowStart = subMinutes(
      booking.startTime,
      beforeEventBufferMinutes
    );
    const bookingWindowEnd = addMinutes(booking.endTime, afterEventBufferMinutes);

    return slotWindowStart < bookingWindowEnd && slotWindowEnd > bookingWindowStart;
  });
}
