import { describe, expect, it } from 'vitest';
import { addMinutes } from 'date-fns';
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { differenceInCalendarDaysInTimezone, getCandidateDayBounds, getEffectiveBufferPolicy } from '../services/slots.service';
import { commonPanelIncrement } from '../services/panelSlots.service';

describe('scheduling timezone regressions', () => {
  it('compares calendar days safely across New York spring DST', () => {
    const before = fromZonedTime('2026-03-08T00:00:00', 'America/New_York');
    const after = fromZonedTime('2026-03-09T00:00:00', 'America/New_York');
    expect(differenceInCalendarDaysInTimezone(before, after, 'America/New_York')).toBe(1);
  });

  it('compares calendar days safely across New York fall DST', () => {
    const before = fromZonedTime('2026-11-01T00:00:00', 'America/New_York');
    const after = fromZonedTime('2026-11-02T00:00:00', 'America/New_York');
    expect(differenceInCalendarDaysInTimezone(before, after, 'America/New_York')).toBe(1);
  });

  it('keeps midnight boundaries in the host local calendar date', () => {
    const instant = fromZonedTime('2026-06-15T23:30:00', 'America/New_York');
    expect(formatInTimeZone(instant, 'America/New_York', 'yyyy-MM-dd')).toBe('2026-06-15');
    expect(formatInTimeZone(addMinutes(instant, 30), 'America/New_York', 'yyyy-MM-dd')).toBe('2026-06-16');
  });

  it.each(['America/New_York', 'Asia/Kolkata'])('creates valid local day bounds in %s', (timezone) => {
    const { start, end } = getCandidateDayBounds('2026-03-08', timezone);
    expect(start.getTime()).toBeLessThan(end.getTime());
    expect(formatInTimeZone(start, timezone, 'yyyy-MM-dd HH:mm')).toBe('2026-03-08 00:00');
    expect(formatInTimeZone(end, timezone, 'yyyy-MM-dd HH:mm')).toBe('2026-03-09 00:00');
  });

  it('uses asymmetric buffers and removes both when back-to-back is allowed', () => {
    expect(getEffectiveBufferPolicy({ allowBackToBack: false, beforeEventBufferMinutes: 10, afterEventBufferMinutes: 15 })).toEqual({ beforeEventBufferMinutes: 10, afterEventBufferMinutes: 15 });
    expect(getEffectiveBufferPolicy({ allowBackToBack: true, beforeEventBufferMinutes: 10, afterEventBufferMinutes: 15 })).toEqual({ beforeEventBufferMinutes: 0, afterEventBufferMinutes: 0 });
  });

  it('converts host availability to a common instant before a candidate timezone display', () => {
    const newYork = fromZonedTime('2026-06-15T09:00:00', 'America/New_York');
    const london = fromZonedTime('2026-06-15T14:00:00', 'Europe/London');
    expect(newYork.getTime()).toBe(london.getTime());
    expect(formatInTimeZone(newYork, 'Asia/Kolkata', 'HH:mm')).toBe('18:30');
  });

  it.each([[15, 20, 60], [20, 30, 60], [15, 30, 30]])('uses an LCM panel grid for %i and %i minute host increments', (a, b, expected) => {
    expect(commonPanelIncrement([a, b], 30)).toBe(expected);
  });
});
