/**
 * Users Routes
 *
 * GET /api/users?role=INTERVIEWER — list users by role (ADMIN only)
 * Used to populate the interviewer picker when building a panel.
 */
import { Router, Request, Response } from 'express';
import { requireRole, requireAuth } from '../middleware/auth';
import { prisma } from '../config/prisma';

const router = Router();

router.patch('/me', requireAuth, async (req: Request, res: Response) => {
  const { timezone } = req.body;
  if (!timezone) {
    return res.status(400).json({ error: 'timezone is required' });
  }

  const user = await prisma.user.update({
    where: { id: req.user!.id },
    data: { timezone },
    select: { id: true, name: true, email: true, role: true, username: true, timezone: true },
  });

  res.json({ user });
});

router.get('/', requireRole('ADMIN'), async (req: Request, res: Response) => {
  const role = req.query.role as string | undefined;

  const users = await prisma.user.findMany({
    where: role ? { role: role as 'ADMIN' | 'INTERVIEWER' } : undefined,
    select: { id: true, name: true, email: true, role: true, username: true },
    orderBy: { name: 'asc' },
  });

  res.json(users);
});

export default router;
