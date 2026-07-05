/**
 * Positions Routes
 *
 * GET    /api/positions           — list all (admin view)
 * GET    /api/positions/:id       — position detail with panels
 * POST   /api/positions           — create (ADMIN only)
 * PUT    /api/positions/:id       — update (ADMIN only)
 * DELETE /api/positions/:id       — delete (ADMIN only)
 * POST   /api/positions/:positionId/panels — create a panel under a position (ADMIN only)
 */
import { Router } from 'express';
import { positionsController } from '../controllers/positions.controller';
import { panelsController } from '../controllers/panels.controller';
import { requireRole } from '../middleware/auth';

const router = Router();

router.get('/', positionsController.list);
router.get('/:id', positionsController.getById);
router.post('/', requireRole('ADMIN'), positionsController.create);
router.put('/:id', requireRole('ADMIN'), positionsController.update);
router.delete('/:id', requireRole('ADMIN'), positionsController.remove);

router.get('/:id/candidates', requireRole('ADMIN'), positionsController.getCandidates);

// Create a panel under a position
router.post('/:positionId/panels', requireRole('ADMIN'), panelsController.create);

export default router;
