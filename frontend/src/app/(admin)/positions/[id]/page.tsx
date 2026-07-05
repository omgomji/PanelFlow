'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getPosition, createPanel, getInterviewers, getPositionCandidates, type Position, type AuthUser, type CandidateRow } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import axios from 'axios';

export default function PositionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const positionId = parseInt(id, 10);

  const [position, setPosition] = useState<Position | null>(null);
  const [loading, setLoading] = useState(true);
  const [interviewers, setInterviewers] = useState<AuthUser[]>([]);
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const { user } = useAuth();

  // Add Panel form
  const [addingPanel, setAddingPanel] = useState(false);
  const [panelTitle, setPanelTitle] = useState('');
  const [panelSlug, setPanelSlug] = useState('');
  const [panelDuration, setPanelDuration] = useState(45);
  const [selectedInterviewers, setSelectedInterviewers] = useState<number[]>([]);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [pos, ivs, cands] = await Promise.all([
        getPosition(positionId),
        getInterviewers(),
        getPositionCandidates(positionId)
      ]);
      setPosition(pos);
      setInterviewers(ivs);
      setCandidates(cands);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [positionId]);

  useEffect(() => { load(); }, [load]);

  // Auto-generate slug from title
  useEffect(() => {
    const slug = panelTitle
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
    setPanelSlug(slug);
  }, [panelTitle]);

  const toggleInterviewer = (userId: number) => {
    setSelectedInterviewers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleAddPanel = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      await createPanel(positionId, {
        title: panelTitle,
        slug: panelSlug,
        duration: panelDuration,
        interviewerIds: selectedInterviewers,
      });
      // Reload position to get updated panels list
      await load();
      setPanelTitle('');
      setPanelDuration(45);
      setSelectedInterviewers([]);
      setAddingPanel(false);
    } catch (err) {
      if (axios.isAxiosError(err)) {
        setFormError((err.response?.data as { error?: string })?.error ?? 'Failed to create panel');
      } else {
        setFormError('Something went wrong');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-sm border-b-2 border-stamp border-2" />
      </div>
    );
  }

  if (!position) {
    return <div className="text-red-500">Position not found</div>;
  }

  return (
    <div>
      {/* Breadcrumb */}
      <button
        onClick={() => router.push('/positions')}
        className="mb-4 inline-flex items-center gap-1 text-[14px] font-display font-semibold tracking-wide text-ink/60 hover:text-ink/80"
      >
        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        Projects & Roles
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">{position.title}</h1>
          {position.description && (
            <p className="text-[14px] font-display font-semibold tracking-wide text-ink/60 mt-1">{position.description}</p>
          )}
          <span
            className={`mt-2 inline-flex items-center rounded-sm px-2.5 py-0.5 text-xs font-bold ${
 position.status === 'OPEN'
 ? 'bg-green-100 text-green-700'
 : 'bg-clay/10 text-ink/70'
 }`}
          >
            {position.status}
          </span>
        </div>
        <button
          id="add-panel-btn"
          onClick={() => setAddingPanel(true)}
          className="inline-flex items-center gap-2 rounded-sm bg-stamp px-4 py-2 text-[14px] font-display font-semibold tracking-wide font-bold text-paper hover:bg-blue-700 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Add Panel
        </button>
      </div>

      {/* Add Panel Form */}
      {addingPanel && (
        <div className="mb-6 rounded-sm border-2 border-ink bg-paper p-6">
          <h2 className="text-base font-bold text-ink mb-4">Add Meeting Panel</h2>
          {formError && (
            <div className="mb-4 rounded-sm bg-red-50 border border-red-200 px-4 py-3 text-[14px] font-display font-semibold tracking-wide text-red-700">
              {formError}
            </div>
          )}
          <form onSubmit={handleAddPanel} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[14px] font-display font-semibold tracking-wide font-bold text-ink mb-1.5">Panel Title *</label>
                <input
                  id="panel-title"
                  type="text"
                  required
                  value={panelTitle}
                  onChange={(e) => setPanelTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 border-2 border-ink rounded-sm text-[14px] font-display font-semibold tracking-wide focus:outline-none focus:ring-2 focus:ring-stamp/30 focus:border-stamp border-2"
                  placeholder="e.g. Technical Sync"
                />
              </div>
              <div>
                <label className="block text-[14px] font-display font-semibold tracking-wide font-bold text-ink mb-1.5">Duration (minutes) *</label>
                <input
                  id="panel-duration"
                  type="number"
                  required
                  min={15}
                  max={240}
                  value={panelDuration}
                  onChange={(e) => setPanelDuration(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 border-2 border-ink rounded-sm text-[14px] font-display font-semibold tracking-wide focus:outline-none focus:ring-2 focus:ring-stamp/30 focus:border-stamp border-2"
                />
              </div>
            </div>

            <div>
              <label className="block text-[14px] font-display font-semibold tracking-wide font-bold text-ink mb-1.5">Slug (URL identifier) *</label>
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-display font-semibold tracking-wide text-ink/50">/panel/</span>
                <input
                  id="panel-slug"
                  type="text"
                  required
                  value={panelSlug}
                  onChange={(e) => setPanelSlug(e.target.value)}
                  className="flex-1 px-3.5 py-2.5 border-2 border-ink rounded-sm text-[14px] font-display font-semibold tracking-wide focus:outline-none focus:ring-2 focus:ring-stamp/30 focus:border-stamp border-2"
                  placeholder="technical-interview"
                />
              </div>
            </div>

            <div>
              <label className="block text-[14px] font-display font-semibold tracking-wide font-bold text-ink mb-2">
                Team Members ({selectedInterviewers.length} selected)
              </label>
              {interviewers.length === 0 ? (
                <p className="text-[14px] font-display font-semibold tracking-wide text-ink/50">No team members registered yet.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto border-2 border-ink rounded-sm p-2">
                  {interviewers.map((iv) => (
                    <label
                      key={iv.id}
                      className="flex items-center gap-3 p-2 rounded-sm hover:bg-clay/5 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedInterviewers.includes(iv.id)}
                        onChange={() => toggleInterviewer(iv.id)}
                        className="h-4 w-4 rounded border-ink border-2 text-stamp focus:ring-stamp"
                      />
                      <div>
                        <div className="text-[14px] font-display font-semibold tracking-wide font-bold text-ink">{iv.name}</div>
                        <div className="text-xs text-ink/60">{iv.email}</div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                id="panel-submit"
                disabled={submitting}
                className="rounded-sm bg-stamp px-4 py-2 text-[14px] font-display font-semibold tracking-wide font-bold text-paper hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Creating…' : 'Create Panel'}
              </button>
              <button
                type="button"
                onClick={() => setAddingPanel(false)}
                className="rounded-sm border-2 border-ink px-4 py-2 text-[14px] font-display font-semibold tracking-wide font-bold text-ink/80 hover:bg-clay/5"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Panels List */}
      <h2 className="text-base font-bold text-ink mb-3">
        Panels ({position.panels?.length ?? 0})
      </h2>

      {!position.panels?.length ? (
        <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-ink border-2 py-16 text-center">
          <span className="material-symbols-outlined text-4xl text-clay/50 mb-3">groups</span>
          <p className="text-ink/60 font-medium">No panels yet</p>
          <p className="text-ink/50 text-[14px] font-display font-semibold tracking-wide mt-1">Add a panel to assign team members</p>
        </div>
      ) : (
        <div className="space-y-3">
          {position.panels.map((panel) => (
            <div
              key={panel.id}
              className="rounded-sm border-2 border-ink bg-paper p-5"
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-base font-bold text-ink">{panel.title}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[14px] font-display font-semibold tracking-wide text-ink/60">{panel.duration} min</span>
                    <span className="text-clay/50">·</span>
                    <span className="font-mono text-xs text-ink/50">/panel/{panel.slug}</span>
                    <span className="text-clay/50">·</span>
                    <span
                      className={`text-xs font-bold ${
 panel.isActive ? 'text-green-600' : 'text-ink/50'
 }`}
                    >
                      {panel.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                <a
                  href={`/panel/${panel.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-stamp font-bold hover:underline"
                >
                  <span className="material-symbols-outlined text-[14px] font-display font-semibold tracking-wide">open_in_new</span>
                  Booking page
                </a>
              </div>

              {/* Interviewers */}
              <div className="flex flex-wrap gap-2 mt-3">
                {panel.interviewers?.map((pi) => (
                  <div
                    key={pi.id}
                    className="inline-flex items-center gap-1.5 rounded-sm bg-clay/10 px-3 py-1 text-xs font-bold text-ink/80"
                  >
                    <span className="material-symbols-outlined text-[14px] font-display font-semibold tracking-wide text-ink/50">person</span>
                    {pi.user.name}
                  </div>
                ))}
                {!panel.interviewers?.length && (
                  <span className="text-xs text-ink/50">No team members assigned</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Candidates Section (Admin only) */}
      {user?.role === 'ADMIN' && (
        <div className="mt-10">
          <h2 className="text-base font-bold text-ink mb-3">
            Invitees ({candidates.length})
          </h2>
          
          {!candidates.length ? (
            <div className="rounded-sm border border-dashed border-ink border-2 py-12 text-center bg-clay/5">
              <span className="material-symbols-outlined text-4xl text-clay/50 mb-2">person_search</span>
              <p className="text-ink/60 font-medium">No invitees yet</p>
              <p className="text-ink/50 text-[14px] font-display font-semibold tracking-wide mt-1">Invitees who book panels will appear here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {candidates.map((candidate, idx) => (
                <div key={idx} className="rounded-sm border-2 border-ink bg-paper overflow-hidden">
                  <div className="px-5 py-4 border-b border-ink border-2 bg-clay/5/50">
                    <h3 className="text-[14px] font-display font-semibold tracking-wide font-bold text-ink">{candidate.inviteeName}</h3>
                    <p className="text-xs text-ink/60">{candidate.inviteeEmail}</p>
                  </div>
                  <div className="p-5">
                    <h4 className="text-xs font-bold text-ink/50 uppercase tracking-wider mb-3">Meeting History</h4>
                    <div className="space-y-4">
                      {candidate.interviews.map(interview => (
                        <div key={interview.bookingId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-sm bg-clay/5 border-2 border-ink">
                          <div>
                            <div className="text-[14px] font-display font-semibold tracking-wide font-bold text-ink/90">{interview.panelTitle}</div>
                            <div className="text-xs text-ink/60 mt-0.5">
                              {new Date(interview.startTime).toLocaleString(undefined, {
                                month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
                              })}
                            </div>
                            {interview.status !== 'SCHEDULED' && (
                              <span className={`inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded-sm ${
 interview.status === 'CANCELLED' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
 }`}>
                                {interview.status}
                              </span>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <div className="flex flex-col items-center justify-center bg-green-50 text-green-700 rounded-sm px-3 py-1.5 min-w-[64px] border border-green-100">
                              <span className="text-lg font-bold">{interview.feedbackCounts.STRONG_YES}</span>
                              <span className="text-[9px] font-bold uppercase tracking-wider">Strong Yes</span>
                            </div>
                            <div className="flex flex-col items-center justify-center bg-emerald-50 text-sage rounded-sm px-3 py-1.5 min-w-[64px] border border-emerald-100">
                              <span className="text-lg font-bold">{interview.feedbackCounts.YES}</span>
                              <span className="text-[9px] font-bold uppercase tracking-wider">Yes</span>
                            </div>
                            <div className="flex flex-col items-center justify-center bg-orange-50 text-orange-700 rounded-sm px-3 py-1.5 min-w-[64px] border border-orange-100">
                              <span className="text-lg font-bold">{interview.feedbackCounts.NO}</span>
                              <span className="text-[9px] font-bold uppercase tracking-wider">No</span>
                            </div>
                            <div className="flex flex-col items-center justify-center bg-red-50 text-red-700 rounded-sm px-3 py-1.5 min-w-[64px] border border-red-100">
                              <span className="text-lg font-bold">{interview.feedbackCounts.STRONG_NO}</span>
                              <span className="text-[9px] font-bold uppercase tracking-wider">Strong No</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
