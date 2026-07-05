import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 'dummy-key');

export const emailService = {
  async sendEmail(to: string[], subject: string, html: string): Promise<void> {
    try {
      if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL) {
        console.log('Skipping email send because RESEND_API_KEY or RESEND_FROM_EMAIL is missing');
        console.log('Email to', to, 'Subject:', subject);
        return;
      }
      
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL,
        to,
        subject,
        html,
      });
    } catch (err) {
      console.error('Email send failed', { to, subject, err });
    }
  }
};
