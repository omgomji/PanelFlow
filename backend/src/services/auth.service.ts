/**
 * Auth Service
 *
 * Handles user registration and login business logic.
 *
 * Security notes:
 *   - register(): `role` is NEVER read from the input — it is always the
 *     schema default (INTERVIEWER). ADMIN accounts are created only via seed.ts.
 *   - login(): verifies bcrypt hash, signs JWT with { userId, role }.
 */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';
import crypto from 'crypto';
import { BadRequestError, ConflictError, UnauthorizedError } from '../utils/errors';

const SALT_ROUNDS = 12;

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET env var is not set');
  return secret;
}

export const authService = {
  /**
   * Register a new user.
   * The `role` field is explicitly omitted from the data shape — only the
   * schema default (INTERVIEWER) is ever applied. This prevents privilege
   * escalation via mass assignment even if a client sends role: "ADMIN".
   */
  async register(data: { name: string; email: string; password: string }) {
    const email = data.email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequestError('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

    // Derive a username from email (before @), append random suffix on collision
    const base = email.split('@')[0].replace(/[^a-z0-9]/g, '') || 'user';
    for (let attempt = 0; attempt < 10; attempt++) {
      const username = attempt === 0 ? base : `${base}${Math.floor(1000 + Math.random() * 9000)}`;
      try {
        return await prisma.user.create({
          data: { name: data.name, email, username, passwordHash },
          select: { id: true, name: true, email: true, role: true },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') continue;
        throw error;
      }
    }
    throw new ConflictError('Could not generate a unique username');
  },

  /**
   * Verify credentials and issue signed JWTs.
   * Returns accessToken and refreshToken strings — cookie setting is done in the controller
   * so the HTTP layer stays separate from business logic.
   */
  async login(email: string, password: string): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const payload = { userId: user.id, role: user.role, tokenVersion: user.tokenVersion };
    const accessToken = jwt.sign(payload, getJwtSecret(), { expiresIn: '15m' });
    const sessionId = crypto.randomUUID();
    const refreshToken = jwt.sign({ ...payload, sessionId, type: 'refresh' }, getJwtSecret(), {
      expiresIn: '6h',
    });
    await prisma.refreshSession.create({ data: { userId: user.id, tokenHash: crypto.createHash('sha256').update(refreshToken).digest('hex'), expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000) } });

    return { accessToken, refreshToken };
  },

  /**
   * Verify refresh token and issue a new access token.
   */
  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const payload = jwt.verify(refreshToken, getJwtSecret()) as { userId: number; role: 'ADMIN' | 'INTERVIEWER'; tokenVersion?: number; sessionId?: string; type?: string };
      
      if (payload.type !== 'refresh') {
        throw new UnauthorizedError('Invalid token type');
      }
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      const session = await prisma.refreshSession.findUnique({ where: { tokenHash } });
      if (!session || session.userId !== payload.userId || session.revokedAt || session.expiresAt <= new Date()) throw new UnauthorizedError('Refresh session is invalid');

      // We don't necessarily need to hit the DB again if we are completely stateless,
      // but to be safe and ensure the user still exists/hasn't changed roles drastically:
      const user = await prisma.user.findUnique({ where: { id: payload.userId } });
      if (!user || payload.tokenVersion !== user.tokenVersion) {
        throw new UnauthorizedError('User no longer exists');
      }

      const accessToken = jwt.sign(
        { userId: user.id, role: user.role, tokenVersion: user.tokenVersion },
        getJwtSecret(),
        { expiresIn: '15m' }
      );

      const newSessionId = crypto.randomUUID();
      const newRefreshToken = jwt.sign({ userId: user.id, role: user.role, tokenVersion: user.tokenVersion, sessionId: newSessionId, type: 'refresh' }, getJwtSecret(), { expiresIn: '6h' });
      await prisma.refreshSession.create({ data: { userId: user.id, tokenHash: crypto.createHash('sha256').update(newRefreshToken).digest('hex'), expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000), rotatedFrom: session.id } });
      await prisma.refreshSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });

      return { accessToken, refreshToken: newRefreshToken };
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }
  },

  async revokeRefreshToken(refreshToken: string) {
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await prisma.refreshSession.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: new Date() } });
  },

  /**
   * Return public-safe user fields by id (used by GET /api/auth/me).
   */
  async getMe(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, username: true, timezone: true },
    });
    return user;
  },
};
