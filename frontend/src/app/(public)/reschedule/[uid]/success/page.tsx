'use client';

import { useSearchParams } from 'next/navigation';
import { formatInTimeZone } from 'date-fns-tz';
import {
  PanelFlowMark,
  PublicBookingMain,
  PublicBookingShell,
  PublicBookingHeader,
} from '@/components/PublicBookingLayout';

export default function RescheduleSuccessPage() {
  const params = useSearchParams();
  const startTime = params.get('startTime');
  const endTime = params.get('endTime');
  const timezone = params.get('timezone') || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const inviteeName = params.get('inviteeName');
  const inviteeEmail = params.get('inviteeEmail');
  const startDate = startTime ? new Date(startTime) : null;
  const endDate = endTime ? new Date(endTime) : null;
  const validDates = Boolean(startDate && endDate && !Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime()));

  return (
    <PublicBookingShell>
      <PublicBookingHeader rightLabel="Reschedule confirmed" />
      <PublicBookingMain maxWidth="2xl">
        <div className="border-2 border-ink bg-paper p-6 text-center shadow-[8px_8px_0_var(--accent-clay)] sm:p-10">
          <div className="mx-auto flex h-14 w-14 items-center justify-center border-2 border-sage bg-sage/10 text-sage">
            <span className="material-symbols-outlined text-[30px]">check</span>
          </div>
          <p className="mt-5 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-sage">Booking updated</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink sm:text-4xl">New time confirmed</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-ink/60">
            Your meeting has been rescheduled successfully.
          </p>

          {validDates && (
            <div className="mx-auto mt-8 max-w-md border-2 border-ink p-5 text-left">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/45">Updated meeting</p>
              <p className="mt-2 font-display text-base font-bold text-ink">
                {formatInTimeZone(startDate as Date, timezone, 'EEEE, MMMM d, yyyy')}
              </p>
              <p className="mt-1 font-mono text-xs font-semibold text-stamp">
                {formatInTimeZone(startDate as Date, timezone, 'h:mma')} – {formatInTimeZone(endDate as Date, timezone, 'h:mma')}
              </p>
              <p className="mt-1 text-[11px] text-ink/45">{timezone}</p>
              {(inviteeName || inviteeEmail) && (
                <div className="mt-4 border-t border-clay/30 pt-4 text-xs text-ink/60">
                  {inviteeName && <p><span className="font-semibold text-ink">Invitee:</span> {inviteeName}</p>}
                  {inviteeEmail && <p className="mt-1"><span className="font-semibold text-ink">Email:</span> {inviteeEmail}</p>}
                </div>
              )}
            </div>
          )}

          <div className="mt-8 border-t-2 border-ink pt-5">
            <PanelFlowMark compact />
          </div>
        </div>
      </PublicBookingMain>
    </PublicBookingShell>
  );
}
