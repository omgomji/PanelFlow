import { Resend } from 'resend';
import { BookingEvent } from '../events/types';
import { prisma } from '../config/prisma';
import { generateBookingIcs } from '../utils/calendar.utils';
import { recordEventProcessingError } from '../controllers/admin.controller';

const apiKey = process.env.RESEND_API_KEY;
const resend = apiKey ? new Resend(apiKey) : null;
const fromEmail = process.env.EMAIL_FROM || 'PanelFlow <interviews@example.com>';

export const emailService = {
  /**
   * Send an invitation email to a new team member.
   */
  async sendInvitationEmail({
    email,
    role,
    inviteUrl,
    inviterName,
  }: {
    email: string;
    role: 'ADMIN' | 'INTERVIEWER';
    inviteUrl: string;
    inviterName?: string;
  }) {
    if (!resend) {
      console.info('[Email] (Dev Stub) Invitation email would be sent to:', email, {
        role,
        inviteUrl,
      });
      return;
    }

    await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: `You're invited to join PanelFlow as a ${role}`,
      html: `
        <div style="font-family: sans-serif; line-height: 1.6; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">You&rsquo;re invited to PanelFlow</h2>
          <p>${inviterName || 'A team member'} has invited you to join PanelFlow as a <strong>${role}</strong>.</p>
          <p>Click the link below to set up your account and start scheduling interviews:</p>
          <p>
            <a href="${inviteUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Accept Invitation
            </a>
          </p>
          <p style="color: #666; font-size: 13px;">
            This invitation expires in 48 hours. If you didn&rsquo;t expect this invite, you can safely ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #999; font-size: 12px;">PanelFlow &mdash; Interview Scheduling Platform</p>
        </div>
      `,
    });
  },
  async sendBookingConfirmation(event: Extract<BookingEvent, { type: 'BOOKING_CREATED' }>) {
    try {
      const booking = await prisma.booking.findUnique({
        where: { id: event.bookingId },
        include: {
          hosts: { include: { user: true } },
          panel: { include: { position: true } },
          eventType: true,
        },
      });
      if (!booking) return;

      const title = booking.panel?.title || booking.eventType?.title || 'Scheduled Interview';
      const positionTitle = booking.panel?.position?.title || 'Interview';
      const icsString = generateBookingIcs({
        uid: booking.uid,
        title,
        description: `PanelFlow Interview for ${positionTitle} with ${booking.inviteeName}`,
        startTime: booking.startTime,
        endTime: booking.endTime,
        organizerName: 'PanelFlow Team',
        organizerEmail: 'no-reply@panelflow.com',
        attendeeName: booking.inviteeName,
        attendeeEmail: booking.inviteeEmail,
      });

      if (!resend) {
        console.info('[Email] (Dev Stub) Booking confirmation would be sent to:', booking.inviteeEmail, {
          title,
          time: booking.startTime.toISOString(),
        });
        return;
      }

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const rescheduleUrl = `${frontendUrl}/reschedule/${booking.uid}`;

      // 1. Email Candidate
      await resend.emails.send({
        from: fromEmail,
        to: booking.inviteeEmail,
        subject: `Confirmed: ${title} on ${booking.startTime.toUTCString()}`,
        html: `
          <div style="font-family: sans-serif; line-height: 1.5;">
            <h2>Your interview is confirmed!</h2>
            <p><strong>Title:</strong> ${title}</p>
            <p><strong>Position:</strong> ${positionTitle}</p>
            <p><strong>Time:</strong> ${booking.startTime.toUTCString()} - ${booking.endTime.toUTCString()}</p>
            <p><a href="${rescheduleUrl}" style="display: inline-block; padding: 10px 18px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px;">Reschedule or Cancel</a></p>
            <p style="color: #666; font-size: 13px;">An .ics calendar invitation is attached to this email.</p>
          </div>
        `,
        attachments: [
          {
            filename: 'invite.ics',
            content: Buffer.from(icsString).toString('base64'),
          },
        ],
      });

      // 2. Email Host(s)
      const hostEmails = booking.hosts.map((h) => h.user.email).filter(Boolean);
      if (hostEmails.length) {
        await resend.emails.send({
          from: fromEmail,
          to: hostEmails,
          subject: `New Interview Scheduled: ${booking.inviteeName} (${title})`,
          html: `
            <div style="font-family: sans-serif; line-height: 1.5;">
              <h3>A new interview has been booked</h3>
              <p><strong>Candidate:</strong> ${booking.inviteeName} (${booking.inviteeEmail})</p>
              <p><strong>Title:</strong> ${title}</p>
              <p><strong>Time:</strong> ${booking.startTime.toUTCString()} - ${booking.endTime.toUTCString()}</p>
            </div>
          `,
          attachments: [
            {
              filename: 'invite.ics',
              content: Buffer.from(icsString).toString('base64'),
            },
          ],
        });
      }
    } catch (err) {
      const errorMessage = (err as Error).message;
      console.error('[Email] Failed to send confirmation email:', errorMessage);
      recordEventProcessingError(`Email delivery failed: ${errorMessage}`);
    }
  },

  async sendBookingCancellation(event: Extract<BookingEvent, { type: 'BOOKING_CANCELLED' }>) {
    try {
      const booking = await prisma.booking.findUnique({
        where: { id: event.bookingId },
        include: { hosts: { include: { user: true } }, panel: true, eventType: true },
      });
      if (!booking) return;

      const title = booking.panel?.title || booking.eventType?.title || 'Interview';

      if (!resend) {
        console.info('[Email] (Dev Stub) Cancellation notice would be sent to:', booking.inviteeEmail);
        return;
      }

      await resend.emails.send({
        from: fromEmail,
        to: [booking.inviteeEmail, ...booking.hosts.map((h) => h.user.email)],
        subject: `Cancelled: ${title} (${booking.inviteeName})`,
        html: `
          <div style="font-family: sans-serif; line-height: 1.5;">
            <h3>Interview Cancelled</h3>
            <p>The interview <strong>${title}</strong> scheduled for ${booking.startTime.toUTCString()} has been cancelled.</p>
            ${event.reason ? `<p><strong>Reason:</strong> ${event.reason}</p>` : ''}
          </div>
        `,
      });
    } catch (err) {
      const errorMessage = (err as Error).message;
      console.error('[Email] Failed to send cancellation email:', errorMessage);
      recordEventProcessingError(`Email delivery failed: ${errorMessage}`);
    }
  },

  async sendBookingRescheduled(event: Extract<BookingEvent, { type: 'BOOKING_RESCHEDULED' }>) {
    try {
      const booking = await prisma.booking.findUnique({
        where: { id: event.newBookingId },
        include: { hosts: { include: { user: true } }, panel: true, eventType: true },
      });
      if (!booking) return;

      const title = booking.panel?.title || booking.eventType?.title || 'Interview';

      if (!resend) {
        console.info('[Email] (Dev Stub) Reschedule notice would be sent to:', booking.inviteeEmail);
        return;
      }

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const rescheduleUrl = `${frontendUrl}/reschedule/${booking.uid}`;

      await resend.emails.send({
        from: fromEmail,
        to: [booking.inviteeEmail, ...booking.hosts.map((h) => h.user.email)],
        subject: `Rescheduled: ${title} (${booking.inviteeName})`,
        html: `
          <div style="font-family: sans-serif; line-height: 1.5;">
            <h3>Interview Rescheduled</h3>
            <p>The interview <strong>${title}</strong> has been rescheduled to a new time:</p>
            <p><strong>New Time:</strong> ${booking.startTime.toUTCString()} - ${booking.endTime.toUTCString()}</p>
            <p><a href="${rescheduleUrl}">View or update booking</a></p>
          </div>
        `,
      });
    } catch (err) {
      const errorMessage = (err as Error).message;
      console.error('[Email] Failed to send reschedule email:', errorMessage);
      recordEventProcessingError(`Email delivery failed: ${errorMessage}`);
    }
  },
};

