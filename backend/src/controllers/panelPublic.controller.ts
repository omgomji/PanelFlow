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

    if (!date) {
      throw new BadRequestError('date is required (YYYY-MM-DD)');
    }

    const slots = await panelSlotsService.getSlots(panelSlug, date);

    res.set('Cache-Control', 'no-store');
    res.json(slots.map((s) => ({ time: s })));
  },

  /**
   * POST /api/public/panels/:panelSlug/book
   * Creates a panel booking (1 Booking + N BookingHost rows, one per interviewer).
   */
  async createBooking(req: Request, res: Response) {
    const panelSlug = req.params.panelSlug as string;
    const { inviteeName, inviteeEmail, startTime } = req.body as {
      inviteeName?: string;
      inviteeEmail?: string;
      startTime?: string;
    };

    if (!inviteeName || !inviteeEmail || !startTime) {
      throw new BadRequestError('inviteeName, inviteeEmail, and startTime are required');
    }

    const startDate = new Date(String(startTime));
    if (Number.isNaN(startDate.getTime())) {
      throw new BadRequestError('Invalid startTime value');
    }

    const booking = await bookingsService.createPanelBooking(panelSlug, {
      inviteeName,
      inviteeEmail,
      startTime: startDate.toISOString(),
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
