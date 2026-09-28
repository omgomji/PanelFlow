'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { createBooking, getPublicEventDetails } from '@/lib/api';
import { formatInTimeZone } from 'date-fns-tz';
import type { PublicEventData } from '@/types/public';
import { AlertDialog } from '@/components/ui/AlertDialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  PublicBookingHeader,
  PublicBookingMain,
  PublicBookingShell,
  PublicLoadingState,
  PublicStateCard,
} from '@/components/PublicBookingLayout';

export default function BookingDetailsPage() {
  const { username, slug } = useParams<{ username: string; slug: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const dateParam = searchParams.get('date');
  const timeParam = searchParams.get('time');

  const [loading, setLoading] = useState(true);
  const [eventData, setEventData] = useState<PublicEventData | null>(null);
  const [error, setError] = useState('');

  const [alertInfo, setAlertInfo] = useState({ isOpen: false, title: '', message: '' });
  const showAlert = (title: string, message: string) => setAlertInfo({ isOpen: true, title, message });
  const closeAlert = () => setAlertInfo((prev) => ({ ...prev, isOpen: false }));

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [inviteeTimeZone, setInviteeTimeZone] = useState('UTC');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    if (!timeParam) {
      showAlert('Booking error', 'Invalid booking details. Please choose a time again.');
      setSubmitting(false);
      return;
    }

    try {
      const booking = await createBooking(username, slug, {
        inviteeName: name,
        inviteeEmail: email,
        startTime: timeParam,
        notes,
      });

      const query = new URLSearchParams({
        bookingId: String(booking.id),
        uid: booking.uid,
        startTime: String(booking.startTime),
        endTime: String(booking.endTime),
        inviteeName: name,
        inviteeEmail: email,
        timezone: inviteeTimeZone,
      });

      router.push(`/${username}/${slug}/success?${query.toString()}`);
    } catch (err: unknown) {
      console.error('Error booking:', err);

      if (axios.isAxiosError(err) && err.response?.status === 409) {
        showAlert('Slot unavailable', 'This slot was just booked by someone else. Please choose another time.');
        router.replace(`/${username}/${slug}`);
        return;
      }

      showAlert('Booking error', 'Failed to book the meeting. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <PublicLoadingState />;

  if (error || !eventData || !dateParam || !timeParam) {
    return (
      <PublicBookingShell>
        <PublicBookingHeader backHref={`/${username}/${slug}`} backLabel="Back to availability" />
        <PublicBookingMain className="flex min-h-[70vh] items-center justify-center">
          <PublicStateCard icon="event_busy" title="Booking unavailable" message={error || 'Invalid booking details'} tone="danger" />
        </PublicBookingMain>
      </PublicBookingShell>
    );
  }

  const { eventType, user } = eventData;
  const selectedTime = new Date(timeParam);
  const selectedEnd = new Date(selectedTime.getTime() + eventType.duration * 60000);

  return (
    <PublicBookingShell>
      <PublicBookingHeader backHref={`/${username}/${slug}`} backLabel="Back to availability" rightLabel="Enter your details" />

      <PublicBookingMain>
        <div className="border-2 border-ink bg-paper shadow-[8px_8px_0_var(--accent-clay)]">
          <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] lg:grid-cols-[310px_1fr]">
            <aside className="border-b-2 border-ink p-5 sm:p-7 md:border-b-0 md:border-r-2">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-stamp">Your appointment</p>
              <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink sm:text-[28px]">{eventType.title}</h1>
              <p className="mt-1 text-sm text-ink/55">with {user.name}</p>

              <div className="mt-6 space-y-3 border-y border-clay/30 py-5 text-sm text-ink/70">
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined mt-0.5 text-[18px] text-stamp">event</span>
                  <div>
                    <p className="font-semibold text-ink">{formatInTimeZone(selectedTime, inviteeTimeZone, 'EEEE, MMMM d, yyyy')}</p>
                    <p className="mt-1 font-mono text-xs text-ink/55">
                      {formatInTimeZone(selectedTime, inviteeTimeZone, 'h:mma')} – {formatInTimeZone(selectedEnd, inviteeTimeZone, 'h:mma')}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined mt-0.5 text-[18px] text-stamp">public</span>
                  <div>
                    <p className="font-semibold text-ink">{inviteeTimeZone}</p>
                    <p className="mt-1 text-xs text-ink/50">Timezone detected from your browser.</p>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/45">Duration</p>
                <p className="font-display text-sm font-bold text-ink">{eventType.duration} minutes</p>
              </div>
            </aside>

            <section className="p-5 sm:p-7 lg:p-8">
              <div className="mb-7 border-b-2 border-ink pb-4">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-stamp">Step 2 of 2</p>
                <h2 className="mt-1 font-display text-xl font-bold tracking-tight text-ink">Your details</h2>
                <p className="mt-1 text-sm text-ink/55">Tell {user.name} who is joining the meeting.</p>
              </div>

              <form onSubmit={handleSubmit} className="max-w-xl space-y-6">
                <div>
                  <label htmlFor="booking-name" className="mb-2 block font-display text-sm font-bold uppercase tracking-wider text-ink/70">
                    Name <span className="text-oxblood">*</span>
                  </label>
                  <Input
                    id="booking-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    autoComplete="name"
                    className="h-11 border-2 border-ink"
                  />
                </div>

                <div>
                  <label htmlFor="booking-email" className="mb-2 block font-display text-sm font-bold uppercase tracking-wider text-ink/70">
                    Email address <span className="text-oxblood">*</span>
                  </label>
                  <Input
                    id="booking-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="h-11 border-2 border-ink"
                  />
                </div>

                <div>
                  <label htmlFor="booking-notes" className="mb-2 block font-display text-sm font-bold uppercase tracking-wider text-ink/70">
                    Notes <span className="font-mono text-[10px] font-normal normal-case tracking-normal text-ink/45">(optional)</span>
                  </label>
                  <textarea
                    id="booking-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={5}
                    placeholder="Anything that will help prepare for the meeting..."
                    className="w-full resize-y border-2 border-ink bg-paper px-3 py-3 text-sm text-ink placeholder:text-ink/35 focus:outline-none focus:ring-2 focus:ring-stamp focus:ring-offset-1"
                  />
                </div>

                <div className="border-t border-clay/30 pt-5">
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="min-h-11 w-full text-sm font-bold uppercase tracking-widest"
                  >
                    {submitting ? 'Scheduling…' : 'Schedule meeting'}
                  </Button>
                  <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-wider text-ink/45">
                    Your information is only used to create this appointment.
                  </p>
                </div>
              </form>
            </section>
          </div>
        </div>
      </PublicBookingMain>

      <AlertDialog
        isOpen={alertInfo.isOpen}
        title={alertInfo.title}
        message={alertInfo.message}
        onClose={closeAlert}
      />
    </PublicBookingShell>
  );
}
