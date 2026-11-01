import { Router } from 'express';
import { adminController } from '../controllers/admin.controller';
import { requireRole } from '../middleware/auth';

const router = Router();

// Users & Invitations
router.get('/users', requireRole('ADMIN'), adminController.getUsers);
router.get('/workload', requireRole('ADMIN'), adminController.getWorkload);
router.get('/calibration', requireRole('ADMIN'), adminController.getCalibration);
router.get('/feedback-completion', requireRole('ADMIN'), adminController.getFeedbackCompletion);
router.get('/candidates', requireRole('ADMIN'), adminController.getCandidatesByPosition);

// System status
router.get('/system-status', requireRole('ADMIN'), adminController.getSystemStatus);

export default router;
