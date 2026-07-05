export interface EventType {
  id: number;
  title: string;
  slug: string;
  duration: number;
  description?: string | null;
  bookingUrl?: string;
  isActive?: boolean;
}

export interface EventTypePayload {
  title: string;
  slug: string;
  duration: number;
  description?: string;
  isActive: boolean;
}
