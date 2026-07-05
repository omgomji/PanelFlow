/**
 * Panels Service
 *
 * CRUD for interview panels within positions.
 * Includes add/remove-interviewer sub-routes.
 * Mirrors the validation style of eventTypes.service.ts.
 */
import { prisma } from '../config/prisma';
import { NotFoundError, BadRequestError, ConflictError } from '../utils/errors';

export const panelsService = {
  async findById(id: number) {
    const panel = await prisma.panel.findUnique({
      where: { id },
      include: {
        position: { select: { id: true, title: true } },
        interviewers: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    if (!panel) throw new NotFoundError('Panel not found');
    return panel;
  },

  async findBySlug(slug: string) {
    const panel = await prisma.panel.findUnique({
      where: { slug },
      include: {
        position: { select: { id: true, title: true } },
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
    if (!data.duration || data.duration < 1) {
      throw new BadRequestError('Duration must be at least 1 minute');
    }

    const position = await prisma.position.findUnique({ where: { id: positionId } });
    if (!position) throw new NotFoundError('Position not found');

    const existing = await prisma.panel.findUnique({ where: { slug: data.slug } });
    if (existing) throw new ConflictError('A panel with this slug already exists');

    return prisma.panel.create({
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
  },

  async update(
    id: number,
    data: { title?: string; slug?: string; duration?: number; isActive?: boolean }
  ) {
    const panel = await prisma.panel.findUnique({ where: { id } });
    if (!panel) throw new NotFoundError('Panel not found');

    if (data.slug && data.slug !== panel.slug) {
      const existing = await prisma.panel.findUnique({ where: { slug: data.slug } });
      if (existing) throw new ConflictError('A panel with this slug already exists');
    }

    return prisma.panel.update({
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
  },

  async addInterviewer(panelId: number, userId: number) {
    const panel = await prisma.panel.findUnique({ where: { id: panelId } });
    if (!panel) throw new NotFoundError('Panel not found');

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User not found');

    const existing = await prisma.panelInterviewer.findUnique({
      where: { panelId_userId: { panelId, userId } },
    });
    if (existing) throw new ConflictError('Interviewer already on this panel');

    return prisma.panelInterviewer.create({
      data: { panelId, userId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
  },

  async removeInterviewer(panelId: number, userId: number) {
    const entry = await prisma.panelInterviewer.findUnique({
      where: { panelId_userId: { panelId, userId } },
    });
    if (!entry) throw new NotFoundError('Interviewer not on this panel');

    await prisma.panelInterviewer.delete({
      where: { panelId_userId: { panelId, userId } },
    });
    return { success: true };
  },
};
