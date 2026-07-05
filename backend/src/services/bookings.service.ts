/**
 * Bookings Service
 *
 * Handles meeting queries (dashboard) and booking creation (public flow).
 * The booking creation uses layered conflict protection:
 *   Layer 1 (lock): transaction-level host row lock (FOR UPDATE)
 *   Layer 2 (app):  overlap SELECT with buffer windows
 *   Layer 3 (DB):   PostgreSQL EXCLUDE constraint for raw overlap safety
 *
 * BookingHost rows are kept in sync with every write:
 *   Create  — 1 BookingHost row per individual booking; N rows per panel booking.
 *   Cancel  — parent Booking + all BookingHost rows cancelled in same transaction.
 *   Reschedule — soft-cancel-old + create-new; panel reschedule re-validates
 *                availability against ALL panel interviewers.
 */
import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';
import { addMinutes, subMinutes } from 'date-fns';
import { NotFoundError, ConflictError, BadRequestError } from '../utils/errors';
import { panelSlotsService } from './panelSlots.service';
import { formatInTimeZone } from 'date-fns-tz';
import { emailService } from './email.service';
import { getConfirmationEmail, getCancellationEmail, getRescheduleEmail } from '../emails/templates';
import { webhookService } from './webhook.service';

interface OldBookingInfo {
  id: number;
  uid: string;
  startTime: Date;
  endTime: Date;
  eventType?: { title: string; duration: number } | null;
  panel?: { title: string; duration: number; interviewers: any[] } | null;
}

async function postBookingAutomation(action: 'created' | 'cancelled' | 'rescheduled' | 'no_show', bookingId: number, oldBookingInfo?: OldBookingInfo) {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        eventType: true,
        panel: {
          include: { position: true }
        }
      }
    });
    if (!booking) return;

    const hosts = await prisma.bookingHost.findMany({
      where: { bookingId },
      include: { user: true }
    });
    const hostUsers = hosts.map(h => h.user);
    
    let ownerId = booking.userId;
    if (!ownerId && booking.panelId) {
      ownerId = booking.panel?.position.createdById || null;
    }

    if (ownerId) {
      webhookService.dispatchWebhookEvent(ownerId, `booking.${action}`, booking);
    }

    if (action === 'no_show') return; // No automated email for no_show

    const toEmails = [booking.inviteeEmail, ...hostUsers.map(h => h.email)];

    if (action === 'created') {
      const { subject, html } = getConfirmationEmail(booking, hostUsers);
      emailService.sendEmail(toEmails, subject, html);
    } else if (action === 'cancelled') {
      const { subject, html } = getCancellationEmail(booking, hostUsers);
      emailService.sendEmail(toEmails, subject, html);
    } else if (action === 'rescheduled' && oldBookingInfo) {
      const { subject, html } = getRescheduleEmail(oldBookingInfo, booking, hostUsers);
      emailService.sendEmail(toEmails, subject, html);
    }
  } catch (error) {
    console.error(`Post-booking automation failed for action ${action}:`, error);
  }
}

