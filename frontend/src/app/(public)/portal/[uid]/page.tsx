'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getCandidatePortal, cancelPublicBooking, rescheduleBooking, getPanelSlots, getPublicSlots } from '@/lib/api';
import type { CandidatePortalResponse } from '@/types/public';
import { formatInTimeZone } from 'date-fns-tz';
import { addMinutes } from 'date-fns';
import axios from 'axios';
import { Button } from '@/components/ui/Button';
import { AlertDialog } from '@/components/ui/AlertDialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import BookingCalendar from '@/components/BookingCalendar';
import {
  PublicBookingHeader,
  PublicBookingMain,
  PublicBookingShell,
  PublicLoadingState,
  PublicStateCard,
} from '@/components/PublicBookingLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';

type Step = 'overview' | 'rescheduling';

export default function CandidatePortalPage() {
  const { uid } = useParams<{ uid: string }>();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<CandidatePortalResponse | null>(null);
  const [error, setError] = useState('');
  const [step, setStep] = useState<Step>('overview');
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const [alertInfo, setAlertInfo] = useState({ isOpen: false, title: '', message: '' });
  const showAlert = (title: string, message: string) => setAlertInfo({ isOpen: true, title, message });
  const closeAlert = () => setAlertInfo((prev) => ({ ...prev, isOpen: false }));

  const timezone = data?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const hostTimezone = data?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    const load = async () => {
      try {
        const portalData = await getCandidatePortal(uid);
        setData(portalData);
      } catch (err: unknown) {
        if (axios.isAxiosError(err)) {
          setError((err.response?.data as { error?: string } | undefined)?.error || 'Unable to load portal.');
        } else {
          setError('Unable to load portal.');
        }
      } finally {
        setLoading(false);
      }
    };
    if (uid) load();
  }, [uid]);

  const fetchSlots = useCallback(async (date: string) => {
    if (!data) return [];
    if (data.panel) {
      return getPanelSlots(data.panel.slug, date, timezone);
    }
    const host = data.host?.username;
    const slug = data.eventType?.slug;
    if (!host || !slug) return [];
    return getPublicSlots(host, slug, date, timezone);
  }, [data, timezone]);

  const handleReschedule = async () => {
    if (!selectedSlot || !data) return;
    setSubmitting(true);
    try {
      await rescheduleBooking(uid, selectedSlot, timezone);
      showAlert('Rescheduled', 'Your interview has been rescheduled successfully.');
      setStep('overview');
      setSelectedSlot(null);
      // Refresh data
      const refreshed = await getCandidatePortal(uid);
      setData(refreshed);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        showAlert('Reschedule error', (err.response?.data as { error?: string } | undefined)?.error || 'Failed to reschedule.');
      } else {
        showAlert('Reschedule error', 'Failed to reschedule. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!uid) return;
    setCancelOpen(false);
    setSubmitting(true);
    try {
      await cancelPublicBooking(uid);
      showAlert('Cancelled', 'Your interview has been cancelled.');
      const refreshed = await getCandidatePortal(uid);
      setData(refreshed);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        showAlert('Cancel error', (err.response?.data as { error?: string } | undefined)?.error || 'Failed to cancel.');
      } else {
        showAlert('Cancel error', 'Failed to cancel. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const copyRescheduleLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/reschedule/${uid}`);
    showAlert('Copied', 'Reschedule link copied to clipboard.');
  };

  const icsDownloadUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/public/bookings/${uid}/calendar`;

  if (loading) return <PublicLoadingState />;

  if (error || !data) {
    return (
      <PublicBookingShell>
        <PublicBookingHeader rightLabel="Candidate Portal" />
        <PublicBookingMain className="flex min-h-[60vh] items-center justify-center">
          <PublicStateCard
            icon="error"
            title="Portal unavailable"
            message={error || 'Unable to retrieve interview details. The link may have expired.'}
            tone="danger"
          />
        </PublicBookingMain>
      </PublicBookingShell>
    );
  }

  const statusConfig: Record<string, { label: string; variant: 'active' | 'cancelled' | 'inactive' | 'completed' | 'pending'; icon: string; nextStep: string }> = {
    SCHEDULED: { label: 'Scheduled', variant: 'active', icon: 'event_available', nextStep: 'Your interview is confirmed.' },
    RESCHEDULED: { label: 'Rescheduled', variant: 'completed', icon: 'update', nextStep: 'Your interview time has been updated.' },
    CANCELLED: { label: 'Cancelled', variant: 'cancelled', icon: 'event_busy', nextStep: 'This interview has been cancelled. Contact your recruiter to rebook.' },
    EXPIRED: { label: 'Expired', variant: 'inactive', icon: 'schedule', nextStep: 'This interview window has expired. Contact your recruiter.' },
    NOT_FOUND: { label: 'Not Found', variant: 'inactive', icon: 'help', nextStep: 'No interview record found for this link.' },
  };

  const config = statusConfig[data.status];
  const primaryRound = data.rounds[0];
  const now = new Date(data.currentDateTime);

  // If NOT_FOUND, render error state
  if (data.status === 'NOT_FOUND') {
    return (
      <PublicBookingShell>
        <PublicBookingHeader rightLabel="Candidate Portal" />
        <PublicBookingMain className="flex min-h-[60vh] items-center justify-center">
          <PublicStateCard
            icon="help"
            title="Interview not found"
            message="No interview record matches this link. It may have expired or been removed."
            tone="danger"
          />
        </PublicBookingMain>
      </PublicBookingShell>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      {/* Header */}
      <header className="border-b-2 border-ink bg-paper">
        <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <button
              onClick={() => window.location.href = '/'}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center border border-clay/40 text-ink/70 transition-colors hover:bg-clay/10 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-stamp"
              aria-label="PanelFlow home"
            >
              <span className="material-symbols-outlined text-[20px]">gavel</span>
            </button>
            <span className="font-display text-[21px] font-bold tracking-tight text-ink">PanelFlow</span>
          </div>
          <span className="hidden font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/50 sm:inline">
            Candidate Portal
          </span>
        </div>
      </header>

      <PageHeader
        title={`Welcome, ${data.inviteeName}`}
        description={`Manage your interview for ${data.panel?.title || data.eventType?.title || 'Scheduled Interview'}`}
        action={
          data.status === 'SCHEDULED' && (
            <Button variant="primary" size="sm" onClick={() => setStep('rescheduling')}>
              <span className="material-symbols-outlined text-[16px] mr-2">update</span>
              Reschedule
            </Button>
          )
        }
      />

      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
        {/* Status banner */}
        <div className="mb-6 p-4 rounded-sm border-2 flex items-start gap-3">
          <div className="flex shrink-0 items-center justify-center border-2 rounded-sm p-1">
            <span className={`material-symbols-outlined text-[20px] ${config.variant === 'active' ? 'text-sage' : config.variant === 'cancelled' ? 'text-oxblood' : config.variant === 'inactive' ? 'text-ink/50' : 'text-stamp'}`}>
              {config.icon}
            </span>
          </div>
          <div>
            <div className="font-display text-sm font-bold text-ink uppercase tracking-wider">{config.label}</div>
            <div className="text-[12px] font-mono text-ink/60">{config.nextStep}</div>
          </div>
        </div>

        {/* Current date/time + timezone */}
        <div className="mb-6 flex items-center gap-4 text-sm font-mono text-ink/60">
          <span className="material-symbols-outlined text-[16px] text-ink/40">today</span>
          <span>
            {now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
          <span className="text-clay/50">·</span>
          <span>
            {now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className="text-clay/50">·</span>
          <span className="font-mono text-xs font-bold">{timezone}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main card */}
          <div className="lg:col-span-2 space-y-6">
            {/* Interview details */}
            <Card className="border-2">
              <CardHeader>
                <CardTitle>Interview Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/45">Type</p>
                    <p className="mt-1 font-display text-base font-bold text-ink">
                      {data.panel ? 'Panel Interview' : 'Individual Interview'}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/45">Position</p>
                    <p className="mt-1 font-display text-base font-bold text-ink">
                      {data.panel?.position?.title || 'General Interview'}
                    </p>
                  </div>
                </div>

                {primaryRound && (
                  <div className="space-y-3">
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/45">Date &amp; Time</p>
                    <div className="mt-1">
                      <p className="font-display text-lg font-bold text-ink">
                        {formatInTimeZone(new Date(primaryRound.startTime), timezone, 'EEEE, MMMM d, yyyy')}
                      </p>
                      <p className="mt-1 font-mono text-sm text-ink/70">
                        {formatInTimeZone(new Date(primaryRound.startTime), timezone, 'h:mma')}
                        {' – '}
                        {formatInTimeZone(new Date(primaryRound.endTime), timezone, 'h:mma')}
                      </p>
                      <p className="mt-1 text-xs text-ink/50">{timezone}</p>
                    </div>
                  </div>
                )}

                {data.panel?.interviewers && data.panel.interviewers.length > 0 && (
                  <div className="space-y-3">
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/45">Interview Panel</p>
                    <div className="flex flex-wrap gap-2">
                      {data.panel.interviewers.map((iv) => (
                        <div
                          key={iv.id}
                          className="flex items-center gap-2 rounded-sm border-2 border-clay/30 bg-clay/5 px-3 py-1.5"
                        >
                          <span className="material-symbols-outlined text-[14px] text-ink/60">person</span>
                          <div className="text-[13px] font-bold text-ink">{iv.name}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {data.rounds.length > 1 && (
                  <div className="space-y-3">
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/45">All Rounds</p>
                    <div className="space-y-2">
                      {data.rounds.map((round, idx) => (
                        <div key={idx} className="p-3 rounded-sm border border-clay/20 bg-paper/50">
                          <div className="flex justify-between mb-1">
                            <span className="text-[12px] font-bold text-ink">{round.panelTitle}</span>
                            <StatusBadge status={round.status === 'SCHEDULED' ? 'active' : round.status === 'CANCELLED' ? 'cancelled' : 'completed'} />
                          </div>
                          <p className="text-[12px] font-mono text-ink/70">
                            {formatInTimeZone(new Date(round.startTime), timezone, 'MMM d, h:mma')}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Preparation & Checklist */}
            {data.preparation && (
              <Card className="border-2">
                <CardHeader>
                  <CardTitle>Preparation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {data.preparation.notes && (
                    <div className="space-y-2">
                      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/45">Notes from your recruiter</p>
                      <p className="text-sm text-ink/70 font-mono whitespace-pre-line">{data.preparation.notes}</p>
                    </div>
                  )}
                  {data.preparation.checklist && data.preparation.checklist.length > 0 && (
                    <div className="space-y-2">
                      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/45">Checklist</p>
                      <ul className="space-y-1 list-disc list-inside text-sm text-ink/70 font-mono">
                        {data.preparation.checklist.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {!data.preparation.notes && !data.preparation.checklist && (
                    <p className="text-sm text-ink/60 font-mono italic">No preparation notes provided yet.</p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar actions */}
          <div className="space-y-6">
            {/* Actions card */}
            <Card className="border-2">
              <CardContent className="p-5 space-y-5">
                <div className="space-y-3">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/45">What would you like to do?</p>
                  {data.canReschedule && data.status === 'SCHEDULED' && (
                    <Button
                      type="button"
                      variant="primary"
                      onClick={() => setStep('rescheduling')}
                      className="w-full gap-2"
                    >
                      <span className="material-symbols-outlined text-[18px]">update</span>
                      Reschedule Interview
                    </Button>
                  )}
                  {data.canCancel && data.status === 'SCHEDULED' && (
                    <Button
                      type="button"
                      variant="danger"
                      onClick={() => setCancelOpen(true)}
                      className="w-full gap-2"
                    >
                      <span className="material-symbols-outlined text-[18px]">event_busy</span>
                      Cancel Interview
                    </Button>
                  )}
                  {!data.canReschedule && !data.canCancel && (
                    <p className="text-sm text-ink/60 font-mono">
                      {data.cancelReason || 'No further actions available for this booking.'}
                    </p>
                  )}
                </div>

                <div className="border-t border-clay/30 pt-4 space-y-3">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/45">Booking Actions</p>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      window.location.href = icsDownloadUrl;
                    }}
                    className="w-full gap-2 text-left justify-start"
                  >
                    <span className="material-symbols-outlined text-[16px]">event</span>
                    Download Calendar (.ics)
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={copyRescheduleLink}
                    className="w-full gap-2 text-left justify-start"
                  >
                    <span className="material-symbols-outlined text-[16px]">content_copy</span>
                    Copy Reschedule Link
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Contact / Help */}
            <Card className="border-2 border-clay/30 bg-clay/5">
              <CardContent className="p-5">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/45">Need help?</p>
                <p className="mt-1 text-sm text-ink/70 font-mono">
                  Contact your recruiter or reach out to support for assistance with this interview.
                </p>
                <div className="mt-3 border-t border-clay/30 pt-3">
                  <p className="text-[12px] font-bold text-ink">PanelFlow Support</p>
                  <p className="text-[12px] text-ink/60 font-mono">support@panelflow.com</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Reschedule step */}
      {step === 'rescheduling' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) setStep('overview'); }}>
          <div className="w-full max-w-2xl bg-paper border-2 border-ink shadow-[4px_4px_0px_rgba(27,31,43,1)] p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-xl font-bold text-ink">Reschedule Interview</h2>
              <button
                type="button"
                onClick={() => setStep('overview')}
                className="text-ink/60 hover:text-ink transition-colors"
                aria-label="Close"
              >
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>

            <div className="mb-6 border-b-2 border-ink pb-4">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-stamp">
                Current: {formatInTimeZone(new Date(primaryRound!.startTime), timezone, 'MMM d, h:mma')}
              </p>
              <p className="mt-1 font-display text-lg font-bold text-ink">
                Select a new available time
              </p>
            </div>

            <BookingCalendar
              fetchSlots={fetchSlots}
              onSlotSelect={(slotIso) => {
                setSelectedSlot(slotIso);
              }}
              timezone={timezone}
            />

            <div className="mt-6 flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setStep('overview')}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!selectedSlot || submitting}
                onClick={handleReschedule}
              >
                {submitting ? 'Rescheduling…' : 'Confirm Reschedule'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel confirm dialog */}
      {cancelOpen && (
        <ConfirmDialog
          isOpen={cancelOpen}
          title="Cancel Interview"
          message="Are you sure you want to cancel this interview? This cannot be undone."
          confirmText="Cancel Interview"
          cancelText="Keep Interview"
          variant="danger"
          onConfirm={handleCancel}
          onCancel={() => setCancelOpen(false)}
        />
      )}

      <AlertDialog
        isOpen={alertInfo.isOpen}
        title={alertInfo.title}
        message={alertInfo.message}
        onClose={closeAlert}
        buttonText="Dismiss"
      />
    </div>
  );
}