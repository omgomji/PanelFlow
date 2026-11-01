/**
 * Invitation Service
 *
 * Handles admin invitations for team members. Invitations are JWT-signed
 * tokens stored in the Invitation table for revocation/resend tracking.
 */
import { prisma } from '../config/prisma';
import jwt from 'jsonwebtoken';
import {
  NotFoundError,
  BadRequestError,
  ConflictError,
} from '../utils/errors';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET env var is not set');
  return secret;
}

export const invitationService = {
  /**
   * Create a new invitation for an email + role.
   * Revokes any existing unexpired invitation for the same email.
   */
  async create(data: {
    email: string;
    role: 'ADMIN' | 'INTERVIEWER';
    createdBy?: number;
  }) {
    const email = data.email.toLowerCase().trim();

    // Revoke ALL existing invitations for this email (used, expired, or active)
    // so the unique email constraint isn't violated when creating a new one.
    await prisma.invitation.updateMany({
      where: { email },
      data: { usedAt: new Date() },
    });

    const token = jwt.sign(
      { email, role: data.role, type: 'invitation' },
      getJwtSecret(),
      { expiresIn: '48h' }
    );
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const invitation = await prisma.invitation.create({
      data: {
        email,
        role: data.role,
        token,
        expiresAt,
        createdBy: data.createdBy,
      },
      include: { createdByUser: { select: { id: true, name: true, email: true } } },
    });

    return invitation;
  },

  /**
   * List all invitations (with optional filter for active/used).
   */
  async list({ activeOnly = false }: { activeOnly?: boolean } = {}) {
    const where: Record<string, unknown> = {};
    if (activeOnly) {
      where.usedAt = null;
      where.expiresAt = { gt: new Date() };
    }

    return prisma.invitation.findMany({
      where,
      include: { createdByUser: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Revoke (mark used) an invitation by ID.
   */
  async revoke(id: number) {
    const invitation = await prisma.invitation.findUnique({ where: { id } });
    if (!invitation) throw new NotFoundError('Invitation not found');

    return prisma.invitation.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  },

  /**
   * Resend (renew) an invitation by ID — generates a new token + expiry.
   */
  async resend(id: number) {
    const invitation = await prisma.invitation.findUnique({ where: { id } });
    if (!invitation) throw new NotFoundError('Invitation not found');

    // Revoke any other active invitations for this email
    await prisma.invitation.updateMany({
      where: {
        email: invitation.email,
        id: { not: id },
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() },
    });

    const token = jwt.sign(
      { email: invitation.email, role: invitation.role, type: 'invitation' },
      getJwtSecret(),
      { expiresIn: '48h' }
    );
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    return prisma.invitation.update({
      where: { id },
      data: { token, expiresAt, usedAt: null },
      include: { createdByUser: { select: { id: true, name: true, email: true } } },
    });
  },

  /**
   * Validate an invitation token (used during registration).
   * Returns { email, role } if valid, throws otherwise.
   */
  async validate(token: string) {
    let payload: { email: string; role: 'ADMIN' | 'INTERVIEWER'; type: string };
    try {
      payload = jwt.verify(token, getJwtSecret()) as {
        email: string;
        role: 'ADMIN' | 'INTERVIEWER';
        type: string;
      };
    } catch {
      throw new BadRequestError('Invalid or expired invitation token');
    }

    if (payload.type !== 'invitation') {
      throw new BadRequestError('Invalid invitation token type');
    }

    const invitation = await prisma.invitation.findUnique({
      where: { token },
    });
    if (!invitation) {
      throw new BadRequestError('Invitation token not found');
    }
    if (invitation.usedAt) {
      throw new BadRequestError('Invitation token has already been used');
    }
    if (invitation.expiresAt <= new Date()) {
      throw new BadRequestError('Invitation token has expired');
    }
    if (invitation.email.toLowerCase() !== payload.email.toLowerCase()) {
      throw new BadRequestError('Invitation token does not match this email address');
    }

    return { email: invitation.email, role: invitation.role };
  },
};
