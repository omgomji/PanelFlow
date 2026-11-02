import { Router, Request, Response } from 'express';
import { getPrimaryFrontendOrigin } from '../config/origins';

const router = Router();
const clients = new Set<Response>();

export function broadcastSlotChange(panelSlug?: string, date?: string) {
  const payload = JSON.stringify({
    type: 'SLOTS_UPDATED',
    panelSlug: panelSlug || null,
    date: date || null,
    timestamp: Date.now(),
  });

  for (const client of clients) {
    try {
      client.write(`data: ${payload}\n\n`);
    } catch {
      clients.delete(client);
    }
  }
}

router.get('/slots/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', getPrimaryFrontendOrigin());
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.flushHeaders();

  // Send an initial heartbeat
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: Date.now() })}\n\n`);
  clients.add(res);

  req.on('close', () => {
    clients.delete(res);
  });
});

export default router;
