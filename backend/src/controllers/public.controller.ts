/**
 * Public Controller
 *
 * Handles the public-facing booking flow:
 *   1. GET event type details (for the booking page header)
 *   2. GET available time slots (calendar slot picker)
 *   3. POST create a booking (with double-booking prevention)
 *
 * These routes require NO authentication — they are accessed by
 * invitees via the public booking URL /:username/:slug.
 */
import { Request, Response } from 'express';
import { generateSlots, getCandidateDayBounds } from '../services/slots.service';
import { bookingsService } from '../services/bookings.service';
import { publicService } from '../services/public.service';
import { formatInTimeZone } from 'date-fns-tz';
import { BadRequestError, ConflictError } from '../utils/errors';
import { isValidTimezone, isValidYyyyMmDd } from '../utils/availability.validation';
import { validateBookableSlot } from '../services/schedulingValidation.service';

function normalizeBookingInput(body: Record<string, unknown>) {
  const inviteeName = String(body.inviteeName ?? '').trim();
  const inviteeEmail = String(body.inviteeEmail ?? '').trim().toLowerCase();
  const startTime = String(body.startTime ?? '');
  if (!inviteeName || inviteeName.length > 200) throw new BadRequestError('Invalid inviteeName');
  if (!inviteeEmail || inviteeEmail.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteeEmail)) throw new BadRequestError('Invalid inviteeEmail');
  if (Number.isNaN(new Date(startTime).getTime())) throw new BadRequestError('Invalid startTime');
  return { inviteeName, inviteeEmail, startTime };
}

