import { Request, Response } from 'express';
import { panelsService } from '../services/panels.service';
import { BadRequestError } from '../utils/errors';

export const panelsController = {
  async getById(req: Request, res: Response) {
    const id = parseInt(String(req.params.id), 10);
    const panel = await panelsService.findById(id);
    res.json(panel);
  },

  async myPanels(req: Request, res: Response) {
    const panels = await panelsService.findByUser(req.user!.id);
    res.json(panels);
  },

  async create(req: Request, res: Response) {
    const positionId = parseInt(String(req.params.positionId), 10);
    const { title, slug, duration, interviewerIds } = req.body as {
      title?: string;
      slug?: string;
      duration?: number;
      interviewerIds?: number[];
    };

    if (!title || !slug || !duration) {
      throw new BadRequestError('title, slug, and duration are required');
    }

    const panel = await panelsService.create(positionId, { title, slug, duration, interviewerIds });
    res.status(201).json(panel);
  },

  async update(req: Request, res: Response) {
    const id = parseInt(String(req.params.id), 10);
    const { title, slug, duration, isActive } = req.body as {
      title?: string;
      slug?: string;
      duration?: number;
      isActive?: boolean;
    };
    const panel = await panelsService.update(id, { title, slug, duration, isActive });
    res.json(panel);
  },

  async addInterviewer(req: Request, res: Response) {
    const panelId = parseInt(String(req.params.id), 10);
    const { userId } = req.body as { userId?: number };
    if (!userId) throw new BadRequestError('userId is required');

    const result = await panelsService.addInterviewer(panelId, userId);
    res.status(201).json(result);
  },

  async removeInterviewer(req: Request, res: Response) {
    const panelId = parseInt(String(req.params.id), 10);
    const userId = parseInt(String(req.params.userId), 10);
    await panelsService.removeInterviewer(panelId, userId);
    res.json({ success: true });
  },
};
