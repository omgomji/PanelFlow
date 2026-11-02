import { NextFunction, Request, Response } from 'express';
import { ForbiddenError } from '../utils/errors';
import { redis } from '../config/redis';
import { isAllowedFrontendOrigin } from '../config/origins';

const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(limit: number, windowMs: number) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const principal = req.user?.id ? `user:${req.user.id}` : `ip:${req.ip}`;
    const key = `ratelimit:${req.baseUrl || ''}${req.path}:${principal}`;

    if (redis.isConnected) {
      try {
        const count = await redis.incr(key);
        // Always (re)set the TTL so keys expire cleanly after the window
        await redis.pexpire(key, windowMs);
        if (count && count > limit) {
          return res.status(429).json({ error: 'Too many requests' });
        }
        return next();
      } catch {
        // Fallback to local map if Redis operation errors
      }
    }

    const now = Date.now();
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    bucket.count++;
    if (bucket.count > limit) return res.status(429).json({ error: 'Too many requests' });
    next();
  };
}

export function csrfOriginProtection(req: Request, _res: Response, next: NextFunction) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) || !req.cookies?.accessToken) return next();
  const origin = req.header('origin');
  if (!origin || !isAllowedFrontendOrigin(origin)) return next(new ForbiddenError('Invalid request origin'));
  next();
}
