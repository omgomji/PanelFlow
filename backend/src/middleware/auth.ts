/**
 * Auth Middleware
 *
 * requireAuth: Decodes JWT from the httpOnly cookie, attaches req.user = { id, role }.
 *   - Express is the sole authority for JWT signature verification.
 *   - No DB round-trip — the payload carries everything needed for authorization.
 *
 * requireRole(role): Guards a route to a specific role. Must be used AFTER requireAuth.
 *   - Reads req.user.role — no DB call needed.
 */
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedError, ForbiddenError } from '../utils/errors';
import { prisma } from '../config/prisma';
import { redis } from '../config/redis';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET env var is not set');
  return secret;
}

interface JwtPayload {
  userId: number;
  role: 'ADMIN' | 'INTERVIEWER';
  tokenVersion?: number;
}

export const requireAuth = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  const token = req.cookies?.accessToken as string | undefined;

  if (!token) {
    return next(new UnauthorizedError('Authentication required'));
  }

  try {
    const payload = jwt.verify(token, getJwtSecret()) as JwtPayload;
    const cacheKey = `user:session:${payload.userId}`;

    let userData: { role: 'ADMIN' | 'INTERVIEWER'; tokenVersion: number } | null = null;
    const cached = await redis.get(cacheKey);

    if (cached) {
      try {
        userData = JSON.parse(cached);
      } catch {
        userData = null;
      }
    }

    if (!userData) {
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { role: true, tokenVersion: true },
      });
      if (!user) return next(new UnauthorizedError('Session has been revoked'));
      userData = user;
      await redis.set(cacheKey, JSON.stringify(userData), 'EX', 300);
    }

    if (userData.tokenVersion !== payload.tokenVersion) {
      return next(new UnauthorizedError('Session has been revoked'));
    }

    req.user = { id: payload.userId, role: userData.role };
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired token'));
  }
};

/**
 * requireRole — returns a middleware that enforces a minimum role.
 * Known limitation: role changes in the DB require a new login to take effect
 * (JWT is stateless; see README Known Limitations).
 */
export const requireRole = (role: 'ADMIN' | 'INTERVIEWER') => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required'));
    }
    const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { role: true } });
    if (user?.role !== role) {
      return next(new ForbiddenError(`This action requires ${role} role`));
    }
    next();
  };
};
