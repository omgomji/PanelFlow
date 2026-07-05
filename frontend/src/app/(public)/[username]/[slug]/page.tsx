'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';
import { getPublicEventDetails, getPublicSlots } from '@/lib/api';
import { formatInTimeZone } from 'date-fns-tz';
import type { PublicEventData, PublicSlotItem } from '@/types/public';
import BookingCalendar from '@/components/BookingCalendar';

export default function BookingPage() {
  const { username, slug } = useParams<{ username: string; slug: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [eventData, setEventData] = useState<PublicEventData | null>(null);
  const [error, setError] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [inviteeTimeZone, setInviteeTimeZone] = useState<string>('UTC');

  useEffect(() => {
    // Detect invitee timezone on mount
    setInviteeTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  useEffect(() => {
    const fetchEventData = async () => {
      try {
        const data = await getPublicEventDetails(username, slug);
        setEventData(data);
      } catch (err: unknown) {
        if (axios.isAxiosError(err)) {
          setError((err.response?.data as { error?: string } | undefined)?.error || 'Event not found');
        } else {
          setError('Event not found');
        }
      } finally {
        setLoading(false);
      }
    };
    if (username && slug) fetchEventData();
  }, [username, slug]);

  const fetchSlots = useCallback(
    async (date: string): Promise<PublicSlotItem[]> => {
      return getPublicSlots(username, slug, date);
    },
    [username, slug]
  );

  const handleSlotSelect = (slotIso: string, slotHostDate: string) => {
    setSelectedSlot(slotIso);
    router.push(`/${username}/${slug}/book?date=${slotHostDate}&time=${encodeURIComponent(slotIso)}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !eventData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-red-500 font-medium">{error || 'Event not found'}</div>
      </div>
    );
  }

  const { eventType, user } = eventData;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="text-[12px] font-medium text-slate-500 uppercase">PanelFlow</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-200">
          <div className="grid grid-cols-1 md:grid-cols-3 md:min-h-[600px] relative">
            {/* Left Panel - Event Details */}
            <div className="border-b border-slate-200 p-4 sm:p-6 md:border-b-0 md:border-r">
              <button
                onClick={() => router.back()}
                className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-slate-100"
              >
                <span className="material-symbols-outlined text-[20px] text-primary">arrow_back</span>
              </button>

              <div className="text-[12px] font-medium text-slate-500 uppercase tracking-wide mb-1">
                {user.name}
              </div>
              <h1 className="text-[28px] font-bold text-slate-900 mb-4">{eventType.title}</h1>

              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-[18px] text-slate-500">schedule</span>
                <span className="text-[14px] font-medium text-slate-700">{eventType.duration} min</span>
              </div>

              {eventType.description && (
                <div className="text-[13px] text-slate-600 mt-4">{eventType.description}</div>
              )}

              {!selectedSlot && (
                <div className="mt-6 space-y-2 text-[13px]">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-slate-500">public</span>
                    <span className="text-slate-700 font-medium">Times are in {inviteeTimeZone}</span>
                  </div>
                </div>
              )}

              {selectedSlot && (
                <div className="mt-6 space-y-2 text-[13px]">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-slate-500">event</span>
                    <span className="text-slate-700 font-medium">
                      {formatInTimeZone(new Date(selectedSlot), inviteeTimeZone, 'h:mma, EEEE, MMMM d, yyyy')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-slate-500">public</span>
                    <span className="text-slate-700 font-medium">{inviteeTimeZone}</span>
                  </div>
                </div>
              )}

              <div className="mt-8 pt-6 border-t border-slate-200" />
            </div>

            {/* Right Panel - Calendar */}
            <div className="p-4 sm:p-6 md:col-span-2">
              <BookingCalendar
                fetchSlots={fetchSlots}
                onSlotSelect={handleSlotSelect}
                timezone={inviteeTimeZone}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
