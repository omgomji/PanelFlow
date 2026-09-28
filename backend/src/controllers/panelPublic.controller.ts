/**
 * Panel Public Controller
 *
 * Handles the public-facing panel booking flow:
 *   1. GET panel details (for the booking page header)
 *   2. GET available time slots (intersection of all panel interviewers)
 *   3. POST create a panel booking (with race-condition defence)
 *
 * No authentication required — accessed by candidates via /panel/:panelSlug.
 */
import { Request, Response } from 'express';
import { panelSlotsService } from '../services/panelSlots.service';
import { panelsService } from '../services/panels.service';
import { bookingsService } from '../services/bookings.service';
import { BadRequestError } from '../utils/errors';
import { isValidTimezone, isValidYyyyMmDd } from '../utils/availability.validation';

function bookingInput(body: Record<string, unknown>) {
  const inviteeName = String(body.inviteeName ?? '').trim();
  const inviteeEmail = String(body.inviteeEmail ?? '').trim().toLowerCase();
  const startTime = String(body.startTime ?? '');
  if (!inviteeName || inviteeName.length > 200) throw new BadRequestError('Invalid inviteeName');
  if (!inviteeEmail || inviteeEmail.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteeEmail)) throw new BadRequestError('Invalid inviteeEmail');
  if (Number.isNaN(new Date(startTime).getTime())) throw new BadRequestError('Invalid startTime');
  return { inviteeName, inviteeEmail, startTime };
}

export const panelPublicController = {
  /**
   * GET /api/public/panels/:panelSlug
   * Returns panel details for the booking page header.
   */
  async getPanelDetails(req: Request, res: Response) {
    const panelSlug = req.params.panelSlug as string;
    const panel = await panelsService.findBySlug(panelSlug);

    res.json({
      panel: {
        id: panel.id,
        title: panel.title,
        slug: panel.slug,
        duration: panel.duration,
        isActive: panel.isActive,
        position: panel.position,
        interviewers: panel.interviewers.map((pi) => ({
          id: pi.user.id,
          name: pi.user.name,
        })),
      },
    });
  },

  /**
   * GET /api/public/panels/:panelSlug/slots?date=YYYY-MM-DD
   * Returns available UTC slot strings — same shape as individual booking slots endpoint.
   */
  async getSlots(req: Request, res: Response) {
    const panelSlug = req.params.panelSlug as string;
    const date = req.query.date as string | undefined;
    const timezone = req.query.timezone as string | undefined;

    if (!date || !isValidYyyyMmDd(date) || !timezone || !isValidTimezone(timezone)) {
      throw new BadRequestError('date (YYYY-MM-DD) and timezone are required');
    }

    const slots = await panelSlotsService.getSlots(panelSlug, date, timezone);

    res.set('Cache-Control', 'no-store');
    res.json(slots.map((s) => ({ time: s })));
  },

  /**
   * POST /api/public/panels/:panelSlug/book
   * Creates a panel booking (1 Booking + N BookingHost rows, one per interviewer).
   */
  async createBooking(req: Request, res: Response) {
    const panelSlug = req.params.panelSlug as string;
    const { inviteeName, inviteeEmail, startTime } = bookingInput(req.body);
    const timezone = String(req.body.timezone ?? '');
    if (!isValidTimezone(timezone)) throw new BadRequestError('Invalid timezone value');
    const startDate = new Date(startTime);

    const booking = await bookingsService.createPanelBooking(panelSlug, {
      inviteeName,
      inviteeEmail,
      startTime: startDate.toISOString(),
      timezone,
    });

    // Fetch panel with interviewers for confirmation response
    const panel = await panelsService.findBySlug(panelSlug);

    res.status(201).json({
      ...booking,
      panel: {
        title: panel.title,
        position: panel.position,
        interviewers: panel.interviewers.map((pi) => ({ name: pi.user.name })),
      },
    });
  },
};
