/**
 * Invitation Controller
 *
 * POST   /api/admin/invitations        — create invitation
 * GET    /api/admin/invitations        — list invitations
 * DELETE /api/admin/invitations/:id    — revoke invitation
 * POST   /api/admin/invitations/:id/resend — resend invitation
 */
import { Request, Response, NextFunction } from 'express';
import { invitationService } from '../services/invitation.service';
import { emailService } from '../services/email.service';
import { BadRequestError } from '../utils/errors';
import { prisma } from '../config/prisma';

export const invitationController = {
  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, role } = req.body as {
        email?: string;
        role?: 'ADMIN' | 'INTERVIEWER';
      };

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new BadRequestError('A valid email address is required');
      }
      if (role && role !== 'ADMIN' && role !== 'INTERVIEWER') {
        throw new BadRequestError('Role must be ADMIN or INTERVIEWER');
      }

      const invitation = await invitationService.create({
        email,
        role: role ?? 'INTERVIEWER',
        createdBy: req.user?.id,
      });

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const inviteUrl = `${frontendUrl}/register?token=${invitation.token}&email=${encodeURIComponent(invitation.email)}`;

      // Fetch inviter name for the email (non-blocking)
      let inviterName: string | undefined;
      if (req.user?.id) {
        const inviter = await prisma.user.findUnique({
          where: { id: req.user.id },
          select: { name: true },
        });
        inviterName = inviter?.name;
      }

      // Send invitation email (non-blocking — don't fail the invite if email fails)
      void emailService.sendInvitationEmail({
        email: invitation.email,
        role: invitation.role,
        inviteUrl,
        inviterName,
      }).catch((err) => {
        console.error('[Email] Failed to send invitation email:', err);
      });

      res.status(201).json({
        message: 'Invitation sent',
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        inviteUrl,
        expiresAt: invitation.expiresAt,
      });
    } catch (error) {
      next(error);
    }
  },

  async list(req: Request, res: Response, next: NextFunction) {
    try {
      const { active } = req.query as { active?: 'true' | 'false' };
      const invitations = await invitationService.list({
        activeOnly: active === 'true',
      });

      res.json(
        invitations.map((inv) => ({
          id: inv.id,
          email: inv.email,
          role: inv.role,
          expiresAt: inv.expiresAt,
          usedAt: inv.usedAt,
          createdAt: inv.createdAt,
          createdBy: inv.createdByUser
            ? { id: inv.createdByUser.id, name: inv.createdByUser.name, email: inv.createdByUser.email }
            : null,
          isActive: !inv.usedAt && inv.expiresAt > new Date(),
        }))
      );
    } catch (error) {
      next(error);
    }
  },

  async revoke(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(String(req.params.id), 10);
      await invitationService.revoke(id);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  },

  async resend(req: Request, res: Response, next: NextFunction) {
    try {
      const id = parseInt(String(req.params.id), 10);
      const invitation = await invitationService.resend(id);

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const inviteUrl = `${frontendUrl}/register?token=${invitation.token}&email=${encodeURIComponent(invitation.email)}`;

      // Fetch inviter name for the email (non-blocking)
      let inviterName: string | undefined;
      if (req.user?.id) {
        const inviter = await prisma.user.findUnique({
          where: { id: req.user.id },
          select: { name: true },
        });
        inviterName = inviter?.name;
      }

      // Send invitation email (non-blocking)
      void emailService.sendInvitationEmail({
        email: invitation.email,
        role: invitation.role,
        inviteUrl,
        inviterName,
      }).catch((err) => {
        console.error('[Email] Failed to send invitation email:', err);
      });

      res.json({
        message: 'Invitation resent',
        id: invitation.id,
        token: invitation.token,
        inviteUrl,
        expiresAt: invitation.expiresAt,
      });
    } catch (error) {
      next(error);
    }
  },
};
