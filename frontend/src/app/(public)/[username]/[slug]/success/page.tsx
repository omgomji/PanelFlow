'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { getPublicEventDetails } from '@/lib/api';
import { formatInTimeZone } from 'date-fns-tz';
import type { PublicEventData } from '@/types/public';
import { AlertDialog } from '@/components/ui/AlertDialog';
import {
  PublicBookingHeader,
  PublicBookingMain,
  PublicBookingShell,
  PublicLoadingState,
} from '@/components/PublicBookingLayout';

export default function SuccessPage() {
  const { username, slug } = useParams<{ username: string; slug: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [eventData, setEventData] = useState<PublicEventData | null>(null);
  const [loading, setLoading] = useState(true);

  const [alertInfo, setAlertInfo] = useState({ isOpen: false, title: '', message: '' });
  const showAlert = (title: string, message: string) => setAlertInfo({ isOpen: true, title, message });
  const closeAlert = () => setAlertInfo(prev => ({ ...prev, isOpen: false }));

  const bookingId = searchParams.get('bookingId');
  const uid = searchParams.get('uid');
  const startTime = searchParams.get('startTime');
  const endTime = searchParams.get('endTime');
  const inviteeName = searchParams.get('inviteeName');
  const inviteeEmail = searchParams.get('inviteeEmail');
  const timezone = searchParams.get('timezone') || Intl.DateTimeFormat().resolvedOptions().timeZone;

  const startDate = startTime ? new Date(startTime) : null;
  const endDate = endTime ? new Date(endTime) : null;
  const hasMeetingDetails = Boolean(startDate && endDate && !Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime()));

  const formatIcsDate = (date: Date) =>
    date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

  const escapeIcsText = (value: string) =>
    value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

  const addToCalendar = () => {
    if (!startDate || !endDate || !hasMeetingDetails) {
      showAlert('Calendar', 'Meeting date and time details are not available.');
      return;
    }

    const title = eventData?.eventType?.title || 'Meeting';
    const host = eventData?.user?.name || 'Host';
    const bookingUrl = `${window.location.origin}/${username}/${slug}`;
    const description = [
      `Meeting with ${host}`,
      inviteeName ? `Invitee: ${inviteeName}` : '',
      `Booking link: ${bookingUrl}`,
    ].filter(Boolean).join('\n');
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//PanelFlow//Booking//EN',
      'BEGIN:VEVENT',
      `UID:${uid || `${bookingId || 'booking'}@panelflow`}`,
      `DTSTAMP:${formatIcsDate(new Date())}`,
      `DTSTART:${formatIcsDate(startDate)}`,
      `DTEND:${formatIcsDate(endDate)}`,
      `SUMMARY:${escapeIcsText(title)}`,
      `DESCRIPTION:${escapeIcsText(description)}`,
      `URL:${bookingUrl}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${slug}-meeting.ics`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const emailMeetingDetails = () => {
    const title = eventData?.eventType?.title || 'Meeting';
    const bookingUrl = `${window.location.origin}/${username}/${slug}`;
    const dateLine = hasMeetingDetails
      ? `${formatInTimeZone(startDate as Date, timezone, 'EEEE, MMMM d, yyyy')} at ${formatInTimeZone(startDate as Date, timezone, 'h:mma')} - ${formatInTimeZone(endDate as Date, timezone, 'h:mma')} (${timezone})`
      : 'The meeting time is shown on the booking page.';
    const subject = encodeURIComponent(`${title} details`);
    const body = encodeURIComponent([
      `Meeting: ${title}`,
      `Date: ${dateLine}`,
      inviteeName ? `Invitee: ${inviteeName}` : '',
      `Booking page: ${bookingUrl}`,
      uid ? `Reschedule: ${window.location.origin}/reschedule/${uid}` : '',
    ].filter(Boolean).join('\n'));
    window.location.href = `mailto:${inviteeEmail || ''}?subject=${subject}&body=${body}`;
  };

  useEffect(() => {
    const fetchEventData = async () => {
      try {
        const data = await getPublicEventDetails(username, slug);
        setEventData(data);
      } catch (err) {
        console.error('Error fetching event:', err);
      } finally {
        setLoading(false);
      }
    };
    if (username && slug) fetchEventData();
  }, [username, slug]);

  if (loading) return <PublicLoadingState />;

  return (
    <PublicBookingShell>
      <PublicBookingHeader backHref={`/${username}`} backLabel="Back to scheduling page" rightLabel="Booking confirmed" />

      <PublicBookingMain maxWidth="2xl">
        <div className="border-2 border-ink bg-paper p-6 shadow-[8px_8px_0_var(--accent-clay)] sm:p-10 lg:p-12">
          <div className="mx-auto flex max-w-xl flex-col items-center text-center">
            <div className="mb-5 flex h-14 w-14 items-center justify-center border-2 border-sage bg-sage/10 text-sage">
              <span className="material-symbols-outlined text-[30px]">check</span>
            </div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-sage">Booking confirmed</p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">You&apos;re scheduled</h1>
            <p className="mt-3 text-base text-ink/60">Your meeting has been successfully scheduled.</p>
          </div>

          {hasMeetingDetails && (
            <div className="mt-8 border-2 border-ink p-5">
              <div className="mb-4 flex items-center justify-between gap-4 border-b border-clay/30 pb-3">
                <h2 className="font-display text-sm font-bold uppercase tracking-wider text-ink">Meeting details</h2>
                {bookingId && <span className="font-mono text-[10px] text-ink/45">#{bookingId}</span>}
              </div>
              <p className="text-sm font-bold text-ink">{eventData?.eventType?.title || 'Meeting'}</p>
              <p className="mt-1 text-sm text-ink/60">with {eventData?.user?.name || 'Host'}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="border border-clay/30 bg-clay/5 p-3">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/45">Date</p>
                  <p className="mt-1 text-sm font-semibold text-ink">
                    {formatInTimeZone(startDate as Date, timezone, 'EEEE, MMMM d, yyyy')}
                  </p>
                </div>
                <div className="border border-clay/30 bg-clay/5 p-3">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/45">Time</p>
                  <p className="mt-1 font-mono text-xs font-semibold text-stamp">
                    {formatInTimeZone(startDate as Date, timezone, 'h:mma')} – {formatInTimeZone(endDate as Date, timezone, 'h:mma')}
                  </p>
                  <p className="mt-1 text-[11px] text-ink/45">{timezone}</p>
                </div>
              </div>
              {(inviteeName || inviteeEmail) && (
                <div className="mt-3 border-t border-clay/30 pt-3 text-xs text-ink/60">
                  {inviteeName && <p><span className="font-semibold text-ink">Invitee:</span> {inviteeName}</p>}
                  {inviteeEmail && <p className="mt-1"><span className="font-semibold text-ink">Email:</span> {inviteeEmail}</p>}
                </div>
              )}
            </div>
          )}

          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => router.push(`/${username}`)}
              className="inline-flex min-h-11 items-center justify-center border-2 border-ink px-5 py-2 font-display text-sm font-bold uppercase tracking-wider text-ink transition-colors hover:bg-clay/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-stamp"
            >
              Schedule another
            </button>
            <button
              type="button"
              onClick={() => {
                const link = `${window.location.origin}/${username}/${slug}`;
                navigator.clipboard.writeText(link);
                showAlert('Link copied', 'Your booking link is ready to share.');
              }}
              className="inline-flex min-h-11 items-center justify-center gap-2 border-2 border-stamp px-5 py-2 font-display text-sm font-bold uppercase tracking-wider text-stamp transition-colors hover:bg-stamp hover:text-paper focus:outline-none focus-visible:ring-2 focus-visible:ring-stamp"
            >
              <span className="material-symbols-outlined text-[17px]">link</span>
              Share link
            </button>
          </div>

          {uid && (
            <div className="mt-7 border-2 border-stamp bg-stamp/5 p-5">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-stamp">Need to make a change?</p>
              <h3 className="mt-1 font-display text-base font-bold text-ink">Reschedule this meeting</h3>
              <p className="mt-1 text-xs leading-5 text-ink/60">Keep this private link safe. It can be used to choose another time.</p>
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <input
                  readOnly
                  value={typeof window !== 'undefined' ? `${window.location.origin}/reschedule/${uid}` : ''}
                  className="min-w-0 flex-1 border-2 border-ink bg-paper px-3 py-2 font-mono text-[11px] text-ink/70 focus:outline-none focus:ring-2 focus:ring-stamp"
                  aria-label="Reschedule link"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/reschedule/${uid}`);
                    showAlert('Link copied', 'The reschedule link has been copied.');
                  }}
                  className="inline-flex min-h-10 items-center justify-center border-2 border-ink bg-ink px-4 py-2 font-display text-xs font-bold uppercase tracking-wider text-paper transition-colors hover:bg-ink/90"
                >
                  Copy
                </button>
              </div>
            </div>
          )}

          <div className="mt-8 border-t-2 border-ink pt-6 text-center">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/45">Add to your calendar</p>
            <div className="mt-3 flex justify-center gap-3">
              <button
                type="button"
                onClick={addToCalendar}
                disabled={!hasMeetingDetails}
                title={hasMeetingDetails ? 'Download calendar event' : 'Calendar details unavailable'}
                aria-label="Add meeting to calendar"
                className="inline-flex h-11 w-11 items-center justify-center border-2 border-ink text-ink/70 transition-colors hover:bg-clay/5 disabled:pointer-events-none disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[18px]">calendar_month</span>
              </button>
              <button
                type="button"
                onClick={emailMeetingDetails}
                title="Email meeting details"
                aria-label="Email meeting details"
                className="inline-flex h-11 w-11 items-center justify-center border-2 border-ink text-ink/70 transition-colors hover:bg-clay/5"
              >
                <span className="material-symbols-outlined text-[18px]">mail</span>
              </button>
            </div>
          </div>
        </div>
      </PublicBookingMain>

      <AlertDialog isOpen={alertInfo.isOpen} title={alertInfo.title} message={alertInfo.message} onClose={closeAlert} />
    </PublicBookingShell>
  );
}
