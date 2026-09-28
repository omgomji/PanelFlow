'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { getPublicProfile } from '@/lib/api';
import Link from 'next/link';
import type { EventType } from '@/types/event-types';
import type { PublicUser } from '@/types/public';
import {
  PanelFlowMark,
  PublicBookingHeader,
  PublicBookingMain,
  PublicBookingShell,
  PublicLoadingState,
  PublicStateCard,
} from '@/components/PublicBookingLayout';

export default function UserLandingPage() {
  const { username } = useParams<{ username: string }>();
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [userData, setUserData] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const data = await getPublicProfile(username);
        setUserData(data.user);
        setEventTypes((data.eventTypes || []).filter((et) => et.isActive !== false));
      } catch (err) {
        console.error('Error fetching user data:', err);
        setError('User not found');
      } finally {
        setLoading(false);
      }
    };

    if (username) fetchUserData();
  }, [username]);

  if (loading) return <PublicLoadingState />;

  if (error || !userData) {
    return (
      <div className="min-h-screen bg-paper">
        <PublicBookingHeader />
        <PublicBookingMain className="flex min-h-[70vh] items-center justify-center">
          <PublicStateCard icon="person_off" title="Profile unavailable" message={error || 'User not found'} tone="danger" />
        </PublicBookingMain>
      </div>
    );
  }

  return (
    <PublicBookingShell>
      <PublicBookingHeader rightLabel="Public scheduling link" />

      <PublicBookingMain maxWidth="4xl">
        <section className="mb-8 border-b-2 border-ink pb-7 sm:mb-10 sm:pb-8">
          <div className="mb-4 flex items-center gap-2 font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-stamp">
            <span className="h-2 w-2 bg-stamp" />
            {username}
          </div>
          <h1 className="max-w-3xl font-display text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            {userData.name || username}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-ink/65 sm:text-lg">
            Choose a meeting type below to find a time that works for you.
          </p>
        </section>

        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-bold uppercase tracking-wide text-ink">Meeting types</h2>
              <p className="mt-1 text-sm text-ink/55">Select an option to view available times.</p>
            </div>
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-ink/45">
              {eventTypes.length} {eventTypes.length === 1 ? 'option' : 'options'}
            </span>
          </div>

          {eventTypes.length === 0 ? (
            <div className="border-2 border-ink p-10 text-center">
              <span className="material-symbols-outlined text-3xl text-ink/45">event_busy</span>
              <p className="mt-3 font-display font-bold uppercase tracking-wide text-ink/70">No event types available</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {eventTypes.map((event) => (
                <Link
                  key={event.id}
                  href={`/${username}/${event.slug}`}
                  className="group block border-2 border-ink bg-paper p-5 transition-transform hover:-translate-y-0.5 hover:bg-clay/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-stamp"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="mb-4 flex items-center gap-3">
                        <span className="h-3 w-3 shrink-0 bg-stamp" />
                        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/50">
                          {event.duration} min
                        </span>
                      </div>
                      <h3 className="font-display text-xl font-bold text-ink transition-colors group-hover:text-stamp">
                        {event.title}
                      </h3>
                      {event.description && (
                        <p className="mt-2 text-sm leading-6 text-ink/65">{event.description}</p>
                      )}
                    </div>
                    <span className="material-symbols-outlined mt-0.5 text-[20px] text-ink/45 transition-transform group-hover:translate-x-0.5 group-hover:text-stamp">
                      arrow_forward
                    </span>
                  </div>

                  <div className="mt-6 flex items-center gap-2 border-t border-clay/30 pt-4 text-xs font-semibold uppercase tracking-wider text-ink/55">
                    <span className="material-symbols-outlined text-[16px]">schedule</span>
                    View availability
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <footer className="mt-12 border-t-2 border-ink pt-5 text-center sm:mt-16">
          <PanelFlowMark compact />
        </footer>
      </PublicBookingMain>
    </PublicBookingShell>
  );
}
