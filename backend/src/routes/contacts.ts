/**
 * Contacts Routes (Admin Dashboard)
 *
 * GET    /             -> list contacts for logged-in user
 * POST   /             -> create a contact
 * PUT    /:id          -> update a contact
 * DELETE /:id          -> delete a contact
 *
 * Protected by adminAuth middleware (applied at mount point in index.ts).
 */
import { Router } from 'express';
import { contactsController } from '../controllers/contacts.controller';

const router = Router();

router.get('/', contactsController.getAll);
router.post('/', contactsController.create);
router.put('/:id', contactsController.update);
router.delete('/:id', contactsController.remove);

export default router;
