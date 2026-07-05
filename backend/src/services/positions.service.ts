/**
 * Positions Service
 *
 * CRUD for job positions. Mirrors the validation style of eventTypes.service.ts.
 * Only ADMIN users can create/edit/delete. Role enforcement is in the router.
 */
import { prisma } from '../config/prisma';
import { NotFoundError, BadRequestError } from '../utils/errors';

export const positionsService = {
  async findAll() {
    return prisma.position.findMany({
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        panels: {
          include: {
            interviewers: {
              include: { user: { select: { id: true, name: true, email: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  async findById(id: number) {
    const position = await prisma.position.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        panels: {
          include: {
            interviewers: {
              include: { user: { select: { id: true, name: true, email: true } } },
            },
          },
        },
      },
    });

    if (!position) throw new NotFoundError('Position not found');
    return position;
  },

  async create(
    createdById: number,
    data: { title: string; description?: string; status?: 'OPEN' | 'CLOSED' }
  ) {
    if (!data.title?.trim()) {
      throw new BadRequestError('Title is required');
    }

    return prisma.position.create({
      data: {
        title: data.title.trim(),
        description: data.description,
        status: data.status ?? 'OPEN',
        createdById,
      },
    });
  },

  async update(
    id: number,
    data: { title?: string; description?: string; status?: 'OPEN' | 'CLOSED' }
  ) {
    const position = await prisma.position.findUnique({ where: { id } });
    if (!position) throw new NotFoundError('Position not found');

    return prisma.position.update({
      where: { id },
      data: {
        title: data.title?.trim(),
        description: data.description,
        status: data.status,
      },
    });
  },

  async remove(id: number) {
    const position = await prisma.position.findUnique({ where: { id } });
    if (!position) throw new NotFoundError('Position not found');

    await prisma.position.delete({ where: { id } });
    return { success: true };
  },

  async getCandidates(positionId: number) {
    const position = await prisma.position.findUnique({
      where: { id: positionId },
      include: {
        panels: {
          select: { id: true }
        }
      }
    });

    if (!position) throw new NotFoundError('Position not found');

    const panelIds = position.panels.map(p => p.id);
    if (panelIds.length === 0) return [];

    const bookings = await prisma.booking.findMany({
      where: {
        panelId: { in: panelIds }
      },
      include: {
        panel: true,
        feedback: true
      },
      orderBy: { startTime: 'desc' }
    });

    const candidateMap = new Map<string, any>();

    for (const booking of bookings) {
      if (!candidateMap.has(booking.inviteeEmail)) {
        candidateMap.set(booking.inviteeEmail, {
          inviteeName: booking.inviteeName,
          inviteeEmail: booking.inviteeEmail,
          interviews: []
        });
      }

      const candidate = candidateMap.get(booking.inviteeEmail);

      const feedbackCounts = { STRONG_YES: 0, YES: 0, NO: 0, STRONG_NO: 0 };
      for (const fb of booking.feedback) {
        if (fb.recommendation in feedbackCounts) {
          feedbackCounts[fb.recommendation as keyof typeof feedbackCounts]++;
        }
      }

      candidate.interviews.push({
        bookingId: booking.id,
        panelTitle: booking.panel?.title || 'Unknown Panel',
        startTime: booking.startTime.toISOString(),
        status: booking.status,
        feedbackCounts
      });
    }

    return Array.from(candidateMap.values());
  }
};
