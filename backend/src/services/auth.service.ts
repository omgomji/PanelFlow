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
import { BadRequestError, UnauthorizedError } from '../utils/errors';

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
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      throw new BadRequestError('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

    // Derive a username from email (before @), append random suffix on collision
    const base = data.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    let username = base || 'user';

    // Check uniqueness; append random digits if taken
    const taken = await prisma.user.findUnique({ where: { username } });
    if (taken) {
      username = `${username}${Math.floor(1000 + Math.random() * 9000)}`;
    }

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        username,
        passwordHash,
        // role intentionally not set here — defaults to INTERVIEWER in schema
      },
      select: { id: true, name: true, email: true, role: true },
    });

    return user;
  },

  /**
   * Verify credentials and issue signed JWTs.
   * Returns accessToken and refreshToken strings — cookie setting is done in the controller
   * so the HTTP layer stays separate from business logic.
   */
  async login(email: string, password: string): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const accessToken = jwt.sign(
      { userId: user.id, role: user.role },
      getJwtSecret(),
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id, role: user.role, type: 'refresh' },
      getJwtSecret(),
      { expiresIn: '7d' }
    );

    return { accessToken, refreshToken };
  },

  /**
   * Verify refresh token and issue a new access token.
   */
  async refresh(refreshToken: string): Promise<{ accessToken: string }> {
    try {
      const payload = jwt.verify(refreshToken, getJwtSecret()) as { userId: number; role: 'ADMIN' | 'INTERVIEWER'; type?: string };
      
      if (payload.type !== 'refresh') {
        throw new UnauthorizedError('Invalid token type');
      }

      // We don't necessarily need to hit the DB again if we are completely stateless,
      // but to be safe and ensure the user still exists/hasn't changed roles drastically:
      const user = await prisma.user.findUnique({ where: { id: payload.userId } });
      if (!user) {
        throw new UnauthorizedError('User no longer exists');
      }

      const accessToken = jwt.sign(
        { userId: user.id, role: user.role },
        getJwtSecret(),
        { expiresIn: '15m' }
      );

      return { accessToken };
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }
  },

  /**
   * Return public-safe user fields by id (used by GET /api/auth/me).
   */
  async getMe(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true },
    });
    return user;
  },
};
