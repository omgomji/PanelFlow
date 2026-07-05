import { Router, Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { UnauthorizedError, NotFoundError } from '../utils/errors';
import crypto from 'crypto';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const user = req.user!;
  if (user.role !== 'ADMIN') throw new UnauthorizedError('Admin only');
  
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' }
  });
  
  // Return without secret
  res.json(endpoints.map(({ secret, ...rest }) => rest));
});

router.post('/', async (req: Request, res: Response) => {
  const user = req.user!;
  if (user.role !== 'ADMIN') throw new UnauthorizedError('Admin only');
  
  const { url, events } = req.body;
  const secret = 'whsec_' + crypto.randomBytes(32).toString('hex');
  
  const endpoint = await prisma.webhookEndpoint.create({
    data: {
      userId: user.id,
      url,
      events,
      secret
    }
  });
  
  res.status(201).json(endpoint); // Only time secret is returned
});

router.delete('/:id', async (req: Request, res: Response) => {
  const user = req.user!;
  if (user.role !== 'ADMIN') throw new UnauthorizedError('Admin only');
  
  const id = Number(req.params.id);
  const endpoint = await prisma.webhookEndpoint.findUnique({ where: { id } });
  
  if (!endpoint || endpoint.userId !== user.id) throw new NotFoundError('Endpoint not found');
  
  // Delete all deliveries first (or use cascade in Prisma, but let's do it manually just in case)
  await prisma.webhookDelivery.deleteMany({ where: { endpointId: id } });
  await prisma.webhookEndpoint.delete({ where: { id } });
  res.json({ success: true });
});

router.get('/:id/deliveries', async (req: Request, res: Response) => {
  const user = req.user!;
  if (user.role !== 'ADMIN') throw new UnauthorizedError('Admin only');
  
  const id = Number(req.params.id);
  const endpoint = await prisma.webhookEndpoint.findUnique({ where: { id } });
  
  if (!endpoint || endpoint.userId !== user.id) throw new NotFoundError('Endpoint not found');
  
  const deliveries = await prisma.webhookDelivery.findMany({
    where: { endpointId: id },
    orderBy: { createdAt: 'desc' },
    take: 50
  });
  
  res.json(deliveries);
});

export default router;
