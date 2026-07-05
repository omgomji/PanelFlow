/**
 * Auth Routes
 *
 * POST /api/auth/register  — create account (role always INTERVIEWER)
 * POST /api/auth/login     — verify credentials, set cookie
 * POST /api/auth/logout    — clear cookie
 * POST /api/auth/refresh   — get new access token using refresh token
 * GET  /api/auth/me        — return current user from JWT (requires auth)
 */
import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.post('/refresh', authController.refresh);
router.get('/me', requireAuth, authController.me);

export default router;
