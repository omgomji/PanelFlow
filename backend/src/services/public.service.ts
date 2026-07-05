import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { NotFoundError } from '../utils/errors';

function toYyyyMmDd(value: Date | string): string {
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }

  return value.toISOString().slice(0, 10);
}

function isLegacyBufferColumnError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  if (error.code !== 'P2022') {
    return false;
  }

  const details = `${error.message} ${JSON.stringify(error.meta ?? {})}`;
  return (
    details.includes('beforeEventBufferMinutes') ||
    details.includes('afterEventBufferMinutes') ||
    details.includes('startTimeIncrementMinutes') ||
    details.includes('minimumNoticeMinutes') ||
    details.includes('maximumDaysInFuture') ||
    details.includes('allowBackToBack')
  );
}

export const publicService = {
  async getUserByUsername(username: string) {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    return user;
  },

  async getActiveEventType(userId: number, slug: string) {
    const eventType = await prisma.eventType.findUnique({
      where: { userId_slug: { userId, slug } },
    });

    if (!eventType || !eventType.isActive) {
      throw new NotFoundError('Event type not found');
    }

    return eventType;
  },

  async getActiveEventTypesByUser(userId: number) {
    return prisma.eventType.findMany({
      where: { userId, isActive: true },
      orderBy: { id: 'desc' },
    });
  },

  async getScheduleWithIntervals(userId: number) {
    try {
      const schedule = await prisma.availabilitySchedule.findUnique({
        where: { userId },
        include: {
          days: {
            include: {
              intervals: {
                orderBy: { order: 'asc' },
              },
            },
            orderBy: { dayOfWeek: 'asc' },
          },
          dateOverrides: {
            include: {
              intervals: {
                orderBy: { order: 'asc' },
              },
            },
            orderBy: { date: 'asc' },
          },
        },
      });

      if (!schedule) {
        return null;
      }

      return {
        ...schedule,
        dateOverrides: schedule.dateOverrides.map((override) => ({
          ...override,
          date: toYyyyMmDd(override.date),
        })),
        beforeEventBufferMinutes: schedule.beforeEventBufferMinutes ?? 0,
        afterEventBufferMinutes: schedule.afterEventBufferMinutes ?? 0,
        startTimeIncrementMinutes: schedule.startTimeIncrementMinutes ?? 30,
        minimumNoticeMinutes: schedule.minimumNoticeMinutes ?? 0,
        maximumDaysInFuture: schedule.maximumDaysInFuture ?? 60,
        allowBackToBack: schedule.allowBackToBack ?? true,
      };
    } catch (error) {
      if (!isLegacyBufferColumnError(error)) {
        throw error;
      }

      const legacySchedule = await prisma.availabilitySchedule.findUnique({
        where: { userId },
        select: {
          id: true,
          userId: true,
          timezone: true,
          days: {
            include: {
              intervals: {
                orderBy: { order: 'asc' },
              },
            },
            orderBy: { dayOfWeek: 'asc' },
          },
          dateOverrides: {
            include: {
              intervals: {
                orderBy: { order: 'asc' },
              },
            },
            orderBy: { date: 'asc' },
          },
        },
      });

      if (!legacySchedule) {
        return null;
      }

      return {
        ...legacySchedule,
        dateOverrides: legacySchedule.dateOverrides.map((override) => ({
          ...override,
          date: toYyyyMmDd(override.date),
        })),
        beforeEventBufferMinutes: 0,
        afterEventBufferMinutes: 0,
        startTimeIncrementMinutes: 30,
        minimumNoticeMinutes: 0,
        maximumDaysInFuture: 60,
        allowBackToBack: true,
      };
    }
  },
};
