/**
 * Event Types Controller
 *
 * Parses HTTP request data, validates inputs, calls the service layer,
 * and formats the HTTP response. No business logic lives here.
 */
import { Request, Response } from 'express';
import { eventTypesService } from '../services/eventTypes.service';
import { BadRequestError } from '../utils/errors';

export const eventTypesController = {
  /** GET /api/event-types */
  async getAll(req: Request, res: Response) {
    const userId = req.user!.id;
    const eventTypes = await eventTypesService.findAllByUser(userId);
    res.json(eventTypes);
  },

  /** POST /api/event-types */
  async create(req: Request, res: Response) {
    const userId = req.user!.id;
    const { title, slug, duration, description, isActive } = req.body;

    // Validation: required fields
    if (!title || !slug || duration == null) {
      throw new BadRequestError('title, slug, and duration are required');
    }

    const eventType = await eventTypesService.create(userId, {
      title,
      slug,
      duration,
      description,
      isActive,
    });
    res.status(201).json(eventType);
  },

  /** PUT /api/event-types/:id */
  async update(req: Request, res: Response) {
    const userId = req.user!.id;
    const id = Number(req.params.id);

    if (isNaN(id)) {
      throw new BadRequestError('Invalid event type ID');
    }

    const { title, slug, duration, description, isActive } = req.body;
    const eventType = await eventTypesService.update(userId, id, {
      title,
      slug,
      duration,
      description,
      isActive,
    });
    res.json(eventType);
  },

  /** DELETE /api/event-types/:id */
  async remove(req: Request, res: Response) {
    const userId = req.user!.id;
    const id = Number(req.params.id);

    if (isNaN(id)) {
      throw new BadRequestError('Invalid event type ID');
    }

    const result = await eventTypesService.remove(userId, id);
    res.json(result);
  },
};
