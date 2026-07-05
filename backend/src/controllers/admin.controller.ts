import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';

export const adminController = {
  // GET /api/admin/workload?days=30
  async getWorkload(req: Request, res: Response, next: NextFunction) {
    try {
      const days = parseInt(req.query.days as string, 10) || 30;
      
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Group BookingHost rows by userId where status is not CANCELLED
      const hosts = await prisma.bookingHost.groupBy({
        by: ['userId'],
        where: {
          startTime: { gte: startDate },
          status: { not: 'CANCELLED' }
        },
        _count: {
          _all: true
        }
      });

      // We need user names, so let's fetch users
      const users = await prisma.user.findMany({
        where: { role: 'INTERVIEWER' },
        select: { id: true, name: true }
      });

      const workload = users.map(u => {
        const hostRecord = hosts.find(h => h.userId === u.id);
        return {
          userId: u.id,
          name: u.name,
          interviewCount: hostRecord ? hostRecord._count._all : 0
        };
      });

      // Sort by interviewCount descending
      workload.sort((a, b) => b.interviewCount - a.interviewCount);

      res.json(workload);
    } catch (error) {
      next(error);
    }
  }
};
