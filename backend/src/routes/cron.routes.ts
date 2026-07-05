import { Router, Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { emailService } from '../services/email.service';
import { getReminderEmail } from '../emails/templates';
import { UnauthorizedError } from '../utils/errors';

const router = Router();

router.post('/send-reminders', async (req: Request, res: Response) => {
  const secret = req.header('X-Cron-Secret');
  if (secret !== process.env.CRON_SECRET) {
    throw new UnauthorizedError('Invalid cron secret');
  }

  // 1000 is an arbitrary lock ID for the cron job
  const LOCK_ID = 1000;
  
  // Try to acquire an advisory lock. If another instance is running this, it will return false.
  const [{ locked }] = await prisma.$queryRaw<{ locked: boolean }[]>`
    SELECT pg_try_advisory_lock(${LOCK_ID}) as locked;
  `;

  if (!locked) {
    return res.json({ success: false, message: 'Cron already running in another instance' });
  }

  try {

  const now = new Date();
  const windowStart = new Date(now.getTime() + 23.5 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 24.5 * 60 * 60 * 1000);

  const upcomingBookings = await prisma.booking.findMany({
    where: {
      status: 'SCHEDULED',
      reminderSentAt: null,
      startTime: {
        gte: windowStart,
        lt: windowEnd
      }
    },
    include: {
      eventType: true,
      panel: { include: { position: true } }
    }
  });

  let count = 0;
  for (const booking of upcomingBookings) {
    const hosts = await prisma.bookingHost.findMany({
      where: { bookingId: booking.id },
      include: { user: true }
    });
    const hostUsers = hosts.map(h => h.user);
    
    const toEmails = [booking.inviteeEmail, ...hostUsers.map(h => h.email)];
    const { subject, html } = getReminderEmail(booking, hostUsers);

    // Fire and forget email
    emailService.sendEmail(toEmails, subject, html).catch(console.error);

    await prisma.booking.update({
      where: { id: booking.id },
      data: { reminderSentAt: new Date() }
    });
    count++;
  }

  res.json({ success: true, count });
  } finally {
    await prisma.$queryRaw`SELECT pg_advisory_unlock(${LOCK_ID});`;
  }
});

export default router;
