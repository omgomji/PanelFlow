export function getConfirmationEmail(
  booking: any,
  hosts: any[]
): { subject: string; html: string } {
  const title = booking.panelId ? booking.panel?.position.title : booking.eventType?.title;
  const time = new Date(booking.startTime).toLocaleString('en-US', { timeZone: 'UTC' }); // Simplification for now

  return {
    subject: `Booking Confirmed: ${title} with ${booking.inviteeName}`,
    html: `
      <h2>Booking Confirmed</h2>
      <p>Hi,</p>
      <p>Your booking for <strong>${title}</strong> has been confirmed.</p>
      <p><strong>Time:</strong> ${time} UTC</p>
      <p><strong>Hosts:</strong> ${hosts.map(h => h.name).join(', ')}</p>
    `
  };
}

export function getCancellationEmail(
  booking: any,
  hosts: any[]
): { subject: string; html: string } {
  const title = booking.panelId ? booking.panel?.position.title : booking.eventType?.title;
  const time = new Date(booking.startTime).toLocaleString('en-US', { timeZone: 'UTC' });
  const reasonText = booking.cancellationReason ? `<p><strong>Reason:</strong> ${booking.cancellationReason}</p>` : '';

  return {
    subject: `Booking Cancelled: ${title} with ${booking.inviteeName}`,
    html: `
      <h2>Booking Cancelled</h2>
      <p>Hi,</p>
      <p>Your booking for <strong>${title}</strong> at ${time} UTC has been cancelled.</p>
      ${reasonText}
    `
  };
}

export function getRescheduleEmail(
  oldBooking: any,
  newBooking: any,
  hosts: any[]
): { subject: string; html: string } {
  const title = newBooking.panelId ? newBooking.panel?.position.title : newBooking.eventType?.title;
  const oldTime = new Date(oldBooking.startTime).toLocaleString('en-US', { timeZone: 'UTC' });
  const newTime = new Date(newBooking.startTime).toLocaleString('en-US', { timeZone: 'UTC' });

  return {
    subject: `Booking Rescheduled: ${title} with ${newBooking.inviteeName}`,
    html: `
      <h2>Booking Rescheduled</h2>
      <p>Hi,</p>
      <p>Your booking for <strong>${title}</strong> has been rescheduled.</p>
      <p><strong>Old Time:</strong> ${oldTime} UTC</p>
      <p><strong>New Time:</strong> ${newTime} UTC</p>
      <p><strong>Hosts:</strong> ${hosts.map(h => h.name).join(', ')}</p>
    `
  };
}

export function getReminderEmail(
  booking: any,
  hosts: any[]
): { subject: string; html: string } {
  const title = booking.panelId ? booking.panel?.position.title : booking.eventType?.title;
  const time = new Date(booking.startTime).toLocaleString('en-US', { timeZone: 'UTC' });

  return {
    subject: `Reminder: Upcoming Booking for ${title}`,
    html: `
      <h2>Booking Reminder</h2>
      <p>Hi,</p>
      <p>This is a reminder for your upcoming booking: <strong>${title}</strong>.</p>
      <p><strong>Time:</strong> ${time} UTC</p>
      <p><strong>Hosts:</strong> ${hosts.map(h => h.name).join(', ')}</p>
    `
  };
}
