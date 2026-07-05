import axios from 'axios';
import type { AvailabilityPayload, AvailabilitySchedule } from '@/types/availability';
import type { BookingPayload, CreatedBooking, MeetingRecord } from '@/types/booking';
import type { EventType, EventTypePayload } from '@/types/event-types';
import type { PublicEventData, PublicProfileData, PublicSlotItem, RescheduleDetailsResponse } from '@/types/public';
import type { Contact, ContactPayload } from '@/types/contact';

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

const resolveApiBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;

  if (typeof window !== 'undefined') {
    return `http://${window.location.hostname}:5000/api`;
  }

  return 'http://localhost:5000/api';
};

const api = axios.create({
  baseURL: resolveApiBaseUrl(),
  // Required for cross-origin cookies (Vercel frontend ↔ Render backend).
  // Without this Axios does not send cookies even if the browser has them.
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If the error is 401 and we haven't retried yet, and it's not a refresh request itself
    if (error.response?.status === 401 && !originalRequest._retry && originalRequest.url !== '/auth/refresh' && originalRequest.url !== '/auth/login' && originalRequest.url !== '/auth/register') {
      originalRequest._retry = true;

      try {
        await axios.post(`${resolveApiBaseUrl()}/auth/refresh`, {}, { withCredentials: true });
        return api(originalRequest);
      } catch (refreshError) {
        // If refresh fails, we're fully logged out (e.g. refresh token expired)
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// ── Auth ─────────────────────────────────────────────────────
export const register = async (data: { name: string; email: string; password: string }) => {
  const response = await api.post<{ user: AuthUser }>('/auth/register', data);
  return response.data;
};

export const login = async (email: string, password: string) => {
  const response = await api.post<{ message: string }>('/auth/login', { email, password });
  return response.data;
};

export const logout = async () => {
  const response = await api.post<{ message: string }>('/auth/logout');
  return response.data;
};

export const getMe = async () => {
  const response = await api.get<{ user: AuthUser }>('/auth/me');
  return response.data;
};

// ── Event Types ───────────────────────────────────────────────
export const getEventTypes = async (): Promise<EventType[]> => {
  const response = await api.get<EventType[]>('/event-types');
  return response.data;
};

export const createEventType = async (data: EventTypePayload): Promise<EventType> => {
  const response = await api.post<EventType>('/event-types', data);
  return response.data;
};

export const updateEventType = async (id: number, data: EventTypePayload): Promise<EventType> => {
  const response = await api.put<EventType>(`/event-types/${id}`, data);
  return response.data;
};

export const deleteEventType = async (id: number) => {
  const response = await api.delete(`/event-types/${id}`);
  return response.data;
};

// ── Bookings ──────────────────────────────────────────────────
export const getMeetings = async (params: { status?: 'upcoming' | 'past'; page?: number; limit?: number; from?: string; to?: string } = {}): Promise<PaginatedResponse<MeetingRecord>> => {
  const response = await api.get<PaginatedResponse<MeetingRecord>>('/bookings', { params });
  return response.data;
};

export const cancelMeeting = async (id: number, reason?: string): Promise<MeetingRecord> => {
  const response = await api.post<MeetingRecord>(`/bookings/${id}/cancel`, { reason });
  return response.data;
};

export const markNoShow = async (id: number): Promise<MeetingRecord> => {
  const response = await api.patch<MeetingRecord>(`/bookings/${id}/no-show`);
  return response.data;
};

/** Bookings where the current user is a host (panel interviews) */
export const getHostedBookings = async (status?: 'upcoming' | 'past'): Promise<MeetingRecord[]> => {
  const response = await api.get<MeetingRecord[]>('/bookings/hosted', {
    params: status ? { status } : undefined,
  });
  return response.data;
};

// ── Feedback ──────────────────────────────────────────────────
export const getBookingFeedback = async (id: number): Promise<Feedback[]> => {
  const response = await api.get<Feedback[]>(`/bookings/${id}/feedback`);
  return response.data;
};

export const submitFeedback = async (
  id: number,
  data: { recommendation: Recommendation; notes?: string }
): Promise<Feedback> => {
  const response = await api.put<Feedback>(`/bookings/${id}/feedback`, data);
  return response.data;
};

// ── Availability ──────────────────────────────────────────────
export const getAvailability = async (): Promise<AvailabilitySchedule> => {
  const response = await api.get<AvailabilitySchedule>('/availability');
  return response.data;
};

export const updateAvailability = async (data: AvailabilityPayload): Promise<AvailabilitySchedule> => {
  const response = await api.put<AvailabilitySchedule>('/availability', data);
  return response.data;
};

// ── Public (individual booking flow) ─────────────────────────
export const getPublicProfile = async (username: string): Promise<PublicProfileData> => {
  const response = await api.get<PublicProfileData>(`/public/${username}`);
  return response.data;
};

export const getPublicEventTypes = getPublicProfile;

export const getPublicEventDetails = async (username: string, slug: string): Promise<PublicEventData> => {
  const response = await api.get<PublicEventData>(`/public/${username}/${slug}`);
  return response.data;
};

export const getPublicSlots = async (
  username: string,
  slug: string,
  date: string
): Promise<PublicSlotItem[]> => {
  const response = await api.get<PublicSlotItem[]>(`/public/${username}/${slug}/slots`, {
    params: { date },
  });
  return response.data;
};

export const createBooking = async (
  username: string,
  slug: string,
  data: BookingPayload
): Promise<CreatedBooking> => {
  const response = await api.post<CreatedBooking>(`/public/${username}/${slug}/book`, data);
  return response.data;
};

export const getRescheduleDetails = async (uid: string): Promise<RescheduleDetailsResponse> => {
  const response = await api.get<RescheduleDetailsResponse>(`/public/reschedule/${uid}/details`);
  return response.data;
};

export const rescheduleBooking = async (uid: string, startTime: string): Promise<CreatedBooking> => {
  const response = await api.post<CreatedBooking>(`/public/reschedule/${uid}`, { startTime });
  return response.data;
};

// ── Public (panel booking flow) ───────────────────────────────
export const getPanelDetails = async (panelSlug: string): Promise<PanelPublicData> => {
  const response = await api.get<PanelPublicData>(`/public/panels/${panelSlug}`);
  return response.data;
};

export const getPanelSlots = async (panelSlug: string, date: string): Promise<PublicSlotItem[]> => {
  const response = await api.get<PublicSlotItem[]>(`/public/panels/${panelSlug}/slots`, {
    params: { date },
  });
  return response.data;
};

export const createPanelBooking = async (
  panelSlug: string,
  data: { inviteeName: string; inviteeEmail: string; startTime: string }
): Promise<PanelCreatedBooking> => {
  const response = await api.post<PanelCreatedBooking>(`/public/panels/${panelSlug}/book`, data);
  return response.data;
};

// ── Admin: Positions ──────────────────────────────────────────
export const getPositions = async (): Promise<Position[]> => {
  const response = await api.get<Position[]>('/positions');
  return response.data;
};

export const getPosition = async (id: number): Promise<Position> => {
  const response = await api.get<Position>(`/positions/${id}`);
  return response.data;
};

export const getPositionCandidates = async (id: number): Promise<CandidateRow[]> => {
  const response = await api.get<CandidateRow[]>(`/positions/${id}/candidates`);
  return response.data;
};

export const createPosition = async (data: {
  title: string;
  description?: string;
  status?: 'OPEN' | 'CLOSED';
}): Promise<Position> => {
  const response = await api.post<Position>('/positions', data);
  return response.data;
};

export const updatePosition = async (
  id: number,
  data: { title?: string; description?: string; status?: 'OPEN' | 'CLOSED' }
): Promise<Position> => {
  const response = await api.put<Position>(`/positions/${id}`, data);
  return response.data;
};

export const deletePosition = async (id: number) => {
  const response = await api.delete(`/positions/${id}`);
  return response.data;
};

// ── Admin: Panels ─────────────────────────────────────────────
export const createPanel = async (
  positionId: number,
  data: { title: string; slug: string; duration: number; interviewerIds?: number[] }
): Promise<Panel> => {
  const response = await api.post<Panel>(`/positions/${positionId}/panels`, data);
  return response.data;
};

export const updatePanel = async (
  id: number,
  data: { title?: string; slug?: string; duration?: number; isActive?: boolean }
): Promise<Panel> => {
  const response = await api.put<Panel>(`/panels/${id}`, data);
  return response.data;
};

export const addPanelInterviewer = async (panelId: number, userId: number) => {
  const response = await api.post(`/panels/${panelId}/interviewers`, { userId });
  return response.data;
};

export const removePanelInterviewer = async (panelId: number, userId: number) => {
  const response = await api.delete(`/panels/${panelId}/interviewers/${userId}`);
  return response.data;
};

export const getPanels = async (): Promise<Panel[]> => {
  const { data } = await api.get('/panels');
  return data;
};

export const updateUser = async (updates: { timezone?: string }): Promise<{ user: User }> => {
  const { data } = await api.patch('/users/me', updates);
  return data;
};

export const getMyPanels = async (): Promise<Panel[]> => {
  const response = await api.get<Panel[]>('/panels/my');
  return response.data;
};

// ── Admin: Users ──────────────────────────────────────────────
export const getInterviewers = async (): Promise<AuthUser[]> => {
  const response = await api.get<AuthUser[]>('/users', { params: { role: 'INTERVIEWER' } });
  return response.data;
};

export const getAdminWorkload = async (days: number = 30): Promise<WorkloadRow[]> => {
  const response = await api.get<WorkloadRow[]>('/admin/workload', { params: { days } });
  return response.data;
};

// ── Contacts ──────────────────────────────────────────────────
export const getContacts = async (page = 1, limit = 10): Promise<PaginatedResponse<Contact>> => {
  const response = await api.get<PaginatedResponse<Contact>>('/contacts', { params: { page, limit } });
  return response.data;
};

export const createContact = async (data: ContactPayload): Promise<Contact> => {
  const response = await api.post<Contact>('/contacts', data);
  return response.data;
};

export const updateContact = async (id: number, data: ContactPayload): Promise<Contact> => {
  const response = await api.put<Contact>(`/contacts/${id}`, data);
  return response.data;
};

export const deleteContact = async (id: number) => {
  const response = await api.delete(`/contacts/${id}`);
  return response.data;
};

// ── Shared Types (inline — avoids a separate types file for now) ──
export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: 'ADMIN' | 'INTERVIEWER';
  username?: string;
  timezone?: string;
}


export interface Position {
  id: number;
  title: string;
  description?: string;
  status: 'OPEN' | 'CLOSED';
  createdById: number;
  createdBy?: { id: number; name: string; email: string };
  panels?: Panel[];
  createdAt: string;
}

export interface Panel {
  id: number;
  positionId: number;
  title: string;
  slug: string;
  duration: number;
  isActive: boolean;
  position?: { id: number; title: string };
  interviewers?: Array<{ id: number; user: { id: number; name: string; email: string } }>;
}

export interface PanelPublicData {
  panel: {
    id: number;
    title: string;
    slug: string;
    duration: number;
    isActive: boolean;
    position: { id: number; title: string };
    interviewers: Array<{ id: number; name: string }>;
  };
}

export interface PanelCreatedBooking {
  id: number;
  uid: string;
  panelId: number;
  inviteeName: string;
  inviteeEmail: string;
  startTime: string;
  endTime: string;
  status: string;
  panel: {
    title: string;
    position: { title: string };
    interviewers: Array<{ name: string }>;
  };
}

export type Recommendation = 'STRONG_NO' | 'NO' | 'YES' | 'STRONG_YES';

export interface Feedback {
  id: number;
  bookingId: number;
  interviewerId: number;
  recommendation: Recommendation;
  notes?: string;
  createdAt: string;
  interviewer: {
    id: number;
    name: string;
    email: string;
  };
}

export interface CandidateRow {
  inviteeName: string;
  inviteeEmail: string;
  interviews: Array<{
    bookingId: number;
    panelTitle: string;
    startTime: string;
    status: string;
    feedbackCounts: {
      STRONG_YES: number;
      YES: number;
      NO: number;
      STRONG_NO: number;
    };
  }>;
}

export interface WorkloadRow {
  userId: number;
  name: string;
  interviewCount: number;
}

export default api;
