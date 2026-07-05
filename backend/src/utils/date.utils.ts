/**
 * Date and Timezone Utilities
 *
 * Provides functions for converting availability dates and times between zones.
 */
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { BadRequestError } from './errors';
import {
  AvailabilityDayPayload,
  AvailabilityDateOverridePayload,
  AvailabilityIntervalPayload,
  isValidYyyyMmDd,
  toMinutes,
} from './availability.validation';

export const IST_TIMEZONE = 'Asia/Kolkata';

function toUtcOrBadRequest(
  localDateTime: string,
  timezone: string,
  errorMessage: string
) {
  const utcDate = fromZonedTime(localDateTime, timezone);
  if (Number.isNaN(utcDate.getTime())) {
    throw new BadRequestError(errorMessage);
  }

  return utcDate;
}

function formatUtcDateToYyyyMmDd(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function convertIsoDayToJsDay(isoDay: number): number {
  return isoDay % 7;
}

export function convertDaysToIst(
  sourceTimezone: string,
  days: AvailabilityDayPayload[]
): AvailabilityDayPayload[] {
  const dayMap = new Map<number, AvailabilityIntervalPayload[]>();
  const referenceSunday = new Date(Date.UTC(2026, 0, 4)); // Sunday

  const addInterval = (dayOfWeek: number, interval: AvailabilityIntervalPayload) => {
    const existing = dayMap.get(dayOfWeek) || [];
    existing.push(interval);
    dayMap.set(dayOfWeek, existing);
  };

  for (const day of days) {
    const sourceDate = new Date(referenceSunday);
    sourceDate.setUTCDate(referenceSunday.getUTCDate() + day.dayOfWeek);
    const sourceDateStr = formatUtcDateToYyyyMmDd(sourceDate);

    for (const interval of day.intervals) {
      const startUtc = toUtcOrBadRequest(
        `${sourceDateStr}T${interval.startTime}:00`,
        sourceTimezone,
        `Invalid startTime for dayOfWeek ${day.dayOfWeek}`
      );
      const endUtc = toUtcOrBadRequest(
        `${sourceDateStr}T${interval.endTime}:00`,
        sourceTimezone,
        `Invalid endTime for dayOfWeek ${day.dayOfWeek}`
      );

      const startIsoDay = Number.parseInt(
        formatInTimeZone(startUtc, IST_TIMEZONE, 'i'),
        10
      );
      const endIsoDay = Number.parseInt(
        formatInTimeZone(endUtc, IST_TIMEZONE, 'i'),
        10
      );

      const startDayOfWeek = convertIsoDayToJsDay(startIsoDay);
      const endDayOfWeek = convertIsoDayToJsDay(endIsoDay);
      const startTime = formatInTimeZone(startUtc, IST_TIMEZONE, 'HH:mm');
      const endTime = formatInTimeZone(endUtc, IST_TIMEZONE, 'HH:mm');

      if (startDayOfWeek === endDayOfWeek) {
        addInterval(startDayOfWeek, { startTime, endTime });
        continue;
      }

      // Use 24:00 boundary to avoid losing one minute at midnight split.
      addInterval(startDayOfWeek, { startTime, endTime: '24:00' });
      if (endTime !== '00:00') {
        addInterval(endDayOfWeek, { startTime: '00:00', endTime });
      }
    }
  }

  return Array.from(dayMap.entries())
    .map(([dayOfWeek, intervals]) => ({
      dayOfWeek,
      intervals: intervals.sort(
        (a, b) => toMinutes(a.startTime) - toMinutes(b.startTime)
      ),
    }))
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek);
}

export function convertDateOverridesToIst(
  sourceTimezone: string,
  dateOverrides: AvailabilityDateOverridePayload[]
): AvailabilityDateOverridePayload[] {
  const dateMap = new Map<string, AvailabilityIntervalPayload[]>();

  const ensureDate = (date: string) => {
    if (!dateMap.has(date)) {
      dateMap.set(date, []);
    }
  };

  const addInterval = (date: string, interval: AvailabilityIntervalPayload) => {
    const existing = dateMap.get(date) || [];
    existing.push(interval);
    dateMap.set(date, existing);
  };

  for (const override of dateOverrides) {
    const sourceDate = String(override.date || '').trim();
    if (!isValidYyyyMmDd(sourceDate)) {
      throw new BadRequestError('dateOverrides.date must use YYYY-MM-DD format');
    }
    if (!Array.isArray(override.intervals)) {
      throw new BadRequestError('Each date override must include an intervals array');
    }

    // Midday avoids edge cases while mapping date-only values across zones.
    const mappedDate = formatInTimeZone(
      toUtcOrBadRequest(
        `${sourceDate}T12:00:00`,
        sourceTimezone,
        `Invalid date override date: ${sourceDate}`
      ),
      IST_TIMEZONE,
      'yyyy-MM-dd'
    );
    ensureDate(mappedDate);

    for (const interval of override.intervals) {
      const startUtc = toUtcOrBadRequest(
        `${sourceDate}T${interval.startTime}:00`,
        sourceTimezone,
        `Invalid date override startTime for ${sourceDate}`
      );
      const endUtc = toUtcOrBadRequest(
        `${sourceDate}T${interval.endTime}:00`,
        sourceTimezone,
        `Invalid date override endTime for ${sourceDate}`
      );

      const startDate = formatInTimeZone(startUtc, IST_TIMEZONE, 'yyyy-MM-dd');
      const endDate = formatInTimeZone(endUtc, IST_TIMEZONE, 'yyyy-MM-dd');
      const startTime = formatInTimeZone(startUtc, IST_TIMEZONE, 'HH:mm');
      const endTime = formatInTimeZone(endUtc, IST_TIMEZONE, 'HH:mm');

      if (startDate === endDate) {
        addInterval(startDate, { startTime, endTime });
        continue;
      }

      // Use 24:00 boundary to avoid losing one minute at midnight split.
      addInterval(startDate, { startTime, endTime: '24:00' });
      if (endTime !== '00:00') {
        addInterval(endDate, { startTime: '00:00', endTime });
      }
    }
  }

  return Array.from(dateMap.entries())
    .map(([date, intervals]) => ({
      date,
      intervals: intervals.sort(
        (a, b) => toMinutes(a.startTime) - toMinutes(b.startTime)
      ),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
