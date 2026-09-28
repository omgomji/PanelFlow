import { Router } from 'express';
import { aiController } from '../ai/controller';
import { requireRole } from '../middleware/auth';
import { rateLimit } from '../middleware/security';

const router = Router();

router.post('/chat', rateLimit(30, 15 * 60 * 1000), aiController.chat);
router.post('/index/rebuild', requireRole('ADMIN'), rateLimit(5, 15 * 60 * 1000), aiController.rebuildIndex);

export default router;
