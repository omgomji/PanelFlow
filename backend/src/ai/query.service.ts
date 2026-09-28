import { prisma } from '../config/prisma';
import { addDays } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import { bookingAccessWhere } from './db-scope';
import type { Citation } from './types';

function parseLocalBoundary(date: string | undefined, timezone: string, end = false): Date | undefined {
  if (!date) return undefined;
  const value = fromZonedTime(`${date}T${end ? '23:59:59.999' : '00:00:00.000'}`, timezone);
  return Number.isNaN(value.getTime()) ? undefined : value;
}

export async function queryMeetings(params: {
  userId: number;
  role: 'ADMIN' | 'INTERVIEWER';
  operation: 'meeting_count' | 'meeting_list' | 'meeting_lookup' | 'last_meeting' | 'meeting_prep';
  dateFrom?: string | null;
  dateTo?: string | null;
  query?: string;
  meetingId?: number | null;
  timezone: string;
}): Promise<{ context: Record<string, unknown>; citations: Citation[] }> {
  const where: any = { ...bookingAccessWhere(params.userId, params.role) };

  if (params.meetingId) where.id = params.meetingId;
  const from = parseLocalBoundary(params.dateFrom || undefined, params.timezone);
  const to = parseLocalBoundary(params.dateTo || params.dateFrom || undefined, params.timezone, true);
  if (from || to) {
    where.startTime = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }

  if (params.operation === 'meeting_count' || params.operation === 'meeting_list') {
    where.status = 'SCHEDULED';
  }

  const query = params.query?.trim();
  if (query) {
    where.AND = [{
      OR: [
        { inviteeName: { contains: query, mode: 'insensitive' } },
        { inviteeEmail: { contains: query, mode: 'insensitive' } },
        { eventType: { title: { contains: query, mode: 'insensitive' } } },
        { panel: { title: { contains: query, mode: 'insensitive' } } },
        { panel: { position: { title: { contains: query, mode: 'insensitive' } } } },
      ],
    }];
  }

  if (params.operation === 'last_meeting') {
    where.status = 'SCHEDULED';
    where.startTime = { ...(where.startTime || {}), lt: new Date() };
    const bookings = await prisma.booking.findMany({
      where,
      orderBy: { startTime: 'desc' },
      take: 1,
      include: { eventType: true, panel: { include: { position: true } }, hosts: true },
    });
    const booking = bookings[0];
    return {
      context: booking ? { booking: serializeBooking(booking) } : { booking: null },
      citations: booking ? [bookingCitation(booking)] : [],
    };
  }

  if (params.operation === 'meeting_lookup' || params.operation === 'meeting_prep') {
    const bookings = await prisma.booking.findMany({
      where: params.operation === 'meeting_prep' ? { ...where, status: 'SCHEDULED' } : where,
      orderBy: { startTime: params.operation === 'meeting_prep' ? 'asc' : 'desc' },
      take: params.operation === 'meeting_prep' ? 3 : 8,
      include: {
        eventType: true,
        panel: { include: { position: true, interviewers: { include: { user: true } } } },
        hosts: { include: { user: true } },
      },
    });
    return {
      context: { bookings: bookings.map(serializeBooking) },
      citations: bookings.map(bookingCitation),
    };
  }

  if (params.operation === 'meeting_count') {
    const count = await prisma.booking.count({ where });
    return { context: { count }, citations: [] };
  }

  const bookings = await prisma.booking.findMany({
    where,
    orderBy: { startTime: 'desc' },
    take: 12,
    include: { eventType: true, panel: { include: { position: true } }, hosts: true },
  });

  return {
    context: { bookings: bookings.map(serializeBooking) },
    citations: bookings.map(bookingCitation),
  };
}

function serializeBooking(booking: any) {
  return {
    id: booking.id,
    title: booking.panel?.title || booking.eventType?.title || 'Meeting',
    inviteeName: booking.inviteeName,
    inviteeEmail: booking.inviteeEmail,
    inviteeNotes: booking.inviteeNotes || null,
    startTime: booking.startTime.toISOString(),
    endTime: booking.endTime.toISOString(),
    durationMinutes: booking.durationMinutes,
    status: booking.status,
    position: booking.panel?.position?.title || null,
    hosts: booking.hosts?.map((host: any) => ({ id: host.userId, name: host.user?.name })).filter(Boolean) ?? [],
  };
}

function bookingCitation(booking: any): Citation {
  return {
    sourceType: 'booking',
    sourceId: String(booking.id),
    title: booking.panel?.title || booking.eventType?.title || 'Meeting',
    date: booking.startTime.toISOString(),
  };
}

export async function findMeetingForPreparation(params: {
  userId: number;
  role: 'ADMIN' | 'INTERVIEWER';
  date: string;
  query: string;
  timezone: string;
}) {
  const date = parseLocalBoundary(params.date, params.timezone);
  if (!date) return [];
  const nextLocalDate = addDays(new Date(`${params.date}T00:00:00.000Z`), 1).toISOString().slice(0, 10);
  const next = parseLocalBoundary(nextLocalDate, params.timezone);
  const q = params.query.trim();
  const contactMatches = q
    ? await prisma.contact.findMany({
        where: { userId: params.userId, OR: [{ name: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }] },
        select: { name: true, email: true },
        take: 5,
      })
    : [];
  const contactEmails = contactMatches.map((contact) => contact.email);

  return prisma.booking.findMany({
    where: {
      ...bookingAccessWhere(params.userId, params.role),
      status: 'SCHEDULED',
      startTime: { gte: date, lt: next },
      OR: [
        { inviteeName: { contains: q, mode: 'insensitive' } },
        { inviteeEmail: { contains: q, mode: 'insensitive' } },
        ...(contactEmails.length ? [{ inviteeEmail: { in: contactEmails } }] : []),
        { eventType: { title: { contains: q, mode: 'insensitive' } } },
        { panel: { title: { contains: q, mode: 'insensitive' } } },
        { panel: { position: { title: { contains: q, mode: 'insensitive' } } } },
      ],
    },
    orderBy: { startTime: 'asc' },
    take: 1,
    include: { eventType: true, panel: { include: { position: true, interviewers: { include: { user: true } } } }, hosts: { include: { user: true } } },
  });
}
