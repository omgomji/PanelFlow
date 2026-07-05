import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { requireRole } from '../middleware/auth';

const router = Router();

// Workload widget data
router.get('/workload', requireRole('ADMIN'), adminController.getWorkload);

export default router;