export const bookingsService = {
  /**
   * Fetch bookings for the admin dashboard.
   *
   * Filtering logic:
   *   - 'upcoming': startTime >= NOW() AND status = 'SCHEDULED'
   *   - 'past':     startTime < NOW() (includes CANCELLED — admin sees full history)
   *   - omitted:    all bookings (no filter)
   *
   * Always includes the related eventType for display (title, slug, duration).
   */
  async findByUser(
    userId: number,
    filters?: {
      status?: string;
      from?: string;
      to?: string;
      q?: string;
      eventTypeId?: number;
      page?: number;
      limit?: number;
    }
  ) {
    const status = filters?.status;
    const now = new Date();

    const where: Prisma.BookingWhereInput = {
      eventType: { userId },
    };

    if (status === 'upcoming') {
      where.startTime = { gte: now };
      where.status = 'SCHEDULED';
    } else if (status === 'past') {
      where.startTime = { lt: now };
    } else if (status) {
      where.status = String(status).toUpperCase() as any;
    }

    if (filters?.from || filters?.to) {
      where.startTime = {
        ...(where.startTime as any || {}),
        ...(filters?.from ? { gte: new Date(filters.from) } : {}),
        ...(filters?.to ? { lte: new Date(filters.to) } : {}),
      };
    }

    if (filters?.eventTypeId) {
      where.eventTypeId = filters.eventTypeId;
    }

    if (filters?.q) {
      const query = filters.q.trim();
      if (query) {
        where.AND = [
          {
            OR: [
              { inviteeName: { contains: query, mode: 'insensitive' } },
              { inviteeEmail: { contains: query, mode: 'insensitive' } },
              { eventType: { title: { contains: query, mode: 'insensitive' } } },
            ],
          },
        ];
      }
    }

    let orderBy: Prisma.BookingOrderByWithRelationInput = { startTime: 'asc' };
    if (status === 'past') {
      orderBy = { startTime: 'desc' };
    }

    const hasPagination = filters?.page !== undefined && filters?.limit !== undefined;
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          eventType: {
            select: { id: true, title: true, slug: true, duration: true },
          },
        },
        orderBy,
        ...(hasPagination ? { skip, take: limit } : {}),
      }),
      prisma.booking.count({ where }),
    ]);

    if (!hasPagination) {
      return data as any; // Allow backward compat for unpaginated calls
    }

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Fetch all bookings where the current user is a BookingHost (panel interviewers).
   * Used by the Feedback page to list interviews the user participated in.
   */
  async findHosted(
    userId: number,
    status?: string
  ) {
    const now = new Date();
    const hostWhere: Prisma.BookingHostWhereInput = { userId };
    const bookingWhere: Prisma.BookingWhereInput = {};

    if (status === 'past') {
      hostWhere.startTime = { lt: now };
    } else if (status === 'upcoming') {
      hostWhere.startTime = { gte: now };
      hostWhere.status = 'SCHEDULED';
    }

    const hosts = await prisma.bookingHost.findMany({
      where: hostWhere,
      select: { bookingId: true },
    });

    const bookingIds = hosts.map(h => h.bookingId);
    if (!bookingIds.length) return [];

    return prisma.booking.findMany({
      where: { id: { in: bookingIds }, ...bookingWhere },
      include: {
        eventType: { select: { id: true, title: true, slug: true, duration: true } },
        panel: { select: { id: true, title: true, position: { select: { id: true, title: true } } } },
      },
      orderBy: { startTime: 'desc' },
    });
  },

  /**
   * Soft-cancel a booking (SCHEDULED → CANCELLED).
   *
   * Ownership is verified through the booking's eventType.userId,
   * not through booking.userId — this matches the admin's perspective
   * of "my meetings" via the event types they own.
   *
   * Cancels the parent Booking AND all its BookingHost rows in one transaction,
   * freeing the slot for all interviewers simultaneously.
   */
  async cancel(userId: number, bookingId: number, cancellationReason?: string) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { eventType: true },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }
    
    if (booking.eventTypeId && booking.eventType?.userId !== userId) {
      throw new NotFoundError('Booking not found');
    }

    const updatedBooking = await prisma.$transaction(async (tx) => {
      await tx.bookingHost.updateMany({
        where: { bookingId },
        data: { status: 'CANCELLED' },
      });
      return tx.booking.update({
        where: { id: bookingId },
        data: { status: 'CANCELLED', cancellationReason },
      });
    });

    setImmediate(() => postBookingAutomation('cancelled', bookingId));

    return updatedBooking;
  },

  async markNoShow(userId: number, bookingId: number) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { hosts: true, panel: { include: { position: true } } },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    const isAdmin = (await prisma.user.findUnique({ where: { id: userId } }))?.role === 'ADMIN';
    const isHost = booking.hosts.some(h => h.userId === userId);

    if (!isAdmin && !isHost) {
      throw new ConflictError('Not authorized to mark this booking as no-show');
    }

    const updatedBooking = await prisma.$transaction(async (tx) => {
      await tx.bookingHost.updateMany({
        where: { bookingId },
        data: { status: 'NO_SHOW' },
      });
      return tx.booking.update({
        where: { id: bookingId },
        data: { status: 'NO_SHOW' },
      });
    });

    setImmediate(() => postBookingAutomation('no_show', bookingId));

    return updatedBooking;
  },

  /**
   * Create a booking via the public booking flow (individual event type).
   *
   * Double-booking prevention (defence in depth):
   *
   *   1. Host row lock (SELECT ... FOR UPDATE):
   *      Serializes booking writes per user so concurrent requests can't
   *      both pass overlap checks before either INSERT commits.
   *
   *   2. Application layer (same transaction):
   *      SELECT for overlapping SCHEDULED BookingHost rows scoped to userId,
   *      expanded by before/after buffer windows.
   *      If found → throw ConflictError (409).
   *      If none → INSERT.
   *
   *   3. Database layer (exclusion constraint):
   *      Still enforces raw timestamp overlaps as a final safety net.
   *
   * After the Booking is created, one BookingHost row is written for the host.
   */
  async createPublicBooking(
    userId: number,
    eventTypeId: number,
    duration: number,
    data: { inviteeName: string; inviteeEmail: string; startTime: string },
    options?: {
      beforeEventBufferMinutes?: number;
      afterEventBufferMinutes?: number;
    }
  ) {
    const startUtc = new Date(data.startTime);
    const endUtc = addMinutes(startUtc, duration);
    const beforeEventBufferMinutes = Math.max(
      0,
      options?.beforeEventBufferMinutes ?? 0
    );
    const afterEventBufferMinutes = Math.max(
      0,
      options?.afterEventBufferMinutes ?? 0
    );
    const totalBufferWindowMinutes =
      beforeEventBufferMinutes + afterEventBufferMinutes;
    const bufferedWindowStartUtc = subMinutes(startUtc, totalBufferWindowMinutes);
    const bufferedWindowEndUtc = addMinutes(endUtc, totalBufferWindowMinutes);

    const result = await prisma.$transaction(async (tx) => {
      // Serialize booking writes per host to avoid race conditions for buffer windows.
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;

      // Check BookingHost for overlapping SCHEDULED commitments (individual + panel)
      const overlap = await tx.bookingHost.findFirst({
        where: {
          userId,
          status: 'SCHEDULED',
          startTime: { lt: bufferedWindowEndUtc },
          endTime: { gt: bufferedWindowStartUtc },
        },
      });

      if (overlap) {
        throw new ConflictError('This time slot is no longer available');
      }

      const booking = await tx.booking.create({
        data: {
          eventTypeId,
          userId, // Denormalised — enables exclusion constraint + direct queries
          inviteeName: data.inviteeName,
          inviteeEmail: data.inviteeEmail,
          startTime: startUtc,
          endTime: endUtc,
          status: 'SCHEDULED',
        },
      });

      // Create the single BookingHost row for this individual booking
      await tx.bookingHost.create({
        data: {
          bookingId: booking.id,
          userId,
          startTime: startUtc,
          endTime: endUtc,
          status: 'SCHEDULED',
        },
      });

      return booking;
    });
    
    setImmediate(() => postBookingAutomation('created', result.id));
    return result;
  },

  /**
   * Create a panel booking.
   *
   * Validates that the chosen slot is still free for EVERY panel interviewer
   * (same race-condition defence as individual bookings) then creates:
   *   - 1 Booking row (panelId set, eventTypeId+userId NULL)
   *   - N BookingHost rows (one per PanelInterviewer)
   *
   * Application-layer check: booking_exactly_one_kind is enforced here
   * (panelId must be set, eventTypeId/userId must be null) before the DB sees it.
   */
  async createPanelBooking(
    panelSlug: string,
    data: { inviteeName: string; inviteeEmail: string; startTime: string }
  ) {
    const panel = await prisma.panel.findUnique({
      where: { slug: panelSlug },
      include: {
        interviewers: true,
        position: { select: { title: true } },
      },
    });

    if (!panel || !panel.isActive) {
      throw new NotFoundError('Panel not found');
    }

    if (panel.interviewers.length === 0) {
      throw new BadRequestError('Panel has no interviewers');
    }

    const startUtc = new Date(data.startTime);
    if (Number.isNaN(startUtc.getTime())) {
      throw new BadRequestError('Invalid startTime');
    }
    const endUtc = addMinutes(startUtc, panel.duration);

    // Application-layer mutual-exclusivity guard (mirrors booking_exactly_one_kind CHECK)
    // panelId will be set; eventTypeId and userId will be null.

    const result = await prisma.$transaction(async (tx) => {
      // Lock all panel interviewer user rows to serialize concurrent panel bookings
      const interviewerIds = panel.interviewers.map((pi) => pi.userId).sort();
      for (const uid of interviewerIds) {
        await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${uid} FOR UPDATE`;
      }

      // Re-validate availability for every panel interviewer (race-condition defence)
      for (const pi of panel.interviewers) {
        const conflict = await tx.bookingHost.findFirst({
          where: {
            userId: pi.userId,
            status: 'SCHEDULED',
            startTime: { lt: endUtc },
            endTime: { gt: startUtc },
          },
        });

        if (conflict) {
          throw new ConflictError('This time slot is no longer available');
        }
      }

      // Validate the slot exists in the panel's generated availability
      const date = formatInTimeZone(startUtc, 'UTC', 'yyyy-MM-dd');
      const availableSlots = await panelSlotsService.getSlots(panelSlug, date);
      const isValid = availableSlots.some(
        (s) => new Date(s).getTime() === startUtc.getTime()
      );
      if (!isValid) {
        throw new ConflictError('This time slot is no longer available');
      }

      const booking = await tx.booking.create({
        data: {
          panelId: panel.id,
          // eventTypeId and userId explicitly NULL — panel booking
          inviteeName: data.inviteeName,
          inviteeEmail: data.inviteeEmail,
          startTime: startUtc,
          endTime: endUtc,
          status: 'SCHEDULED',
        },
      });

      // Create one BookingHost row per panel interviewer
      await tx.bookingHost.createMany({
        data: panel.interviewers.map((pi) => ({
          bookingId: booking.id,
          userId: pi.userId,
          startTime: startUtc,
          endTime: endUtc,
          status: 'SCHEDULED' as const,
        })),
      });

      return booking;
    });

    setImmediate(() => postBookingAutomation('created', result.id));
    return result;
  },

  /**
   * Fetch booking details by UID for the public reschedule flow.
   */
  async getByUidRaw(uid: string) {
    const booking = await prisma.booking.findUnique({
      where: { uid },
      include: {
        eventType: true,
        user: true,
        panel: {
          include: {
            position: { select: { title: true } },
            interviewers: {
              include: { user: { select: { name: true } } },
            },
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    return booking;
  },

  /**
   * Reschedule a public booking. Soft-cancels the old booking and creates a new one.
   * For panel bookings: re-validates new slot against all panel interviewers.
   */
  async reschedulePublicBooking(
    uid: string,
    newStartTime: string,
    options?: {
      beforeEventBufferMinutes?: number;
      afterEventBufferMinutes?: number;
    }
  ) {
    const oldBooking = await prisma.booking.findUnique({
      where: { uid },
      include: {
        eventType: true,
        panel: { include: { interviewers: true } },
      },
    });

    if (!oldBooking) {
      throw new NotFoundError('Booking not found');
    }

    if (oldBooking.status === 'CANCELLED') {
      throw new ConflictError('This booking is already cancelled.');
    }

    const isPanel = oldBooking.panelId !== null;
    const duration = isPanel ? oldBooking.panel!.duration : oldBooking.eventType!.duration;

    const startUtc = new Date(newStartTime);
    const endUtc = addMinutes(startUtc, duration);

    const beforeEventBufferMinutes = Math.max(0, options?.beforeEventBufferMinutes ?? 0);
    const afterEventBufferMinutes = Math.max(0, options?.afterEventBufferMinutes ?? 0);
    const totalBufferWindowMinutes = beforeEventBufferMinutes + afterEventBufferMinutes;
    const bufferedWindowStartUtc = subMinutes(startUtc, totalBufferWindowMinutes);
    const bufferedWindowEndUtc = addMinutes(endUtc, totalBufferWindowMinutes);

    const result = await prisma.$transaction(async (tx) => {
      if (isPanel) {
        // Lock all panel interviewers
        const interviewerIds = oldBooking.panel!.interviewers.map((pi) => pi.userId).sort();
        for (const uid2 of interviewerIds) {
          await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${uid2} FOR UPDATE`;
        }
      } else {
        // Serialize booking writes per host
        await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${oldBooking.userId} FOR UPDATE`;
      }

      // Cancel old booking + all its BookingHost rows
      await tx.bookingHost.updateMany({
        where: { bookingId: oldBooking.id },
        data: { status: 'CANCELLED' },
      });
      await tx.booking.update({
        where: { id: oldBooking.id },
        data: { status: 'CANCELLED' },
      });

      if (isPanel) {
        // Re-validate all panel interviewers for the new slot
        for (const pi of oldBooking.panel!.interviewers) {
          const conflict = await tx.bookingHost.findFirst({
            where: {
              userId: pi.userId,
              status: 'SCHEDULED',
              startTime: { lt: endUtc },
              endTime: { gt: startUtc },
            },
          });
          if (conflict) {
            throw new ConflictError('This time slot is no longer available');
          }
        }

        const newBooking = await tx.booking.create({
          data: {
            panelId: oldBooking.panelId,
            inviteeName: oldBooking.inviteeName,
            inviteeEmail: oldBooking.inviteeEmail,
            startTime: startUtc,
            endTime: endUtc,
            status: 'SCHEDULED',
          },
        });

        await tx.bookingHost.createMany({
          data: oldBooking.panel!.interviewers.map((pi) => ({
            bookingId: newBooking.id,
            userId: pi.userId,
            startTime: startUtc,
            endTime: endUtc,
            status: 'SCHEDULED' as const,
          })),
        });

        return newBooking;
      } else {
        // Individual booking reschedule
        const overlap = await tx.bookingHost.findFirst({
          where: {
            userId: oldBooking.userId!,
            status: 'SCHEDULED',
            startTime: { lt: bufferedWindowEndUtc },
            endTime: { gt: bufferedWindowStartUtc },
          },
        });

        if (overlap) {
          throw new ConflictError('This time slot is no longer available');
        }

        const newBooking = await tx.booking.create({
          data: {
            eventTypeId: oldBooking.eventTypeId,
            userId: oldBooking.userId,
            inviteeName: oldBooking.inviteeName,
            inviteeEmail: oldBooking.inviteeEmail,
            startTime: startUtc,
            endTime: endUtc,
            status: 'SCHEDULED',
          },
        });

        await tx.bookingHost.create({
          data: {
            bookingId: newBooking.id,
            userId: oldBooking.userId!,
            startTime: startUtc,
            endTime: endUtc,
            status: 'SCHEDULED',
          },
        });

        return newBooking;
      }
    });

    setImmediate(() => postBookingAutomation('rescheduled', result.id, oldBooking));
    return result;
  },
};
