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
}

export interface RescheduleDetailsResponse {
  booking: RescheduleBookingDetails;
  eventType: PublicEventTypeDetails;
  user: Required<Pick<PublicUser, 'name' | 'username' | 'timezone'>>;
}
