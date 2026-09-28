'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getRescheduleDetails, getPanelSlots, getPublicSlots, rescheduleBooking } from '@/lib/api';
import type { RescheduleDetailsResponse, PublicSlotItem } from '@/types/public';
import axios from 'axios';
import { AlertDialog } from '@/components/ui/AlertDialog';
import { Button } from '@/components/ui/Button';
import BookingCalendar from '@/components/BookingCalendar';
import { formatInTimeZone } from 'date-fns-tz';
import {
  PublicBookingHeader,
  PublicBookingMain,
  PublicBookingShell,
  PublicLoadingState,
  PublicStateCard,
} from '@/components/PublicBookingLayout';

export default function ReschedulePage() {
  const { uid } = useParams<{ uid: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [eventData, setEventData] = useState<RescheduleDetailsResponse | null>(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState('');

  const [alertInfo, setAlertInfo] = useState({ isOpen: false, title: '', message: '' });
  const showAlert = (title: string, message: string) => setAlertInfo({ isOpen: true, title, message });
  const closeAlert = () => setAlertInfo((prev) => ({ ...prev, isOpen: false }));

  const hostTimeZone = eventData?.user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    const fetchEventData = async () => {
      try {
        const data = await getRescheduleDetails(uid);
        if (data.booking.status === 'CANCELLED') {
          setError('This booking is already cancelled and cannot be rescheduled.');
        } else {
          setEventData(data);
        }
      } catch (err: unknown) {
        if (axios.isAxiosError(err)) {
          setError((err.response?.data as { error?: string } | undefined)?.error || 'Booking not found');
        } else {
          setError('Booking not found');
        }
      } finally {
        setLoading(false);
      }
    };
    if (uid) fetchEventData();
  }, [uid]);

  const fetchSlots = useCallback(async (date: string): Promise<PublicSlotItem[]> => {
    if (!eventData) return [];
    const data = eventData.kind === 'panel'
      ? await getPanelSlots(eventData.panel!.slug, date, hostTimeZone)
      : await getPublicSlots(eventData.user!.username, eventData.eventType!.slug, date, hostTimeZone);
    return data;
  }, [eventData, hostTimeZone]);

  const handleReschedule = async () => {
    if (!selectedSlot || !eventData) return;
    setBookingError('');
    setIsSubmitting(true);

    try {
      const newBooking = await rescheduleBooking(uid, selectedSlot);
      const query = new URLSearchParams({
        bookingId: String(newBooking.id),
        startTime: String(newBooking.startTime),
        endTime: String(newBooking.endTime),
        inviteeName: newBooking.inviteeName,
        inviteeEmail: newBooking.inviteeEmail,
        timezone: hostTimeZone,
      });
      router.push(`/reschedule/${uid}/success?${query.toString()}`);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        showAlert('Reschedule error', (err.response?.data as { error?: string } | undefined)?.error || 'Failed to reschedule. Please try again.');
      } else {
        showAlert('Reschedule error', 'Failed to reschedule. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <PublicLoadingState />;

  if (error || !eventData) {
    return (
      <PublicBookingShell>
        <PublicBookingHeader rightLabel="Reschedule" />
        <PublicBookingMain className="flex min-h-[70vh] items-center justify-center">
          <PublicStateCard icon="event_busy" title="Reschedule unavailable" message={error || 'Booking not found'} tone="danger" />
        </PublicBookingMain>
      </PublicBookingShell>
    );
  }

  const { booking } = eventData;
  const title = eventData.kind === 'panel' ? eventData.panel!.title : eventData.eventType!.title;
  const duration = eventData.kind === 'panel' ? eventData.panel!.duration : eventData.eventType!.duration;
  const hostName = eventData.kind === 'panel'
    ? (eventData.panel!.position?.title || 'Panel interview')
    : eventData.user!.name;
  const prevBookingDate = new Date(booking.startTime);

  return (
    <PublicBookingShell>
      <PublicBookingHeader rightLabel="Reschedule meeting" />

      <PublicBookingMain>
        <div className="border-2 border-ink bg-paper shadow-[8px_8px_0_var(--accent-clay)]">
          <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] lg:grid-cols-[310px_1fr]">
            <aside className="border-b-2 border-ink p-5 sm:p-7 md:border-b-0 md:border-r-2">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-sage">Rescheduling</p>
              <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink sm:text-[28px]">{title}</h1>
              <p className="mt-1 text-sm font-medium text-ink/55">{hostName}</p>

              <div className="mt-6 space-y-3 border-y border-clay/30 py-5 text-sm text-ink/70">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[18px] text-stamp">schedule</span>
                  <span className="font-semibold">{duration} minutes</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-[18px] text-stamp">public</span>
                  <span>Times shown in <strong className="font-mono text-[11px] text-ink/80">{hostTimeZone}</strong></span>
                </div>
              </div>

              <div className="mt-6 border-2 border-ink bg-clay/5 p-4">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/45">Current booking</p>
                <p className="mt-2 text-sm font-bold text-ink">
                  {formatInTimeZone(prevBookingDate, hostTimeZone, 'EEEE, MMMM d, yyyy')}
                </p>
                <p className="mt-1 font-mono text-xs text-ink/60">
                  {formatInTimeZone(prevBookingDate, hostTimeZone, 'h:mma')} – {formatInTimeZone(new Date(booking.endTime), hostTimeZone, 'h:mma')}
                </p>
              </div>

              {selectedSlot && (
                <div className="mt-4 border-2 border-stamp bg-stamp/5 p-4">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-stamp">New time</p>
                  <p className="mt-2 text-sm font-bold text-ink">
                    {formatInTimeZone(new Date(selectedSlot), hostTimeZone, 'EEEE, MMMM d, yyyy')}
                  </p>
                  <p className="mt-1 font-mono text-xs font-semibold text-stamp">
                    {formatInTimeZone(new Date(selectedSlot), hostTimeZone, 'h:mma')}
                  </p>
                </div>
              )}
            </aside>

            <section className="p-5 sm:p-7 lg:p-8">
              {bookingError && (
                <div className="mb-6 border-2 border-oxblood bg-oxblood/5 px-4 py-3 text-sm text-oxblood">
                  {bookingError}
                </div>
              )}

              <BookingCalendar
                fetchSlots={fetchSlots}
                onSlotSelect={(slotIso) => {
                  setSelectedSlot(slotIso);
                  setBookingError('');
                }}
                timezone={hostTimeZone}
              />

              <div className="mt-7 border-t-2 border-ink pt-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/45">Final step</p>
                    <p className="mt-1 text-sm text-ink/60">
                      {selectedSlot ? 'Confirm the new time for this meeting.' : 'Select a new available time above.'}
                    </p>
                  </div>
                  <Button
                    type="button"
                    disabled={!selectedSlot || isSubmitting}
                    onClick={handleReschedule}
                    className="min-h-11 w-full sm:w-auto sm:min-w-48 text-sm font-bold uppercase tracking-widest"
                  >
                    {isSubmitting ? 'Confirming…' : 'Confirm reschedule'}
                  </Button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </PublicBookingMain>

      <AlertDialog isOpen={alertInfo.isOpen} title={alertInfo.title} message={alertInfo.message} onClose={closeAlert} />
    </PublicBookingShell>
  );
}
