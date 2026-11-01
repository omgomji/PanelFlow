import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { redis } from '../config/redis';
import { isKafkaConfigured } from '../config/kafka';
import { NotFoundError, BadRequestError } from '../utils/errors';

let lastEventProcessingError: { message: string; timestamp: string } | null = null;

export function recordEventProcessingError(message: string) {
  lastEventProcessingError = { message, timestamp: new Date().toISOString() };
}

export const adminController = {
  // GET /api/admin/users
  async getUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const { role } = req.query as { role?: 'ADMIN' | 'INTERVIEWER' };
      const where = role ? { role } : {};

      const users = await prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          username: true,
          role: true,
          timezone: true,
          tokenVersion: true,
        },
        orderBy: { id: 'desc' },
      });

      res.json(users);
    } catch (error) {
      next(error);
    }
  },

  // GET /api/admin/calibration
  // Returns interview recommendation distribution per interviewer to identify bias/calibration drift
  async getCalibration(req: Request, res: Response, next: NextFunction) {
    try {
      const interviewers = await prisma.user.findMany({
        where: { role: 'INTERVIEWER' },
        select: {
          id: true,
          name: true,
          email: true,
          feedback: {
            select: {
              recommendation: true,
            },
          },
        },
      });

      const calibration = interviewers.map((user) => {
        const counts = { STRONG_NO: 0, NO: 0, YES: 0, STRONG_YES: 0 };
        for (const f of user.feedback) {
          if (f.recommendation in counts) {
            counts[f.recommendation]++;
          }
        }
        const total = user.feedback.length;
        return {
          userId: user.id,
          name: user.name,
          email: user.email,
          totalReviews: total,
          recommendationCounts: counts,
          positivePercentage: total > 0 ? Math.round(((counts.YES + counts.STRONG_YES) / total) * 100) : 0,
        };
      });

      res.json(calibration);
    } catch (error) {
      next(error);
    }
  },

  // GET /api/admin/workload?days=30&positionId=1
  async getWorkload(req: Request, res: Response, next: NextFunction) {
    try {
      const days = parseInt(req.query.days as string, 10) || 30;
      const positionId = req.query.positionId ? parseInt(String(req.query.positionId), 10) : undefined;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Build where clause for bookings within date range
      const bookingWhere: Record<string, unknown> = {
        startTime: { gte: startDate, lt: new Date() },
        status: { not: 'CANCELLED' },
      };
      if (positionId) {
        bookingWhere.panel = { positionId };
      }

      // Group BookingHost rows by userId where status is not CANCELLED
      const hosts = await prisma.bookingHost.groupBy({
        by: ['userId'],
        where: bookingWhere,
        _count: {
          _all: true,
        },
      });

      // We need user names, so let's fetch users
      const users = await prisma.user.findMany({
        where: { role: 'INTERVIEWER' },
        select: { id: true, name: true },
      });

      const workload = users.map((u) => {
        const hostRecord = hosts.find((h) => h.userId === u.id);
        return {
          userId: u.id,
          name: u.name,
          interviewCount: hostRecord ? hostRecord._count._all : 0,
        };
      });

      // Sort by interviewCount descending
      workload.sort((a, b) => b.interviewCount - a.interviewCount);

      res.json(workload);
    } catch (error) {
      next(error);
    }
  },

  // GET /api/admin/feedback-completion?days=30&positionId=1
  async getFeedbackCompletion(req: Request, res: Response, next: NextFunction) {
    try {
      const days = parseInt(req.query.days as string, 10) || 30;
      const positionId = req.query.positionId ? parseInt(String(req.query.positionId), 10) : undefined;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const bookingWhere: Record<string, unknown> = {
        startTime: { gte: startDate, lt: new Date() },
        status: { not: 'CANCELLED' },
      };
      if (positionId) {
        bookingWhere.panel = { positionId };
      }

      // All conducted (non-cancelled) bookings in range
      const totalBookings = await prisma.booking.count({ where: bookingWhere });

      // Bookings that have feedback from ALL their hosts (interviewers)
      const bookingsWithFeedback = await prisma.booking.findMany({
        where: bookingWhere,
        include: {
          hosts: true,
          feedback: true,
        },
      });

      let fullyReviewed = 0;
      let overdue = 0;
      let totalDelayMinutes = 0;
      let delayCount = 0;

      for (const b of bookingsWithFeedback) {
        const hostCount = b.hosts.length;
        const feedbackCount = b.feedback.length;

        if (hostCount > 0 && feedbackCount >= hostCount) {
          fullyReviewed++;

          // Calculate average submission delay (time from booking end to latest feedback)
          const latestFeedback = b.feedback.reduce(
            (latest, f) => (new Date(f.createdAt) > new Date(latest.createdAt) ? f : latest),
            b.feedback[0]
          );
          const delayMs = new Date(latestFeedback.createdAt).getTime() - b.endTime.getTime();
          totalDelayMinutes += delayMs / (1000 * 60);
          delayCount++;
        } else if (hostCount > 0 && feedbackCount < hostCount) {
          overdue++;
        }
      }

      const completionRate = totalBookings > 0 ? Math.round((fullyReviewed / totalBookings) * 100) : 0;
      const avgDelayMinutes = delayCount > 0 ? Math.round(totalDelayMinutes / delayCount) : 0;

      res.json({
        totalBookings,
        fullyReviewed,
        overdue,
        completionRate,
        avgDelayMinutes,
      });
    } catch (error) {
      next(error);
    }
  },

  // GET /api/admin/candidates?positionId=1&days=30
  async getCandidatesByPosition(req: Request, res: Response, next: NextFunction) {
    try {
      const positionId = req.query.positionId ? parseInt(String(req.query.positionId), 10) : undefined;
      const days = parseInt(req.query.days as string, 10) || 30;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const position = positionId
        ? await prisma.position.findUnique({ where: { id: positionId } })
        : null;

      if (positionId && !position) {
        throw new NotFoundError('Position not found');
      }

      const bookingWhere: Record<string, unknown> = {
        startTime: { gte: startDate, lt: new Date() },
        status: { not: 'CANCELLED' },
      };
      if (positionId) {
        bookingWhere.panel = { positionId };
      }

      const bookings = await prisma.booking.findMany({
        where: bookingWhere,
        include: {
          panel: {
            select: {
              id: true,
              title: true,
              position: { select: { id: true, title: true } },
            },
          },
          feedback: {
            include: {
              interviewer: { select: { id: true, name: true } },
            },
          },
          hosts: {
            include: {
              user: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { startTime: 'desc' },
      });

      // Group by candidate email
      const candidateMap = new Map<string, any>();

      for (const b of bookings) {
        const key = b.inviteeEmail.toLowerCase();
        if (!candidateMap.has(key)) {
          candidateMap.set(key, {
            inviteeName: b.inviteeName,
            inviteeEmail: b.inviteeEmail,
            interviews: [],
            totalFeedback: 0,
            pendingFeedback: 0,
          });
        }
        const candidate = candidateMap.get(key);

        const feedbackCount = b.feedback.length;
        const hostCount = b.hosts.length;
        candidate.totalFeedback += feedbackCount;
        candidate.pendingFeedback += Math.max(0, hostCount - feedbackCount);

        candidate.interviews.push({
          bookingId: b.id,
          panelTitle: b.panel?.title || 'Unknown Panel',
          positionTitle: b.panel?.position?.title || 'General',
          startTime: b.startTime.toISOString(),
          endTime: b.endTime.toISOString(),
          status: b.status,
          feedbackCount,
          hostCount,
          feedback: b.feedback.map((f) => ({
            interviewerId: f.interviewerId,
            interviewerName: f.interviewer.name,
            recommendation: f.recommendation,
            notes: f.notes,
            createdAt: f.createdAt,
          })),
        });
      }

      const candidates = Array.from(candidateMap.values()).sort(
        (a, b) =>
          new Date(b.interviews[0]?.startTime || 0).getTime() -
          new Date(a.interviews[0]?.startTime || 0).getTime()
      );

      res.json({ position, candidates });
    } catch (error) {
      next(error);
    }
  },

  // GET /api/admin/system-status
  async getSystemStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const emailConfigured = Boolean(process.env.RESEND_API_KEY);
      const kafkaConfigured = isKafkaConfigured;
      const redisConnected = redis.isConnected;

      res.json({
        email: {
          configured: emailConfigured,
          provider: emailConfigured ? 'Resend' : 'Not configured',
        },
        kafka: {
          configured: kafkaConfigured,
          mode: kafkaConfigured ? 'active' : 'fallback',
        },
        redis: {
          connected: redisConnected,
          mode: redisConnected ? 'active' : 'fallback',
        },
        lastEventProcessingError,
      });
    } catch (error) {
      next(error);
    }
  },
};
