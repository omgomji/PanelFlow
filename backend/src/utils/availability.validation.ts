/**
 * Availability Validation Utilities
 *
 * Extracts validation logic out of the controller.
 */
import { BadRequestError } from './errors';

export type AvailabilityIntervalPayload = {
  startTime: string;
  endTime: string;
};

export type AvailabilityDayPayload = {
  dayOfWeek: number;
  intervals: AvailabilityIntervalPayload[];
};

export type AvailabilityDateOverridePayload = {
  date: string;
  intervals: AvailabilityIntervalPayload[];
};

const HHMM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;
const END_TIME_REGEX = /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/;
const YYYYMMDD_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function toMinutes(time: string) {
  if (time === '24:00') {
    return 24 * 60;
  }

  const [hour, minute] = time.split(':').map((v) => parseInt(v, 10));
  return hour * 60 + minute;
}

function parseIntervalTimes(
  startTimeRaw: string,
  endTimeRaw: string,
  formatError: string,
  orderError: string
) {
  const startTime = String(startTimeRaw || '').trim();
  const endTime = String(endTimeRaw || '').trim();

  if (!HHMM_REGEX.test(startTime) || !END_TIME_REGEX.test(endTime)) {
    throw new BadRequestError(formatError);
  }

  const start = toMinutes(startTime);
  const end = toMinutes(endTime);

  if (start >= end) {
    throw new BadRequestError(orderError);
  }

  return { startTime, endTime, start, end };
}

export function isValidTimezone(timezone: string): boolean {
  try {
    // Accept both canonical and alias IANA names (e.g. Asia/Kolkata, Asia/Calcutta).
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export function validateDays(days: AvailabilityDayPayload[]) {
  const seenDays = new Set<number>();

  for (const day of days) {
    if (!Number.isInteger(day.dayOfWeek) || day.dayOfWeek < 0 || day.dayOfWeek > 6) {
      throw new BadRequestError('dayOfWeek must be an integer between 0 and 6');
    }

    if (seenDays.has(day.dayOfWeek)) {
      throw new BadRequestError(`Duplicate dayOfWeek found: ${day.dayOfWeek}`);
    }
    seenDays.add(day.dayOfWeek);

    if (!Array.isArray(day.intervals)) {
      throw new BadRequestError('Each day must include an intervals array');
    }

    const normalized = day.intervals.map((interval) =>
      parseIntervalTimes(
        interval.startTime,
        interval.endTime,
        'Intervals must use 24h HH:mm format (endTime may be 24:00)',
        'Each interval must satisfy startTime < endTime'
      )
    );

    const sorted = [...normalized].sort((a, b) => a.start - b.start);
    for (let i = 1; i < sorted.length; i += 1) {
      if (sorted[i].start < sorted[i - 1].end) {
        throw new BadRequestError(
          `Intervals overlap for dayOfWeek ${day.dayOfWeek}`
        );
      }
    }
  }
}

export function isValidYyyyMmDd(value: string): boolean {
  if (!YYYYMMDD_REGEX.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return parsed.toISOString().slice(0, 10) === value;
}

export function validateDateOverrides(dateOverrides: AvailabilityDateOverridePayload[]) {
  const seenDates = new Set<string>();

  for (const override of dateOverrides) {
    const date = String(override.date || '').trim();
    if (!isValidYyyyMmDd(date)) {
      throw new BadRequestError('dateOverrides.date must use YYYY-MM-DD format');
    }

    if (seenDates.has(date)) {
      throw new BadRequestError(`Duplicate date override found: ${date}`);
    }
    seenDates.add(date);

    if (!Array.isArray(override.intervals)) {
      throw new BadRequestError('Each date override must include an intervals array');
    }

    const normalized = override.intervals.map((interval) =>
      parseIntervalTimes(
        interval.startTime,
        interval.endTime,
        'Date override intervals must use 24h HH:mm format (endTime may be 24:00)',
        `Date override intervals must satisfy startTime < endTime (${date})`
      )
    );

    const sorted = [...normalized].sort((a, b) => a.start - b.start);
    for (let i = 1; i < sorted.length; i += 1) {
      if (sorted[i].start < sorted[i - 1].end) {
        throw new BadRequestError(`Date override intervals overlap for ${date}`);
      }
    }
  }
}

export function parseBufferMinutes(value: unknown, fieldName: string): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 1440) {
    throw new BadRequestError(`${fieldName} must be an integer between 0 and 1440`);
  }

  return parsed;
}

export function parseIntegerInRange(
  value: unknown,
  fieldName: string,
  min: number,
  max: number
): number | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new BadRequestError(`${fieldName} must be an integer between ${min} and ${max}`);
  }

  return parsed;
}

export function parseBoolean(value: unknown, fieldName: string): boolean | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (value === 'true') return true;
  if (value === 'false') return false;

  throw new BadRequestError(`${fieldName} must be a boolean`);
}