export const publicController = {
  /**
   * GET /api/public/:username/:slug
   *
   * Returns the host's public profile + event type details.
   * Inactive event types return 404 (same as non-existent — no info leakage).
   */
  async getEventDetails(req: Request, res: Response) {
    const username = req.params.username as string;
    const slug = req.params.slug as string;

    const user = await publicService.getUserByUsername(username);
    const eventType = await publicService.getActiveEventType(user.id, slug);
    const schedule = await publicService.getScheduleWithIntervals(user.id);
    const effectiveTimezone = schedule?.timezone || user.timezone;

    // Only expose public-safe user fields (no email, no timezone)
    res.json({
      user: { name: user.name, username: user.username, timezone: effectiveTimezone },
      eventType,
    });
  },

  /**
   * GET /api/public/:username
   *
   * Returns a list of all active event types for the given user.
   */
  async getPublicProfile(req: Request, res: Response) {
    const username = req.params.username as string;

    const user = await publicService.getUserByUsername(username);
    const eventTypes = await publicService.getActiveEventTypesByUser(user.id);
    const schedule = await publicService.getScheduleWithIntervals(user.id);
    const effectiveTimezone = schedule?.timezone || user.timezone;

    res.json({
      user: { name: user.name, username: user.username, timezone: effectiveTimezone },
      eventTypes,
    });
  },

  /**
   * GET /api/public/:username/:slug/slots?date=YYYY-MM-DD
   *
   * Returns available UTC time slots for the given date.
   * The date is interpreted as the host's local date (not UTC).
   *
   * Returns [] for: past dates, non-working days, no schedule configured.
   */
  async getSlots(req: Request, res: Response) {
    const username = req.params.username as string;
    const slug = req.params.slug as string;
    const date = req.query.date as string | undefined;
    const timezone = req.query.timezone as string | undefined;

    if (!date || !isValidYyyyMmDd(date) || !timezone || !isValidTimezone(timezone)) {
      throw new BadRequestError('date (YYYY-MM-DD) and timezone are required');
    }

    const user = await publicService.getUserByUsername(username);
    const eventType = await publicService.getActiveEventType(user.id, slug);
    const schedule = await publicService.getScheduleWithIntervals(user.id);

    // No schedule configured → no slots available
    if (!schedule) {
      return res.json([]);
    }

    const { start: candidateStart, end: candidateEnd } = getCandidateDayBounds(date, timezone);
    const hostDates = [...new Set([
      formatInTimeZone(candidateStart, schedule.timezone, 'yyyy-MM-dd'),
      formatInTimeZone(new Date(candidateEnd.getTime() - 1), schedule.timezone, 'yyyy-MM-dd'),
    ])];
    const slotLists = await Promise.all(hostDates.map((hostDate) => generateSlots(
      user.id, eventType.duration, schedule.timezone, schedule.days, schedule.dateOverrides, hostDate, {
        beforeEventBufferMinutes: schedule.beforeEventBufferMinutes,
        afterEventBufferMinutes: schedule.afterEventBufferMinutes,
        startTimeIncrementMinutes: schedule.startTimeIncrementMinutes,
        minimumNoticeMinutes: schedule.minimumNoticeMinutes,
        maximumDaysInFuture: schedule.maximumDaysInFuture,
        allowBackToBack: schedule.allowBackToBack,
      }
    )));
    const slots = slotLists.flat().filter((slot) => {
      const instant = new Date(slot);
      return instant >= candidateStart && instant < candidateEnd;
    });

    res.set('Cache-Control', 'no-store');
    res.json(slots.map(s => ({ time: s })));
  },

  async createBooking(req: Request, res: Response) {
    const username = req.params.username as string;
    const slug = req.params.slug as string;
    const { inviteeName, inviteeEmail, startTime } = normalizeBookingInput(req.body);

    const user = await publicService.getUserByUsername(username);
    const eventType = await publicService.getActiveEventType(user.id, slug);

    const startDate = new Date(startTime);

    const schedule = await publicService.getScheduleWithIntervals(user.id);

    if (!schedule) {
      throw new ConflictError('This time slot is no longer available');
    }

    const hostLocalDate = formatInTimeZone(startDate, schedule.timezone, 'yyyy-MM-dd');
    const effectiveBeforeBuffer = schedule.allowBackToBack
      ? 0
      : schedule.beforeEventBufferMinutes;
    const effectiveAfterBuffer = schedule.allowBackToBack
      ? 0
      : schedule.afterEventBufferMinutes;
    const generatedSlots = await generateSlots(
      user.id,
      eventType.duration,
      schedule.timezone,
      schedule.days,
      schedule.dateOverrides,
      hostLocalDate,
      {
        beforeEventBufferMinutes: effectiveBeforeBuffer,
        afterEventBufferMinutes: effectiveAfterBuffer,
        startTimeIncrementMinutes: schedule.startTimeIncrementMinutes,
        minimumNoticeMinutes: schedule.minimumNoticeMinutes,
        maximumDaysInFuture: schedule.maximumDaysInFuture,
        allowBackToBack: schedule.allowBackToBack,
      }
    );

    const requestedTime = startDate.getTime();
    const isSlotAvailable = generatedSlots.some((slot) => new Date(slot).getTime() === requestedTime);
    if (!isSlotAvailable) {
      throw new ConflictError('This time slot is no longer available');
    }

    const booking = await bookingsService.createPublicBooking(
      user.id,
      eventType.id,
      eventType.duration,
      { inviteeName, inviteeEmail, startTime: startDate.toISOString() },
      {
        beforeEventBufferMinutes: effectiveBeforeBuffer,
        afterEventBufferMinutes: effectiveAfterBuffer,
      }
    );

    res.status(201).json(booking);
  },

  /**
   * GET /api/public/reschedule/:uid/details
   *
   * Returns details about an existing booking by its UID, allowing the invitee
   * to see what they are rescheduling.
   */
  async getRescheduleDetails(req: Request, res: Response) {
    const uid = req.params.uid as string;
    const booking = await bookingsService.getByUidRaw(uid);

    // Panel bookings have no userId/user — use the first interviewer's schedule as fallback
    const hostUserId = booking.userId ?? booking.panel?.interviewers?.[0]?.userId;
    const schedule = hostUserId
      ? await publicService.getScheduleWithIntervals(hostUserId)
      : null;
    const effectiveTimezone = schedule?.timezone || booking.user?.timezone || 'UTC';

    res.json({
      kind: booking.panelId ? 'panel' : 'individual',
      booking: {
        uid: booking.uid,
        inviteeName: booking.inviteeName,
        inviteeEmail: booking.inviteeEmail,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status,
      },
      eventType: booking.eventType,
      panel: booking.panel
        ? {
            title: booking.panel.title,
            slug: booking.panel.slug,
            duration: booking.panel.duration,
            position: booking.panel.position,
            interviewers: booking.panel.interviewers?.map((pi: any) => ({ name: pi.user.name })),
          }
        : undefined,
      user: booking.user
        ? {
            name: booking.user.name,
            username: booking.user.username,
            timezone: effectiveTimezone,
          }
        : undefined,
    });
  },

  /**
   * POST /api/public/reschedule/:uid
   *
   * Cancels the old booking and creates a new one at the new startTime.
   */
  async rescheduleBooking(req: Request, res: Response) {
    const uid = req.params.uid as string;
    const { startTime } = req.body;

    if (!startTime) {
      throw new BadRequestError('startTime is required');
    }

    const startDate = new Date(String(startTime));
    if (Number.isNaN(startDate.getTime())) {
      throw new BadRequestError('Invalid startTime value');
    }

    const oldBooking = await bookingsService.getByUidRaw(uid);

    const candidateTimezone = String(req.body.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
    if (!isValidTimezone(candidateTimezone)) throw new BadRequestError('Invalid timezone value');
    // For panel bookings, validate the exact generated panel slot before changing state.
    if (oldBooking.panelId) {
      await validateBookableSlot({ sourceType: 'panel', slug: oldBooking.panel!.slug, startTime: startDate, candidateTimezone });
      const newBooking = await bookingsService.reschedulePublicBooking(
        uid,
        startDate.toISOString()
      );
      return res.status(201).json(newBooking);
    }

    const schedule = await publicService.getScheduleWithIntervals(oldBooking.userId!);

    if (!schedule) {
      throw new ConflictError('This time slot is no longer available');
    }

    const hostLocalDate = formatInTimeZone(startDate, schedule.timezone, 'yyyy-MM-dd');
    const effectiveBeforeBuffer = schedule.allowBackToBack
      ? 0
      : schedule.beforeEventBufferMinutes;
    const effectiveAfterBuffer = schedule.allowBackToBack
      ? 0
      : schedule.afterEventBufferMinutes;
      
    const generatedSlots = await generateSlots(
      oldBooking.userId!,
      oldBooking.eventType!.duration,
      schedule.timezone,
      schedule.days,
      schedule.dateOverrides,
      hostLocalDate,
      {
        beforeEventBufferMinutes: effectiveBeforeBuffer,
        afterEventBufferMinutes: effectiveAfterBuffer,
        startTimeIncrementMinutes: schedule.startTimeIncrementMinutes,
        minimumNoticeMinutes: schedule.minimumNoticeMinutes,
        maximumDaysInFuture: schedule.maximumDaysInFuture,
        allowBackToBack: schedule.allowBackToBack,
      }
    );

    const requestedTime = startDate.getTime();
    // Exclude the current booking's slot from overlap checks if it happens to be the same,
    // though typically they choose a new slot. The generateSlots only uses schedule rules,
    // not actual bookings. So we just verify it matches the host's hours.
    const isSlotAvailable = generatedSlots.some((slot) => new Date(slot).getTime() === requestedTime);
    if (!isSlotAvailable) {
      throw new ConflictError('This time slot is no longer available');
    }

    await validateBookableSlot({ sourceType: 'individual', username: oldBooking.user!.username, slug: oldBooking.eventType!.slug, startTime: startDate, candidateTimezone });
    const newBooking = await bookingsService.reschedulePublicBooking(
      uid,
      startDate.toISOString(),
      {
        beforeEventBufferMinutes: effectiveBeforeBuffer,
        afterEventBufferMinutes: effectiveAfterBuffer,
      }
    );

    res.status(201).json(newBooking);
  },
};
