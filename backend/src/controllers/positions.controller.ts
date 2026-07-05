import { Request, Response } from 'express';
import { positionsService } from '../services/positions.service';

export const positionsController = {
  async list(_req: Request, res: Response) {
    const positions = await positionsService.findAll();
    res.json(positions);
  },

  async getById(req: Request, res: Response) {
    const id = parseInt(String(req.params.id), 10);
    const position = await positionsService.findById(id);
    res.json(position);
  },

  async create(req: Request, res: Response) {
    const { title, description, status } = req.body as {
      title?: string;
      description?: string;
      status?: 'OPEN' | 'CLOSED';
    };
    const position = await positionsService.create(req.user!.id, { title: title ?? '', description, status });
    res.status(201).json(position);
  },

  async update(req: Request, res: Response) {
    const id = parseInt(String(req.params.id), 10);
    const { title, description, status } = req.body as {
      title?: string;
      description?: string;
      status?: 'OPEN' | 'CLOSED';
    };
    const position = await positionsService.update(id, { title, description, status });
    res.json(position);
  },

  async remove(req: Request, res: Response) {
    const id = parseInt(String(req.params.id), 10);
    await positionsService.remove(id);
    res.json({ success: true });
  },

  async getCandidates(req: Request, res: Response) {
    const id = parseInt(String(req.params.id), 10);
    const candidates = await positionsService.getCandidates(id);
    res.json(candidates);
  },
};
