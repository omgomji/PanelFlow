import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { webhookService } from '../services/webhook.service';
import { Recommendation } from '@prisma/client';
import { ForbiddenError, NotFoundError } from '../utils/errors';

export const feedbackController = {
  // GET /api/bookings/:id/feedback
  async getFeedback(req: Request, res: Response, next: NextFunction) {
    try {
      const bookingId = parseInt(String(req.params.id), 10);
      const userId = req.user!.id;
      const role = req.user!.role;

      // Ensure booking exists
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { hosts: true }
      });
      if (!booking) {
        throw new NotFoundError('Booking not found');
      }

      const allFeedback = await prisma.feedback.findMany({
        where: { bookingId },
        include: {
          interviewer: {
            select: { id: true, name: true, email: true }
          }
        },
        orderBy: { createdAt: 'asc' }
      });

      if (role === 'ADMIN') {
        return res.json(allFeedback);
      }

      // If INTERVIEWER, they must be a host
      const isHost = booking.hosts.some(h => h.userId === userId);
      if (!isHost) {
        throw new ForbiddenError('You must be a host on this booking to view feedback.');
      }

      const myFeedback = allFeedback.find(f => f.interviewerId === userId);

      // Reveal-gating: if I haven't submitted, I only see my own (which is empty anyway since I haven't submitted)
      if (!myFeedback) {
        return res.json([]);
      }

      // I have submitted, I see all
      return res.json(allFeedback);
    } catch (error) {
      next(error);
    }
  },

  // PUT /api/bookings/:id/feedback
  async upsertFeedback(req: Request, res: Response, next: NextFunction) {
    try {
      const bookingId = parseInt(String(req.params.id), 10);
      const userId = req.user!.id;
      const { recommendation, notes } = req.body;

      if (!Object.values(Recommendation).includes(recommendation)) {
        return res.status(400).json({ error: 'Invalid recommendation value' });
      }

      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: { hosts: true, panel: { include: { position: true } } }
      });

      if (!booking) {
        throw new NotFoundError('Booking not found');
      }

      // Must be a host
      const isHost = booking.hosts.some(h => h.userId === userId);
      if (!isHost) {
        throw new ForbiddenError('Only hosts can submit feedback for this booking.');
      }

      if (booking.status === 'CANCELLED') {
        return res.status(400).json({ error: 'Cannot submit feedback for a CANCELLED booking.' });
      }

      const now = new Date();
      if (now < booking.endTime) {
        return res.status(400).json({ error: 'Cannot submit feedback before the booking has ended.' });
      }

      const feedback = await prisma.feedback.upsert({
        where: {
          bookingId_interviewerId: { bookingId, interviewerId: userId }
        },
        update: { recommendation, notes },
        create: { bookingId, interviewerId: userId, recommendation, notes }
      });

      // Fire webhook
      let ownerId = booking.userId;
      if (booking.panel) {
        ownerId = booking.panel.position.createdById;
      }
      
      if (ownerId) {
        webhookService.dispatchWebhookEvent(ownerId, 'feedback.submitted', {
          bookingId: booking.id,
          interviewerId: userId,
          recommendation,
          notes
        });
      }

      return res.json(feedback);
    } catch (error) {
      next(error);
    }
  }
};
