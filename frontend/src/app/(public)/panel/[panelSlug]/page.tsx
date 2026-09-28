'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { formatInTimeZone } from 'date-fns-tz';
import { addMinutes } from 'date-fns';
import axios from 'axios';
import { getPanelDetails, getPanelSlots, createPanelBooking, type PanelPublicData } from '@/lib/api';
import BookingCalendar from '@/components/BookingCalendar';
import type { PublicSlotItem } from '@/types/public';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import {
  PublicBookingHeader,
  PublicBookingMain,
  PublicBookingShell,
  PublicLoadingState,
  PublicStateCard,
} from '@/components/PublicBookingLayout';

type Step = 'calendar' | 'form' | 'confirmation';

interface ConfirmationData {
  uid: string;
  inviteeName: string;
  inviteeEmail: string;
  startTime: string;
  endTime: string;
  panelTitle: string;
  positionTitle: string;
  interviewers: string[];
}

export default function PanelBookingPage() {
  const { panelSlug } = useParams<{ panelSlug: string }>();

  const [step, setStep] = useState<Step>('calendar');
  const [panel, setPanel] = useState<PanelPublicData['panel'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<ConfirmationData | null>(null);

  // Booking form state
  const [inviteeName, setInviteeName] = useState('');
  const [inviteeEmail, setInviteeEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState('');

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    getPanelDetails(panelSlug)
      .then((data) => setPanel(data.panel))
      .catch(() => setError('Panel not found'))
      .finally(() => setLoading(false));
  }, [panelSlug]);

  const fetchSlots = useCallback(
    async (date: string): Promise<PublicSlotItem[]> => {
      return getPanelSlots(panelSlug, date, timezone);
    },
    [panelSlug, timezone]
  );

  const handleSlotSelect = (slotIso: string) => {
    setSelectedSlot(slotIso);
    setStep('form');
  };

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) return;
    setBookingError('');
    setSubmitting(true);

    try {
      const booking = await createPanelBooking(panelSlug, {
        inviteeName,
        inviteeEmail,
        startTime: selectedSlot,
        timezone,
      });

      setConfirmation({
        uid: booking.uid,
        inviteeName: booking.inviteeName,
        inviteeEmail: booking.inviteeEmail,
        startTime: booking.startTime,
        endTime: booking.endTime,
        panelTitle: booking.panel.title,
        positionTitle: booking.panel.position.title,
        interviewers: booking.panel.interviewers.map((i) => i.name),
      });
      setStep('confirmation');
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const msg = (err.response?.data as { error?: string })?.error;
        if (err.response?.status === 409) {
          setStep('calendar');
          setSelectedSlot(null);
          setBookingError('That slot was just taken. Availability was refreshed; please choose another time.');
          return;
        }
        setBookingError(msg || 'This slot is no longer available. Please pick another.');
      } else {
        setBookingError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <PublicLoadingState />;
  }

  if (error || !panel) {
    return (
      <PublicBookingShell>
        <PublicBookingHeader rightLabel="Panel booking" />
        <PublicBookingMain className="flex min-h-[70vh] items-center justify-center">
          <PublicStateCard icon="error" title="Panel unavailable" message={error || 'Panel not found'} tone="danger" />
        </PublicBookingMain>
      </PublicBookingShell>
    );
  }

  if (!panel.isActive) {
    return (
      <PublicBookingShell>
        <PublicBookingHeader rightLabel="Panel booking" />
        <PublicBookingMain className="flex min-h-[70vh] items-center justify-center">
          <PublicStateCard
            icon="block"
            title="Bookings closed"
            message="This panel is no longer accepting bookings."
          />
        </PublicBookingMain>
      </PublicBookingShell>
    );
  }

  return (
    <PublicBookingShell>
      <PublicBookingHeader rightLabel="Panel interview" />

      <PublicBookingMain>
        <div className="border-2 border-ink bg-paper shadow-[8px_8px_0_var(--accent-clay)]">
          <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] lg:grid-cols-[310px_1fr]">
            <aside className="border-b-2 border-ink p-5 sm:p-7 md:border-b-0 md:border-r-2">
              <div className="mb-6">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-stamp">
                  Panel interview
                </p>
                <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink sm:text-[28px]">
                  {panel.title}
                </h1>
                <p className="mt-1 text-sm font-medium text-ink/55">{panel.position.title}</p>
              </div>

              <div className="space-y-3 border-y border-clay/30 py-5 text-sm text-ink/70">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[18px] text-stamp">schedule</span>
                  <span className="font-semibold">{panel.duration} minutes</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="material-symbols-outlined text-[18px] text-stamp">public</span>
                  <span>Times shown in <strong className="font-mono text-[11px] text-ink/80">{timezone}</strong></span>
                </div>
              </div>

              <div className="mt-6">
                <p className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/45">
                  Interviewers
                </p>
                <div className="space-y-2">
                  {panel.interviewers.map((iv) => (
                    <div key={iv.id} className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-clay/40 bg-clay/5 font-mono text-[10px] font-bold text-stamp">
                        {iv.name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-sm font-semibold text-ink/75">{iv.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {selectedSlot && (
                <div className="mt-6 border-2 border-ink bg-ink p-4 text-paper">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-paper/55">
                    Selected time
                  </p>
                  <p className="mt-2 font-display text-sm font-bold">
                    {formatInTimeZone(new Date(selectedSlot), timezone, 'EEEE, MMMM d, yyyy')}
                  </p>
                  <p className="mt-1 font-mono text-xs text-paper/70">
                    {formatInTimeZone(new Date(selectedSlot), timezone, 'h:mma')}
                    {' – '}
                    {formatInTimeZone(addMinutes(new Date(selectedSlot), panel.duration), timezone, 'h:mma')}
                  </p>
                </div>
              )}
            </aside>

            <section className="p-5 sm:p-7 lg:p-8">
              {step === 'calendar' && (
                <div>
                  {bookingError && (
                    <div className="mb-6 border-2 border-oxblood bg-oxblood/5 px-4 py-3 text-sm text-oxblood">
                      {bookingError}
                    </div>
                  )}
                  <BookingCalendar fetchSlots={fetchSlots} onSlotSelect={handleSlotSelect} timezone={timezone} />
                </div>
              )}

              {step === 'form' && (
                <div>
                  <button
                    type="button"
                    onClick={() => setStep('calendar')}
                    className="mb-5 inline-flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/55 transition-colors hover:text-stamp"
                  >
                    <span className="material-symbols-outlined text-[17px]">arrow_back</span>
                    Back to calendar
                  </button>

                  <div className="mb-7 border-b-2 border-ink pb-4">
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-stamp">Step 2 of 2</p>
                    <h2 className="mt-1 font-display text-xl font-bold tracking-tight text-ink">Your details</h2>
                    <p className="mt-1 text-sm text-ink/55">Tell the panel who is joining the interview.</p>
                  </div>

                  {bookingError && (
                    <div className="mb-6 border-2 border-oxblood bg-oxblood/5 px-4 py-3 text-sm text-oxblood">
                      {bookingError}
                    </div>
                  )}

                  <form onSubmit={handleBook} className="max-w-xl space-y-6">
                    <div>
                      <label htmlFor="panel-booking-name" className="mb-2 block font-display text-sm font-bold uppercase tracking-wider text-ink/70">
                        Your name <span className="text-oxblood">*</span>
                      </label>
                      <Input
                        id="panel-booking-name"
                        type="text"
                        required
                        value={inviteeName}
                        onChange={(e) => setInviteeName(e.target.value)}
                        className="h-11 border-2 border-ink"
                        placeholder="Full name"
                        autoComplete="name"
                      />
                    </div>
                    <div>
                      <label htmlFor="panel-booking-email" className="mb-2 block font-display text-sm font-bold uppercase tracking-wider text-ink/70">
                        Email address <span className="text-oxblood">*</span>
                      </label>
                      <Input
                        id="panel-booking-email"
                        type="email"
                        required
                        value={inviteeEmail}
                        onChange={(e) => setInviteeEmail(e.target.value)}
                        className="h-11 border-2 border-ink"
                        placeholder="you@example.com"
                        autoComplete="email"
                      />
                    </div>
                    <div className="border-t border-clay/30 pt-5">
                      <Button
                        type="submit"
                        id="panel-booking-submit"
                        disabled={submitting}
                        className="min-h-11 w-full text-sm font-bold uppercase tracking-widest"
                      >
                        {submitting ? 'Scheduling…' : 'Schedule interview'}
                      </Button>
                    </div>
                  </form>
                </div>
              )}

              {step === 'confirmation' && confirmation && (
                <div className="flex min-h-72 flex-col items-center justify-center py-8 text-center">
                  <div className="mb-5 flex h-14 w-14 items-center justify-center border-2 border-sage bg-sage/10 text-sage">
                    <span className="material-symbols-outlined text-[30px]">check</span>
                  </div>
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-sage">Booking confirmed</p>
                  <h2 className="mt-2 font-display text-2xl font-bold tracking-tight text-ink">You&apos;re scheduled</h2>
                  <p className="mt-2 text-sm text-ink/55">Your panel interview has been successfully scheduled.</p>

                  <div className="mt-7 w-full max-w-sm border-2 border-ink p-5 text-left">
                    {[
                      ['Position', confirmation.positionTitle],
                      ['Panel', confirmation.panelTitle],
                    ].map(([label, value]) => (
                      <div key={label} className="mb-4 last:mb-0">
                        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/45">{label}</p>
                        <p className="mt-1 text-sm font-bold text-ink">{value}</p>
                      </div>
                    ))}
                    <div className="mb-4">
                      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/45">Date &amp; time</p>
                      <p className="mt-1 text-sm font-bold text-ink">
                        {formatInTimeZone(new Date(confirmation.startTime), timezone, 'EEEE, MMMM d, yyyy')}
                      </p>
                      <p className="mt-1 font-mono text-xs text-stamp">
                        {formatInTimeZone(new Date(confirmation.startTime), timezone, 'h:mma')}
                        {' – '}
                        {formatInTimeZone(new Date(confirmation.endTime), timezone, 'h:mma')}
                      </p>
                    </div>
                    <div>
                      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/45">Interviewers</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {confirmation.interviewers.map((name) => (
                          <span key={name} className="border border-clay/40 bg-clay/5 px-2.5 py-1 font-mono text-[10px] font-semibold text-ink/70">
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </PublicBookingMain>
    </PublicBookingShell>
  );
}
