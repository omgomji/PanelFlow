/**
 * Contacts Controller
 *
 * Parses HTTP request data, validates basic inputs,
 * delegates business logic to the service layer.
 */
import { Request, Response } from 'express';
import { contactsService } from '../services/contacts.service';
import { BadRequestError } from '../utils/errors';

export const contactsController = {
  /** GET /api/contacts */
  async getAll(req: Request, res: Response) {
    const userId = req.user!.id;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 10));
    const result = await contactsService.findAllByUser(userId, page, limit);
    res.json(result);
  },

  /** POST /api/contacts */
  async create(req: Request, res: Response) {
    const userId = req.user!.id;
    const { name, email, phone, note } = req.body;

    if (!name || !email) {
      throw new BadRequestError('name and email are required');
    }

    const contact = await contactsService.create(userId, {
      name,
      email,
      phone,
      note,
    });

    res.status(201).json(contact);
  },

  /** PUT /api/contacts/:id */
  async update(req: Request, res: Response) {
    const userId = req.user!.id;
    const id = Number(req.params.id);
    const { name, email, phone, note } = req.body;

    if (isNaN(id)) {
      throw new BadRequestError('Invalid contact ID');
    }

    const contact = await contactsService.update(userId, id, {
      name,
      email,
      phone,
      note,
    });

    res.json(contact);
  },

  /** DELETE /api/contacts/:id */
  async remove(req: Request, res: Response) {
    const userId = req.user!.id;
    const id = Number(req.params.id);

    if (isNaN(id)) {
      throw new BadRequestError('Invalid contact ID');
    }

    const result = await contactsService.remove(userId, id);
    res.json(result);
  },
};
