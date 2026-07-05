'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { createBooking, getPublicEventDetails } from '@/lib/api';
import { formatInTimeZone } from 'date-fns-tz';
import type { PublicEventData } from '@/types/public';
import { AlertDialog } from '@/components/ui/AlertDialog';

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
  const closeAlert = () => setAlertInfo(prev => ({ ...prev, isOpen: false }));

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

    const selectedStartTime = timeParam;
    if (!selectedStartTime) {
      showAlert('Error', 'Invalid booking details');
      setSubmitting(false);
      return;
    }

    try {
      const booking = await createBooking(username, slug, {
        inviteeName: name,
        inviteeEmail: email,
        startTime: selectedStartTime,
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
        showAlert('Error', 'This slot was just booked by someone else. Please choose another time.');
        router.replace(`/${username}/${slug}`);
        return;
      }

      showAlert('Error', 'Failed to book meeting. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-clay/5 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-sm border-b-2 border-stamp border-2" />
      </div>
    );
  }

  if (error || !eventData || !dateParam || !timeParam) {
    return (
      <div className="min-h-screen bg-clay/5 flex items-center justify-center">
        <div className="text-red-500 font-medium">{error || 'Invalid booking details'}</div>
      </div>
    );
  }

  const { eventType, user } = eventData;
  const selectedTime = new Date(timeParam);

  return (
    <div className="min-h-screen bg-clay/5">
      {/* Header */}
      <div className="bg-paper border-b border-ink border-2">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="text-[12px] font-medium font-medium text-ink/60 uppercase">PanelFlow</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="bg-paper rounded-sm border-2 border-ink overflow-hidden shadow-200">
          <div className="grid grid-cols-1 md:grid-cols-3 md:min-h-[600px] relative">
            {/* Left Panel - Event Details */}
            <div className="border-b border-ink border-2 p-4 sm:p-6 md:border-b-0 md:border-r">
              <button
                onClick={() => router.back()}
                className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-sm transition-colors hover:bg-clay/10"
              >
                <span className="material-symbols-outlined text-[20px] font-display font-semibold tracking-wide text-stamp">arrow_back</span>
              </button>

              <div className="text-[12px] font-medium font-medium text-ink/60 uppercase tracking-wide mb-1">
                {user.name}
              </div>
              <h1 className="text-[28px] font-bold text-ink mb-4">{eventType.title}</h1>

              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-[18px] text-ink/60">schedule</span>
                <span className="text-[14px] font-display font-semibold tracking-wide font-medium text-ink/80">{eventType.duration} min</span>
              </div>

              <div className="mt-6 space-y-3 text-[13px] font-medium">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-ink/60">event</span>
                  <span className="text-ink/80 font-medium">
                    {formatInTimeZone(selectedTime, inviteeTimeZone, 'h:mma')} - {formatInTimeZone(new Date(selectedTime.getTime() + eventType.duration * 60000), inviteeTimeZone, 'h:mma')}, {formatInTimeZone(selectedTime, inviteeTimeZone, 'EEEE, MMMM d, yyyy')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-ink/60">public</span>
                  <span className="text-ink/80 font-medium">{inviteeTimeZone}</span>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-ink border-2">
              </div>
            </div>

            {/* Right Panel - Form */}
            <div className="p-4 sm:p-6 md:col-span-2">
              <h2 className="text-[18px] font-bold text-ink mb-6">Enter Details</h2>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Name */}
                <div>
                  <label className="block text-[13px] font-medium font-bold text-ink mb-2">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-ink rounded-sm text-[14px] font-display font-semibold tracking-wide focus:outline-none focus:border-stamp border-2"
                    placeholder="Your name"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block text-[13px] font-medium font-bold text-ink mb-2">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-ink rounded-sm text-[14px] font-display font-semibold tracking-wide focus:outline-none focus:border-stamp border-2"
                    placeholder="your@email.com"
                  />
                </div>

                {/* Add Guests */}
                <div>
                  <button
                    type="button"
                    className="inline-flex h-10 items-center rounded-sm border border-stamp border-2 px-4 text-[12px] font-medium font-bold text-stamp transition-colors hover:bg-stamp hover:text-paper"
                  >
                    Add Guests
                  </button>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-[13px] font-medium font-bold text-ink mb-2">
                    Please share anything that will help prepare for our meeting.
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-ink rounded-sm text-[14px] font-display font-semibold tracking-wide focus:outline-none focus:border-stamp border-2"
                    rows={4}
                    placeholder="Additional notes..."
                  />
                </div>

                {/* Terms */}
                <div className="text-[12px] font-medium text-ink/70">
                  By proceeding, you confirm that you have read and agree to PanelFlow&apos;s{' '}
                  <button type="button" className="text-stamp font-bold hover:underline">
                    Terms of Use
                  </button>
                  {' '}and{' '}
                  <button type="button" className="text-stamp font-bold hover:underline">
                    Privacy Notice
                  </button>
                  .
                </div>

                {/* Submit Button */}
                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="min-h-11 w-full rounded-sm bg-stamp px-4 py-2 text-[14px] font-display font-semibold tracking-wide font-bold text-paper transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? 'Scheduling...' : 'Schedule Event'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog
        isOpen={alertInfo.isOpen}
        title={alertInfo.title}
        message={alertInfo.message}
        onClose={closeAlert}
      />
    </div>
  );
}
