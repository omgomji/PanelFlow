'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { formatInTimeZone } from 'date-fns-tz';
import { addMinutes } from 'date-fns';
import axios from 'axios';
import { getPanelDetails, getPanelSlots, createPanelBooking, type PanelPublicData } from '@/lib/api';
import BookingCalendar from '@/components/BookingCalendar';
import type { PublicSlotItem } from '@/types/public';

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

  const timezone = 'Asia/Kolkata'; // use host's timezone; panel currently global

  useEffect(() => {
    getPanelDetails(panelSlug)
      .then((data) => setPanel(data.panel))
      .catch(() => setError('Panel not found'))
      .finally(() => setLoading(false));
  }, [panelSlug]);

  const fetchSlots = useCallback(
    async (date: string): Promise<PublicSlotItem[]> => {
      return getPanelSlots(panelSlug, date);
    },
    [panelSlug]
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
        setBookingError(msg || 'This slot is no longer available. Please pick another.');
      } else {
        setBookingError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !panel) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="rounded-xl bg-white border border-red-200 p-8 text-center max-w-sm">
          <span className="material-symbols-outlined text-4xl text-red-400 mb-2">error</span>
          <p className="text-red-600 font-medium">{error || 'Panel not found'}</p>
        </div>
      </div>
    );
  }

  if (!panel.isActive) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="rounded-xl bg-white border border-slate-200 p-8 text-center max-w-sm">
          <span className="material-symbols-outlined text-4xl text-slate-300 mb-2">block</span>
          <p className="text-slate-600 font-medium">This panel is no longer accepting bookings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-white to-slate-50 relative overflow-hidden">
      {/* Decorative Orbs */}
      <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-200/30 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-200/20 blur-[120px] pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 bg-white/60 backdrop-blur-md border-b border-white/40 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="text-[14px] font-extrabold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent uppercase tracking-wide">PanelFlow</span>
        </div>
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-8">
        <div className="bg-white/80 backdrop-blur-xl rounded-2xl border border-white/60 shadow-xl shadow-blue-900/5 overflow-hidden transition-all">
          <div className="grid grid-cols-1 md:grid-cols-3 md:min-h-[600px] relative">
            {/* Left: Panel Info */}
            <div className="border-b border-slate-200 p-4 sm:p-6 md:border-b-0 md:border-r">
              <div className="text-[12px] font-semibold text-slate-400 uppercase tracking-wide mb-1">
                {panel.position.title}
              </div>
              <h1 className="text-[24px] font-bold text-slate-900 mb-1">{panel.title}</h1>
              <div className="flex items-center gap-2 mb-4">
                <span className="material-symbols-outlined text-[18px] text-slate-500">schedule</span>
                <span className="text-[14px] font-medium text-slate-700">{panel.duration} min</span>
              </div>

              {/* Interviewers */}
              <div className="mb-4">
                <div className="text-[12px] font-bold text-slate-500 uppercase tracking-wide mb-2">
                  Interviewers
                </div>
                <div className="space-y-2">
                  {panel.interviewers.map((iv) => (
                    <div key={iv.id} className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-bold text-primary">
                        {iv.name.slice(0, 2).toUpperCase()}
                      </div>
                      <span className="text-[13px] font-medium text-slate-700">{iv.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Selected slot preview */}
              {selectedSlot && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <div className="text-[12px] font-bold text-slate-500 uppercase tracking-wide mb-2">
                    Selected Time
                  </div>
                  <div className="text-[13px] font-medium text-slate-700">
                    {formatInTimeZone(new Date(selectedSlot), timezone, 'EEEE, MMMM d, yyyy')}
                  </div>
                  <div className="text-[16px] font-bold text-primary mt-0.5">
                    {formatInTimeZone(new Date(selectedSlot), timezone, 'h:mma')}
                    {' '}–{' '}
                    {formatInTimeZone(addMinutes(new Date(selectedSlot), panel.duration), timezone, 'h:mma')}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Calendar / Form / Confirmation */}
            <div className="p-4 sm:p-6 md:col-span-2">
              {step === 'calendar' && (
                <BookingCalendar
                  fetchSlots={fetchSlots}
                  onSlotSelect={handleSlotSelect}
                  timezone={timezone}
                />
              )}

              {step === 'form' && (
                <div>
                  <button
                    onClick={() => setStep('calendar')}
                    className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
                  >
                    <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                    Back to calendar
                  </button>

                  <h2 className="text-[18px] font-bold text-slate-900 mb-6">Your Details</h2>

                  {bookingError && (
                    <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                      {bookingError}
                    </div>
                  )}

                  <form onSubmit={handleBook} className="space-y-5 max-w-md">
                    <div>
                      <label className="block text-sm font-semibold text-slate-900 mb-1.5">
                        Your Name *
                      </label>
                      <input
                        id="panel-booking-name"
                        type="text"
                        required
                        value={inviteeName}
                        onChange={(e) => setInviteeName(e.target.value)}
                        className="w-full px-4 py-3 border border-slate-200 bg-white/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all hover:bg-white"
                        placeholder="Full name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-900 mb-1.5">
                        Email address *
                      </label>
                      <input
                        id="panel-booking-email"
                        type="email"
                        required
                        value={inviteeEmail}
                        onChange={(e) => setInviteeEmail(e.target.value)}
                        className="w-full px-4 py-3 border border-slate-200 bg-white/50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all hover:bg-white"
                        placeholder="you@example.com"
                      />
                    </div>
                    <button
                      type="submit"
                      id="panel-booking-submit"
                      disabled={submitting}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-primary text-white text-sm font-bold shadow-md shadow-blue-500/20 transition-all hover:shadow-lg hover:shadow-blue-500/30 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                      {submitting ? 'Scheduling…' : 'Schedule Interview'}
                    </button>
                  </form>
                </div>
              )}

              {step === 'confirmation' && confirmation && (
                <div className="flex flex-col items-center justify-center h-full min-h-64 text-center py-8">
                  <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mb-5">
                    <span className="material-symbols-outlined text-4xl text-green-600">check_circle</span>
                  </div>
                  <h2 className="text-[22px] font-bold text-slate-900 mb-1">Confirmed!</h2>
                  <p className="text-slate-500 text-sm mb-6">
                    A confirmation will be sent to <strong>{confirmation.inviteeEmail}</strong>
                  </p>

                  <div className="w-full max-w-sm rounded-xl border border-slate-200 p-5 text-left space-y-3">
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-0.5">Position</div>
                      <div className="text-[13px] font-semibold text-slate-800">{confirmation.positionTitle}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-0.5">Panel</div>
                      <div className="text-[13px] font-semibold text-slate-800">{confirmation.panelTitle}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-0.5">Date &amp; Time</div>
                      <div className="text-[13px] font-semibold text-slate-800">
                        {formatInTimeZone(new Date(confirmation.startTime), timezone, 'EEEE, MMMM d, yyyy')}
                      </div>
                      <div className="text-[16px] font-bold text-primary">
                        {formatInTimeZone(new Date(confirmation.startTime), timezone, 'h:mma')}
                        {' – '}
                        {formatInTimeZone(new Date(confirmation.endTime), timezone, 'h:mma')}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mb-1">Interviewers</div>
                      <div className="flex flex-wrap gap-1.5">
                        {confirmation.interviewers.map((name) => (
                          <span
                            key={name}
                            className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700"
                          >
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
