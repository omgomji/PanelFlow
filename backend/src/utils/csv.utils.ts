/**
 * CSV Utility
 *
 * Provides functions to generate CSV format strings.
 */

interface BookingRow {
  id: number;
  inviteeName: string;
  inviteeEmail: string;
  eventType?: { title?: string };
  panel?: { title?: string };
  status: string;
  startTime: Date | string;
  endTime: Date | string;
  createdAt: Date | string;
}

export function generateBookingsCsv(bookings: BookingRow[]): string {
  const header = [
    'id',
    'inviteeName',
    'inviteeEmail',
    'eventType',
    'status',
    'startTime',
    'endTime',
    'createdAt',
  ].join(',');

  const rows = bookings.map((booking) => {
    const values = [
      booking.id,
      booking.inviteeName,
      booking.inviteeEmail,
      booking.panel?.title ?? booking.eventType?.title ?? '',
      booking.status,
      booking.startTime instanceof Date ? booking.startTime.toISOString() : booking.startTime,
      booking.endTime instanceof Date ? booking.endTime.toISOString() : booking.endTime,
      booking.createdAt instanceof Date ? booking.createdAt.toISOString() : booking.createdAt,
    ];

    return values
      .map((value) => {
        const str = String(value ?? '');
        return `"${str.replace(/"/g, '""')}"`;
      })
      .join(',');
  });

  return [header, ...rows].join('\n');
}
