import type { EventType } from '@/types/event-types';

export interface PublicUser {
  name: string;
  username?: string;
  timezone?: string;
}

export interface PublicEventTypeDetails {
  id: number;
  title: string;
  slug: string;
  duration: number;
  description: string;
}

export interface PublicEventData {
  user: PublicUser;
  eventType: PublicEventTypeDetails;
}

export interface PublicProfileData {
  user: Required<Pick<PublicUser, 'name' | 'username' | 'timezone'>>;
  eventTypes: EventType[];
}

export interface PublicSlotItem {
  time: string;
}

export interface RescheduleBookingDetails {
  uid: string;
  inviteeName: string;
  inviteeEmail: string;
  startTime: string;
  endTime: string;
  status: string;
  durationMinutes?: number;
}

export interface RescheduleDetailsResponse {
  kind: 'individual' | 'panel';
  booking: RescheduleBookingDetails;
  eventType?: PublicEventTypeDetails;
  user?: Required<Pick<PublicUser, 'name' | 'username' | 'timezone'>>;
  panel?: { title: string; slug: string; duration: number; position?: { title: string }; interviewers?: { name: string }[] };
}

// ── Candidate Portal Types ──
export interface PortalInterviewer {
  id: number;
  name: string;
  email?: string;
}

export interface PortalRound {
  bookingId: number;
  panelTitle: string;
  positionTitle: string;
  startTime: string;
  endTime: string;
  status: string;
  durationMinutes: number;
  interviewers: PortalInterviewer[];
}

export interface PortalPreparation {
  notes?: string;
  checklist?: string[];
}

export interface PortalNotification {
  emailSent: boolean;
  emailAt?: string;
  icsDownloaded: boolean;
}

export interface CandidatePortalResponse {
  uid: string;
  inviteeName: string;
  inviteeEmail: string;
  status: 'SCHEDULED' | 'RESCHEDULED' | 'CANCELLED' | 'EXPIRED' | 'NOT_FOUND';
  timezone: string;
  currentDateTime: string; // ISO string of now
  rounds: PortalRound[];
  preparation?: PortalPreparation;
  notification?: PortalNotification;
  canReschedule: boolean;
  canCancel: boolean;
  cancelReason?: string;
  panel?: {
    title: string;
    slug: string;
    position?: { title: string };
    interviewers: PortalInterviewer[];
  };
  eventType?: PublicEventTypeDetails;
  host?: {
    name: string;
    username?: string;
  };
}