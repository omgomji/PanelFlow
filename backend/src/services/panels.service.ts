/**
 * Panels Service
 *
 * CRUD for interview panels within positions.
 * Includes add/remove-interviewer sub-routes.
 * Mirrors the validation style of eventTypes.service.ts.
 */
import { prisma } from '../config/prisma';
import { NotFoundError, BadRequestError, ConflictError } from '../utils/errors';
import { safeReindexPanelAndBookings } from '../ai/indexers/sync';

export const panelsService = {
  async findById(id: number) {
    const panel = await prisma.panel.findUnique({
      where: { id },
      include: {
        position: { select: { id: true, title: true, status: true } },
        interviewers: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    if (!panel) throw new NotFoundError('Panel not found');
    return panel;
  },

  async findBySlug(slug: string) {
    const panel = await prisma.panel.findFirst({
      where: { slug, isActive: true, position: { status: 'OPEN' } },
      include: {
        position: { select: { id: true, title: true, status: true } },
        interviewers: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    if (!panel) throw new NotFoundError('Panel not found');
    return panel;
  },

  async findByUser(userId: number) {
    // Returns panels where the user is an interviewer
    return prisma.panel.findMany({
      where: {
        interviewers: { some: { userId } },
      },
      include: {
        position: { select: { id: true, title: true } },
        interviewers: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
      orderBy: { id: 'desc' },
    });
  },

  async create(
    positionId: number,
    data: {
      title: string;
      slug: string;
      duration: number;
      interviewerIds?: number[];
    }
  ) {
    if (!data.title?.trim()) throw new BadRequestError('Title is required');
    if (!data.slug?.trim()) throw new BadRequestError('Slug is required');
    if (!Number.isInteger(data.duration) || data.duration < 1) {
      throw new BadRequestError('Duration must be at least 1 minute');
    }

    const position = await prisma.position.findUnique({ where: { id: positionId } });
    if (!position) throw new NotFoundError('Position not found');

    const existing = await prisma.panel.findUnique({ where: { slug: data.slug } });
    if (existing) throw new ConflictError('A panel with this slug already exists');

    const created = await prisma.panel.create({
      data: {
        positionId,
        title: data.title.trim(),
        slug: data.slug.trim(),
        duration: data.duration,
        interviewers: data.interviewerIds?.length
          ? {
              create: data.interviewerIds.map((userId) => ({ userId })),
            }
          : undefined,
      },
      include: {
        position: { select: { id: true, title: true } },
        interviewers: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });
    void safeReindexPanelAndBookings(created.id, 'panel created');
    return created;
  },

  async update(
    id: number,
    data: { title?: string; slug?: string; duration?: number; isActive?: boolean }
  ) {
    const panel = await prisma.panel.findUnique({ where: { id } });
    if (!panel) throw new NotFoundError('Panel not found');

    if (data.duration !== undefined && (!Number.isInteger(data.duration) || data.duration < 1)) throw new BadRequestError('Duration must be at least 1 minute');
    if (data.title !== undefined && !data.title.trim()) throw new BadRequestError('Title is required');
    if (data.slug !== undefined && !data.slug.trim()) throw new BadRequestError('Slug is required');
    if (data.slug && data.slug !== panel.slug) {
      const existing = await prisma.panel.findUnique({ where: { slug: data.slug } });
      if (existing) throw new ConflictError('A panel with this slug already exists');
    }

    const updated = await prisma.panel.update({
      where: { id },
      data: {
        title: data.title?.trim(),
        slug: data.slug?.trim(),
        duration: data.duration,
        isActive: data.isActive,
      },
      include: {
        position: { select: { id: true, title: true } },
        interviewers: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });
    void safeReindexPanelAndBookings(updated.id, 'panel updated');
    return updated;
  },

  async addInterviewer(panelId: number, userId: number) {
    const panel = await prisma.panel.findUnique({ where: { id: panelId } });
    if (!panel) throw new NotFoundError('Panel not found');

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true, role: true } });
    if (!user) throw new NotFoundError('User not found');
    if (user.role !== 'INTERVIEWER') throw new BadRequestError('Only interviewers can be assigned to a panel');

    const existing = await prisma.panelInterviewer.findUnique({
      where: { panelId_userId: { panelId, userId } },
    });
    if (existing) throw new ConflictError('Interviewer already on this panel');

    const created = await prisma.panelInterviewer.create({
      data: { panelId, userId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    await prisma.user.update({ where: { id: userId }, data: { aiAccessVersion: { increment: 1 } } });
    void safeReindexPanelAndBookings(panelId, 'panel interviewer added');
    return created;
  },

  async removeInterviewer(panelId: number, userId: number) {
    const entry = await prisma.panelInterviewer.findUnique({
      where: { panelId_userId: { panelId, userId } },
    });
    if (!entry) throw new NotFoundError('Interviewer not on this panel');

    await prisma.panelInterviewer.delete({
      where: { panelId_userId: { panelId, userId } },
    });
    await prisma.user.update({ where: { id: userId }, data: { aiAccessVersion: { increment: 1 } } });
    void safeReindexPanelAndBookings(panelId, 'panel interviewer removed');
    return { success: true };
  },
};
