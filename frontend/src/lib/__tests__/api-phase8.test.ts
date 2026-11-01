import { describe, it, expect, vi, beforeEach } from 'vitest';
import api, {
  inviteUser,
  getInvitations,
  revokeInvitation,
  resendInvitation,
  getCandidatePortal,
  cancelPublicBooking,
  getFeedbackCompletion,
  getCandidatesByPosition,
  getSystemStatus,
} from '../api';

vi.mock('axios', () => {
  return {
    default: {
      create: vi.fn(() => ({
        get: vi.fn(),
        post: vi.fn(),
        put: vi.fn(),
        delete: vi.fn(),
        patch: vi.fn(),
        interceptors: { response: { use: vi.fn() } },
      })),
    },
  };
});

const getMock = api.get as ReturnType<typeof vi.fn>;
const postMock = api.post as ReturnType<typeof vi.fn>;
const deleteMock = api.delete as ReturnType<typeof vi.fn>;

describe('Invitation API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('inviteUser posts to /admin/invitations with email and role', async () => {
    const mockData = { inviteUrl: 'http://localhost:3000/register?token=abc', token: 'abc' };
    postMock.mockResolvedValueOnce({ data: mockData });

    const result = await inviteUser({ email: 'alice@example.com', role: 'INTERVIEWER' });
    expect(postMock).toHaveBeenCalledWith('/admin/invitations', { email: 'alice@example.com', role: 'INTERVIEWER' });
    expect(result).toEqual(mockData);
  });

  it('getInvitations fetches with optional active filter', async () => {
    const mockData = [{ id: 1, email: 'alice@example.com', role: 'INTERVIEWER', isActive: true }];
    getMock.mockResolvedValueOnce({ data: mockData });

    const result = await getInvitations({ active: true });
    expect(getMock).toHaveBeenCalledWith('/admin/invitations', { params: { active: true } });
    expect(result).toEqual(mockData);
  });

  it('revokeInvitation deletes the invitation by id', async () => {
    deleteMock.mockResolvedValueOnce({ data: { success: true } });

    const result = await revokeInvitation(1);
    expect(deleteMock).toHaveBeenCalledWith('/admin/invitations/1');
    expect(result).toEqual({ success: true });
  });

  it('resendInvitation posts to resend endpoint', async () => {
    const mockData = { inviteUrl: 'http://localhost:3000/register?token=def', token: 'def', expiresAt: '2026-12-01T00:00:00Z' };
    postMock.mockResolvedValueOnce({ data: mockData });

    const result = await resendInvitation(1);
    expect(postMock).toHaveBeenCalledWith('/admin/invitations/1/resend');
    expect(result).toEqual(mockData);
  });
});

describe('Candidate Portal API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getCandidatePortal fetches portal data by uid', async () => {
    const mockData = {
      uid: 'abc-123',
      inviteeName: 'Jane Doe',
      status: 'SCHEDULED',
      canReschedule: true,
      canCancel: true,
      rounds: [],
    };
    getMock.mockResolvedValueOnce({ data: mockData });

    const result = await getCandidatePortal('abc-123');
    expect(getMock).toHaveBeenCalledWith('/public/portal/abc-123');
    expect(result).toEqual(mockData);
  });

  it('cancelPublicBooking posts to cancel endpoint', async () => {
    const mockData = { success: true };
    postMock.mockResolvedValueOnce({ data: mockData });

    const result = await cancelPublicBooking('abc-123');
    expect(postMock).toHaveBeenCalledWith('/public/cancel/abc-123');
    expect(result).toEqual(mockData);
  });
});

describe('Analytics API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getFeedbackCompletion fetches with days and positionId', async () => {
    const mockData = {
      totalBookings: 10,
      fullyReviewed: 8,
      overdue: 2,
      completionRate: 80,
      avgDelayMinutes: 45,
    };
    getMock.mockResolvedValueOnce({ data: mockData });

    const result = await getFeedbackCompletion({ days: 30, positionId: 1 });
    expect(getMock).toHaveBeenCalledWith('/admin/feedback-completion', { params: { days: 30, positionId: 1 } });
    expect(result).toEqual(mockData);
  });

  it('getCandidatesByPosition fetches candidate history', async () => {
    const mockData = {
      position: { id: 1, title: 'Full Stack Engineer' },
      candidates: [],
    };
    getMock.mockResolvedValueOnce({ data: mockData });

    const result = await getCandidatesByPosition({ positionId: 1, days: 30 });
    expect(getMock).toHaveBeenCalledWith('/admin/candidates', { params: { positionId: 1, days: 30 } });
    expect(result).toEqual(mockData);
  });
});

describe('System Status API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getSystemStatus fetches infrastructure status', async () => {
    const mockData = {
      email: { configured: true, provider: 'Resend' },
      kafka: { configured: true, mode: 'active' },
      redis: { connected: true, mode: 'active' },
      lastEventProcessingError: null,
    };
    getMock.mockResolvedValueOnce({ data: mockData });

    const result = await getSystemStatus();
    expect(getMock).toHaveBeenCalledWith('/admin/system-status');
    expect(result).toEqual(mockData);
  });
});
