/**
 * Panels Routes
 *
 * GET  /api/panels/my             — panels the current user is a member of (INTERVIEWER)
 * GET  /api/panels/:id            — panel detail
 * PUT  /api/panels/:id            — update panel (ADMIN only)
 * POST /api/panels/:id/interviewers        — add interviewer (ADMIN only)
 * DELETE /api/panels/:id/interviewers/:userId — remove interviewer (ADMIN only)
 */
import { Router } from 'express';
import { panelsController } from '../controllers/panels.controller';
import { requireRole } from '../middleware/auth';

const router = Router();

router.get('/my', panelsController.myPanels);
router.get('/:id', panelsController.getById);
router.put('/:id', requireRole('ADMIN'), panelsController.update);
router.post('/:id/interviewers', requireRole('ADMIN'), panelsController.addInterviewer);
router.delete('/:id/interviewers/:userId', requireRole('ADMIN'), panelsController.removeInterviewer);

export default router;
