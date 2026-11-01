/**
 * Invitation Routes
 *
 * POST   /api/admin/invitations        — create invitation (ADMIN only)
 * GET    /api/admin/invitations        — list invitations (ADMIN only)
 * DELETE /api/admin/invitations/:id    — revoke invitation (ADMIN only)
 * POST   /api/admin/invitations/:id/resend — resend invitation (ADMIN only)
 */
import { Router } from 'express';
import { invitationController } from '../controllers/invitation.controller';
import { requireRole } from '../middleware/auth';

const router = Router();

router.post('/', requireRole('ADMIN'), invitationController.create);
router.get('/', requireRole('ADMIN'), invitationController.list);
router.delete('/:id', requireRole('ADMIN'), invitationController.revoke);
router.post('/:id/resend', requireRole('ADMIN'), invitationController.resend);

export default router;
