'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';
import { getPublicEventDetails, getPublicSlots } from '@/lib/api';
import { formatInTimeZone } from 'date-fns-tz';
import type { PublicEventData, PublicSlotItem } from '@/types/public';
import BookingCalendar from '@/components/BookingCalendar';
import {
  PublicBookingHeader,
  PublicBookingMain,
  PublicBookingShell,
  PublicLoadingState,
  PublicStateCard,
} from '@/components/PublicBookingLayout';

export default function BookingPage() {
  const { username, slug } = useParams<{ username: string; slug: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [eventData, setEventData] = useState<PublicEventData | null>(null);
  const [error, setError] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [inviteeTimeZone, setInviteeTimeZone] = useState<string>('UTC');

  useEffect(() => {
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
      return getPublicSlots(username, slug, date, inviteeTimeZone);
    },
    [username, slug, inviteeTimeZone]
  );

  const handleSlotSelect = (slotIso: string, slotHostDate: string) => {
    setSelectedSlot(slotIso);
    router.push(`/${username}/${slug}/book?date=${slotHostDate}&time=${encodeURIComponent(slotIso)}`);
  };

  if (loading) return <PublicLoadingState />;

  if (error || !eventData) {
    return (
      <PublicBookingShell>
        <PublicBookingHeader backHref={`/${username}`} backLabel="Back to scheduling page" />
        <PublicBookingMain className="flex min-h-[70vh] items-center justify-center">
          <PublicStateCard icon="event_busy" title="Event unavailable" message={error || 'Event not found'} tone="danger" />
        </PublicBookingMain>
      </PublicBookingShell>
    );
  }

  const { eventType, user } = eventData;

  return (
    <PublicBookingShell>
      <PublicBookingHeader backHref={`/${username}`} backLabel="Back to scheduling page" rightLabel="Choose a time" />

      <PublicBookingMain>
        <div className="border-2 border-ink bg-paper shadow-[8px_8px_0_var(--accent-clay)]">
          <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] lg:grid-cols-[310px_1fr]">
            <aside className="border-b-2 border-ink p-5 sm:p-7 md:border-b-0 md:border-r-2">
              <div className="mb-6">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-stamp">
                  Meeting type
                </p>
                <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink sm:text-[28px]">
                  {eventType.title}
                </h1>
                <p className="mt-1 text-sm font-medium text-ink/55">with {user.name}</p>
              </div>

              <div className="space-y-3 border-y border-clay/30 py-5 text-sm text-ink/70">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[18px] text-stamp">schedule</span>
                  <span className="font-semibold">{eventType.duration} minutes</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined mt-0.5 text-[18px] text-stamp">public</span>
                  <span>
                    Times shown in <strong className="font-mono text-[11px] text-ink/80">{inviteeTimeZone}</strong>
                  </span>
                </div>
              </div>

              {eventType.description && (
                <div className="mt-6">
                  <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/45">
                    About this meeting
                  </p>
                  <p className="text-sm leading-6 text-ink/65">{eventType.description}</p>
                </div>
              )}

              {selectedSlot && (
                <div className="mt-6 border-2 border-ink bg-ink p-4 text-paper">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-paper/55">
                    Selected time
                  </p>
                  <p className="mt-2 font-display text-sm font-bold">
                    {formatInTimeZone(new Date(selectedSlot), inviteeTimeZone, 'EEEE, MMMM d, yyyy')}
                  </p>
                  <p className="mt-1 font-mono text-xs text-paper/70">
                    {formatInTimeZone(new Date(selectedSlot), inviteeTimeZone, 'h:mma')}
                  </p>
                </div>
              )}
            </aside>

            <section className="p-5 sm:p-7 lg:p-8">
              <BookingCalendar
                fetchSlots={fetchSlots}
                onSlotSelect={handleSlotSelect}
                timezone={inviteeTimeZone}
              />
            </section>
          </div>
        </div>
      </PublicBookingMain>
    </PublicBookingShell>
  );
}
