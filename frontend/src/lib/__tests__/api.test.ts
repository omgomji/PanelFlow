import { describe, it, expect, vi, beforeEach } from 'vitest';
import api, { getPublicEventDetails, getPublicSlots } from '../api';

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

describe('API Utils', () => {
  const getMock = api.get as ReturnType<typeof vi.fn>;
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getPublicEventDetails formats url correctly', async () => {
    const mockData = { eventType: { title: 'Test' } };
    getMock.mockResolvedValueOnce({ data: mockData });

    const result = await getPublicEventDetails('host', 'test-event');
    expect(api.get).toHaveBeenCalledWith('/public/host/test-event');
    expect(result).toEqual(mockData);
  });

  it('getPublicSlots handles date param correctly', async () => {
    getMock.mockResolvedValueOnce({ data: [{ time: '10:00' }] });

    const result = await getPublicSlots('host', 'test-event', '2030-01-07');
    expect(api.get).toHaveBeenCalledWith(
      '/public/host/test-event/slots', { params: { date: '2030-01-07', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone } }
    );
    expect(result).toEqual([{ time: '10:00' }]);
  });
});
