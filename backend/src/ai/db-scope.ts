import type { Prisma } from '@prisma/client';

export function bookingAccessWhere(
  userId: number,
  role: 'ADMIN' | 'INTERVIEWER',
): Prisma.BookingWhereInput {
  if (role === 'ADMIN') return {};

  return {
    OR: [
      { eventType: { userId } },
      { panel: { position: { createdById: userId } } },
      { hosts: { some: { userId } } },
    ],
  };
}

export function contactAccessWhere(userId: number): Prisma.ContactWhereInput {
  return { userId };
}

export function eventTypeAccessWhere(
  userId: number,
  role: 'ADMIN' | 'INTERVIEWER',
): Prisma.EventTypeWhereInput {
  return role === 'ADMIN' ? {} : { userId };
}
