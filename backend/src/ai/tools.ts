import { tool } from '@langchain/core/tools';
import { z } from 'zod4';
import { prisma } from '../config/prisma';
import { bookingAccessWhere } from './db-scope';
import { generateSlots } from '../services/slots.service';
import { fromZonedTime } from 'date-fns-tz';

export function createMeetingLookupTool(userId: number, role: 'ADMIN' | 'INTERVIEWER') {
  return tool(
    async ({ bookingId }) => {
      const booking = await prisma.booking.findFirst({
        where: { id: bookingId, ...bookingAccessWhere(userId, role) },
        include: {
          eventType: { select: { id: true, title: true } },
          panel: { select: { id: true, title: true, position: { select: { id: true, title: true } } } },
          hosts: { select: { userId: true } },
        },
      });
      if (!booking) return { found: false };
      return {
        found: true,
        booking: {
          id: booking.id,
          title: booking.panel?.title || booking.eventType?.title || 'Meeting',
          inviteeName: booking.inviteeName,
          inviteeEmail: booking.inviteeEmail,
          startTime: booking.startTime.toISOString(),
          endTime: booking.endTime.toISOString(),
          status: booking.status,
          position: booking.panel?.position?.title,
          hostUserIds: booking.hosts.map((host) => host.userId),
        },
      };
    },
    {
      name: 'lookup_meeting',
      description: 'Look up a specific PanelFlow meeting using the authenticated user authorization scope.',
      schema: z.object({ bookingId: z.number().int().positive() }),
    },
  );
}

export function createAvailabilityTool(userId: number) {
  return tool(
    async ({ date, durationMinutes }) => {
      const schedule = await prisma.availabilitySchedule.findUnique({
        where: { userId },
        include: {
          days: { include: { intervals: { orderBy: { order: 'asc' } } }, orderBy: { dayOfWeek: 'asc' } },
          dateOverrides: { include: { intervals: { orderBy: { order: 'asc' } } }, orderBy: { date: 'asc' } },
        },
      });
      if (!schedule) return { date, slots: [] };
      const slots = await generateSlots(
        userId,
        durationMinutes,
        schedule.timezone,
        schedule.days,
        schedule.dateOverrides,
        date,
        schedule,
      );
      return { date, timezone: schedule.timezone, durationMinutes, slots };
    },
    {
      name: 'check_availability',
      description: 'Check deterministic availability for the authenticated PanelFlow user.',
      schema: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), durationMinutes: z.number().int().positive() }),
    },
  );
}

function bookingManagementWhere(userId: number, role: 'ADMIN' | 'INTERVIEWER') {
  if (role === 'ADMIN') return {};
  return {
    OR: [
      { eventType: { userId } },
      { panel: { position: { createdById: userId } } },
    ],
  };
}

export function createCancelMeetingTool(userId: number, role: 'ADMIN' | 'INTERVIEWER', timezone: string) {
  return tool(
    async ({ bookingId, date, searchQuery }) => {
      const where: any = {
        ...bookingManagementWhere(userId, role),
        status: 'SCHEDULED',
      };
      if (bookingId) where.id = bookingId;
      if (date) {
        const start = fromZonedTime(`${date}T00:00:00.000`, timezone);
        const end = fromZonedTime(`${date}T23:59:59.999`, timezone);
        where.startTime = { gte: start, lte: end };
      }
      const q = searchQuery?.trim();
      if (q) {
        where.AND = [{
          OR: [
            { inviteeName: { contains: q, mode: 'insensitive' } },
            { inviteeEmail: { contains: q, mode: 'insensitive' } },
            { eventType: { title: { contains: q, mode: 'insensitive' } } },
            { panel: { title: { contains: q, mode: 'insensitive' } } },
            { panel: { position: { title: { contains: q, mode: 'insensitive' } } } },
          ],
        }];
      }
      const bookings = await prisma.booking.findMany({
        where,
        orderBy: { startTime: 'asc' },
        take: 5,
        include: { eventType: true, panel: { include: { position: true } } },
      });
      if (bookings.length !== 1) return { found: bookings.length > 0, ambiguous: bookings.length > 1, booking: undefined };
      const booking = bookings[0];
      return {
        found: true,
        booking: {
          id: booking.id,
          title: booking.panel?.title || booking.eventType?.title || 'Meeting',
          inviteeName: booking.inviteeName,
          inviteeEmail: booking.inviteeEmail,
          startTime: booking.startTime.toISOString(),
          status: booking.status,
        },
      };
    },
    {
      name: 'prepare_cancel_meeting',
      description: 'Find one scheduled meeting within the authenticated user scope and prepare a cancellation confirmation; never performs the mutation.',
      schema: z.object({
        bookingId: z.number().int().positive().optional(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        searchQuery: z.string().trim().max(200).optional(),
      }),
    },
  );
}
