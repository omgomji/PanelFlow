export const TOPICS = {
  BOOKING_EVENTS: 'panelflow.booking.events',
  FEEDBACK_EVENTS: 'panelflow.feedback.events',
} as const;

export type BookingEvent =
  | {
      type: 'BOOKING_CREATED';
      bookingId: number;
      uid: string;
      panelSlug?: string;
      hostUserIds: number[];
      inviteeName: string;
      inviteeEmail: string;
      startTime: string;
      endTime: string;
    }
  | {
      type: 'BOOKING_CANCELLED';
      bookingId: number;
      uid: string;
      reason?: string;
      hostUserIds: number[];
    }
  | {
      type: 'BOOKING_RESCHEDULED';
      oldBookingId: number;
      newBookingId: number;
      uid: string;
      hostUserIds: number[];
      newStartTime: string;
      newEndTime: string;
    };

