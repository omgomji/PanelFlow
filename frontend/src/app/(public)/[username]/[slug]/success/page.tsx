'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { getPublicEventDetails } from '@/lib/api';
import { formatInTimeZone } from 'date-fns-tz';
import type { PublicEventData } from '@/types/public';
import { AlertDialog } from '@/components/ui/AlertDialog';

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

  if (loading) {
    return (
      <div className="min-h-screen bg-clay/5 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-sm border-b-2 border-stamp border-2" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-clay/5">
      {/* Header */}
      <div className="bg-paper border-b border-ink border-2">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <span className="text-[12px] font-medium font-medium text-ink/60 uppercase">PanelFlow</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
        <div className="bg-paper rounded-sm border-2 border-ink overflow-hidden shadow-200 p-6 text-center sm:p-10 lg:p-12">
          {/* Success Icon */}
          <div className="mb-6 flex justify-center">
            <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-sm">
              <span className="material-symbols-outlined text-[32px] text-green-600">check_circle</span>
            </div>
          </div>

          {/* Success Message */}
          <h1 className="mb-3 text-[26px] font-bold text-ink sm:text-[32px]">You&apos;re scheduled</h1>

          <p className="text-[16px] text-ink/70 mb-6">
            {eventData ? `A confirmation email will be sent to the email address provided. ${eventData.user.name} will receive an invitation that they can accept to add this meeting to their calendar.` : 'Your meeting has been successfully scheduled.'}
          </p>

          {hasMeetingDetails && (
            <div className="mb-8 rounded-sm border-2 border-ink bg-clay/5 p-4 text-left">
              <h2 className="text-[14px] font-display font-semibold tracking-wide font-bold text-ink">Meeting details</h2>
              <p className="mt-2 text-[13px] font-medium text-ink/80">
                {eventData?.eventType?.title || 'Meeting'} with {eventData?.user?.name || 'Host'}
              </p>
              <p className="mt-1 text-[12px] font-medium text-ink/70">
                {formatInTimeZone(startDate as Date, timezone, 'EEEE, MMMM d, yyyy')} at {formatInTimeZone(startDate as Date, timezone, 'h:mma')} - {formatInTimeZone(endDate as Date, timezone, 'h:mma')} ({timezone})
              </p>
              {inviteeName && <p className="mt-1 text-[12px] font-medium text-ink/70">Invitee: {inviteeName}</p>}
              {inviteeEmail && <p className="mt-1 text-[12px] font-medium text-ink/70">Email: {inviteeEmail}</p>}
              {bookingId && <p className="mt-1 text-[11px] text-ink/60">Booking ID: {bookingId}</p>}
            </div>
          )}

          {/* CTA Buttons */}
          <div className="flex items-center justify-center gap-3 flex-wrap mb-6">
            <button
              onClick={() => router.push(`/${username}`)}
              className="inline-flex min-h-11 items-center rounded-sm border-2 border-ink px-6 py-2 text-[14px] font-display font-semibold tracking-wide font-bold text-ink/80 transition-colors hover:bg-clay/5"
            >
              Schedule another event
            </button>
            <button
              onClick={() => {
                const link = `${window.location.origin}/${username}/${slug}`;
                navigator.clipboard.writeText(link);
                showAlert('Success', 'Link copied to clipboard!');
              }}
              className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-stamp border-2 px-6 py-2 text-[14px] font-display font-semibold tracking-wide font-bold text-stamp transition-colors hover:bg-stamp hover:text-paper"
            >
              <span className="material-symbols-outlined text-[16px]">link</span>
              Share booking link
            </button>
          </div>

          {uid && (
            <div className="mb-6 rounded-sm border border-stamp border-2 bg-stamp/5 p-4 text-left">
              <h3 className="text-[14px] font-display font-semibold tracking-wide font-bold text-stamp mb-2">Need to make a change?</h3>
              <p className="text-[12px] font-medium text-ink/70 mb-3">
                Keep this link safe. You can use it to cancel or reschedule this meeting at any time.
              </p>
              <div className="flex items-center gap-2">
                <input 
                  readOnly 
                  value={typeof window !== 'undefined' ? `${window.location.origin}/reschedule/${uid}` : ''}
                  className="flex-1 bg-paper border-2 border-ink px-3 py-2 text-[12px] font-mono text-ink/70 focus:outline-none"
                />
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/reschedule/${uid}`);
                    showAlert('Success', 'Reschedule link copied!');
                  }}
                  className="px-4 py-2 bg-stamp text-paper text-[12px] font-display font-semibold tracking-wide font-bold border-2 border-transparent transition-colors hover:bg-blue-700"
                >
                  Copy
                </button>
              </div>
            </div>
          )}

          {/* Calendar Integration */}
          <div className="mt-8 pt-6 border-t border-ink border-2">
            <p className="text-[12px] font-medium text-ink/70 mb-3">Add to your calendar:</p>
            <div className="flex items-center justify-center gap-3">
              <button className="flex h-11 w-11 items-center justify-center rounded-sm border-2 border-ink transition-colors hover:bg-clay/5">
                <span className="material-symbols-outlined text-[18px] text-ink/70">calendar_month</span>
              </button>
              <button className="flex h-11 w-11 items-center justify-center rounded-sm border-2 border-ink transition-colors hover:bg-clay/5">
                <span className="material-symbols-outlined text-[18px] text-ink/70">mail</span>
              </button>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-ink border-2">
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
