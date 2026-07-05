/**
 * Panel Slots Service
 *
 * Multi-interviewer availability engine.
 *
 * Algorithm:
 *   1. Call getFreeIntervalsForUser() for each panel interviewer.
 *   2. Intersect the resulting interval lists (classic multi-list interval
 *      intersection, same shape as LeetCode 759 "Employee Free Time" in reverse).
 *   3. Collect scheduling constraints from each interviewer's AvailabilitySchedule
 *      and apply the most-restrictive value (MAX notice, MIN maxDays, MAX increment,
 *      AND for allowBackToBack).
 *   4. Walk the intersection grid using the coarsest common increment and duration,
 *      filtering slots past minimumNotice and within maximumDays.
 *
 * All interval math happens in UTC. Only the final slot list is returned as ISO
 * strings — the caller (or frontend) handles timezone display.
 */
import { addMinutes } from 'date-fns';
import { fromZonedTime, formatInTimeZone } from 'date-fns-tz';
import { prisma } from '../config/prisma';
import { getFreeIntervalsForUser } from './slots.service';
import { NotFoundError } from '../utils/errors';

/**
 * Compute the pairwise intersection of two sorted interval lists.
 * Returns intervals that exist in BOTH lists.
 */
function intersectIntervals(
  a: { start: Date; end: Date }[],
  b: { start: Date; end: Date }[]
): { start: Date; end: Date }[] {
  const result: { start: Date; end: Date }[] = [];
  let i = 0;
  let j = 0;

  while (i < a.length && j < b.length) {
    const start = a[i].start > b[j].start ? a[i].start : b[j].start;
    const end = a[i].end < b[j].end ? a[i].end : b[j].end;

    if (start < end) {
      result.push({ start, end });
    }

    // Advance the pointer whose interval ends first
    if (a[i].end < b[j].end) {
      i++;
    } else {
      j++;
    }
  }

  return result;
}

export const panelSlotsService = {
  /**
   * Returns available UTC slot strings for a panel on a given date.
   * Response shape matches /api/public/:username/:slug/slots (array of ISO strings)
   * so the frontend BookingCalendar component can be reused unchanged.
   */
  async getSlots(panelSlug: string, date: string): Promise<string[]> {
    const panel = await prisma.panel.findUnique({
      where: { slug: panelSlug },
      include: {
        interviewers: {
          include: {
            user: {
              include: { availabilitySchedule: true },
            },
          },
        },
      },
    });

    if (!panel || !panel.isActive) {
      throw new NotFoundError('Panel not found');
    }

    if (panel.interviewers.length === 0) {
      return [];
    }

    // ── Gather per-interviewer constraints ────────────────────
    // Apply most-restrictive values across all interviewers.
    let minimumNoticeMinutes = 0;
    let maximumDaysInFuture = Infinity;
    let startTimeIncrementMinutes = 0;
    let allowBackToBack = true;

    for (const pi of panel.interviewers) {
      const sched = pi.user.availabilitySchedule;
      if (!sched) continue;
      minimumNoticeMinutes = Math.max(minimumNoticeMinutes, sched.minimumNoticeMinutes);
      maximumDaysInFuture = Math.min(maximumDaysInFuture, sched.maximumDaysInFuture);
      startTimeIncrementMinutes = Math.max(startTimeIncrementMinutes, sched.startTimeIncrementMinutes);
      allowBackToBack = allowBackToBack && sched.allowBackToBack;
    }

    // Default increment if no schedule exists for any interviewer
    if (startTimeIncrementMinutes === 0) startTimeIncrementMinutes = panel.duration;
    const effectiveMaxDays = isFinite(maximumDaysInFuture) ? maximumDaysInFuture : 60;

    // ── Check maximumDaysInFuture ────────────────────────────
    // Use the first interviewer's timezone, or UTC as fallback
    const refTimezone =
      panel.interviewers[0]?.user.availabilitySchedule?.timezone ?? 'UTC';
    const nowUtc = new Date();
    const todayHost = formatInTimeZone(nowUtc, refTimezone, 'yyyy-MM-dd');
    const dayDiff =
      (fromZonedTime(`${date}T00:00:00`, refTimezone).getTime() -
        fromZonedTime(`${todayHost}T00:00:00`, refTimezone).getTime()) /
      (24 * 60 * 60 * 1000);

    if (dayDiff > effectiveMaxDays || dayDiff < 0) {
      return [];
    }

    // ── Compute free intervals for each interviewer ───────────
    const allFreeIntervals = await Promise.all(
      panel.interviewers.map((pi) =>
        getFreeIntervalsForUser(pi.userId, date, {
          allowBackToBack,
        })
      )
    );

    if (allFreeIntervals.some((intervals) => intervals.length === 0)) {
      return []; // Any interviewer with zero free time = no panel slots
    }

    // ── Intersect all interviewer free intervals ──────────────
    let intersection = allFreeIntervals[0];
    for (let k = 1; k < allFreeIntervals.length; k++) {
      intersection = intersectIntervals(intersection, allFreeIntervals[k]);
      if (intersection.length === 0) return [];
    }

    // ── Walk intersection grid to emit slots ─────────────────
    const nowWithNoticeUtc = addMinutes(nowUtc, minimumNoticeMinutes);
    const slots: string[] = [];

    for (const interval of intersection) {
      let currentSlot = interval.start;

      while (addMinutes(currentSlot, panel.duration) <= interval.end) {
        if (currentSlot > nowWithNoticeUtc) {
          slots.push(currentSlot.toISOString());
        }
        currentSlot = addMinutes(currentSlot, startTimeIncrementMinutes);
      }
    }

    return slots;
  },
};
