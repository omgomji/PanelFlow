export interface MeetingRecord {
  id: number;
  uid: string;
  startTime: string;
  endTime: string;
  status?: string;
  inviteeName?: string;
  inviteeEmail?: string;
  eventType?: {
    id?: number;
    title?: string;
    slug?: string;
    duration?: number;
  };
  panel?: {
    id: number;
    title: string;
    position?: {
      id: number;
      title: string;
    };
  };
  cancellationReason?: string | null;
  createdAt?: string;
}

export interface BookingPayload {
  inviteeName: string;
  inviteeEmail: string;
  startTime: string;
  notes?: string;
}

export interface CreatedBooking {
  id: number;
  uid: string;
  eventTypeId: number | null;
  userId: number | null;
  panelId?: number | null;
  durationMinutes: number;
  inviteeName: string;
  inviteeEmail: string;
  startTime: string;
  endTime: string;
  status: string;
  createdAt: string;
}
