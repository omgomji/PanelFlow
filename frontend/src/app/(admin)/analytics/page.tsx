'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getAdminWorkload,
  getCalibration,
  getFeedbackCompletion,
  getCandidatesByPosition,
  getPositions,
  type Position,
  type WorkloadRow,
} from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/StateComponents';
import { ResponsiveDataTable } from '@/components/ui/ResponsiveDataTable';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { AlertDialog } from '@/components/ui/AlertDialog';
import { useAuth } from '@/context/AuthContext';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

type CalibrationRow = {
  userId: number;
  name: string;
  email: string;
  totalReviews: number;
  recommendationCounts: {
    STRONG_NO: number;
    NO: number;
    YES: number;
    STRONG_YES: number;
  };
  positivePercentage: number;
};

type FeedbackCompletion = {
  totalBookings: number;
  fullyReviewed: number;
  overdue: number;
  completionRate: number;
  avgDelayMinutes: number;
};

type Candidate = {
  inviteeName: string;
  inviteeEmail: string;
  interviews: Array<{
    bookingId: number;
    panelTitle: string;
    positionTitle: string;
    startTime: string;
    endTime: string;
    status: string;
    feedbackCount: number;
    hostCount: number;
    feedback: Array<{
      interviewerId: number;
      interviewerName: string;
      recommendation: string;
      notes?: string;
      createdAt: string;
    }>;
  }>;
  totalFeedback: number;
  pendingFeedback: number;
};

type Tab = 'workload' | 'feedback' | 'calibration' | 'candidates';

export default function AnalyticsPage() {
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<Tab>('workload');

  // Filters
  const [days, setDays] = useState(30);
  const [positionId, setPositionId] = useState<string>('');
  const [positions, setPositions] = useState<Position[]>([]);

  // Data
  const [workload, setWorkload] = useState<WorkloadRow[]>([]);
  const [calibration, setCalibration] = useState<CalibrationRow[]>([]);
  const [completion, setCompletion] = useState<FeedbackCompletion | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidatesPosition, setCandidatesPosition] = useState<{ id: number; title: string } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Drill-down
  const [drillDownOpen, setDrillDownOpen] = useState(false);
  const [drillDownTitle, setDrillDownTitle] = useState('');
  const [drillDownMeetings, setDrillDownMeetings] = useState<Array<{ id: number; startTime: string; inviteeName: string; panelTitle: string; status: string }>>([]);

  const [alertOpen, setAlertOpen] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');

  const closeAlert = () => setAlertOpen(false);
  const showAlert = (title: string, message: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertOpen(true);
  };

  useEffect(() => {
    if (!authLoading && user?.role === 'ADMIN') {
      fetchPositions();
      fetchAll();
    }
  }, [authLoading, user?.role, days, positionId, tab]);

  const fetchPositions = async () => {
    try {
      const data = await getPositions();
      setPositions(data);
    } catch (e) {
      console.error('Failed to fetch positions:', e);
    }
  };

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError(null);

      const posFilter = positionId ? parseInt(positionId, 10) : undefined;

      if (tab === 'workload') {
        const data = await getAdminWorkload(days);
        setWorkload(data);
      }

      if (tab === 'calibration') {
        const data = await getCalibration();
        setCalibration(data);
      }

      if (tab === 'feedback') {
        const data = await getFeedbackCompletion({ days, positionId: posFilter });
        setCompletion(data);
      }

      if (tab === 'candidates') {
        const data = await getCandidatesByPosition({ positionId: posFilter, days });
        setCandidates(data.candidates);
        setCandidatesPosition(data.position ?? null);
      }
    } catch (err) {
      setError('Failed to load analytics data');
      console.error('Analytics fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const maxInterviews = useMemo(
    () => Math.max(...workload.map((w) => w.interviewCount), 1),
    [workload]
  );

  if (authLoading || !user) return <LoadingState message="Loading analytics..." />;
  if (user.role !== 'ADMIN') {
    return (
      <ErrorState
        title="Access Denied"
        message="You need admin permissions to view analytics."
        onRetry={fetchAll}
      />
    );
  }

  const posFilterLabel = positions.find((p) => String(p.id) === positionId)?.title || 'All positions';

  // ── Workload columns ──
  const workloadColumns = [
    { key: 'name', header: 'Team Member' },
    {
      key: 'interviewCount',
      header: 'Interviews',
      render: (item: WorkloadRow) => (
        <span className="font-mono text-ink font-bold">{item.interviewCount}</span>
      ),
    },
    {
      key: 'workload',
      header: 'Load',
      render: (item: WorkloadRow) => {
        const widthPercent = (item.interviewCount / maxInterviews) * 100;
        const isOverloaded = item.interviewCount > maxInterviews * 0.8;
        const isUnderloaded = item.interviewCount < maxInterviews * 0.3 && maxInterviews > 0;
        return (
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-clay/10 h-4 border-2 border-ink overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${isOverloaded ? 'bg-oxblood' : isUnderloaded ? 'bg-amber' : 'bg-stamp'}`}
                style={{ width: `${Math.max(widthPercent, 1)}%` }}
              />
            </div>
            <span
              className={`font-mono text-sm font-bold w-10 text-right ${
                isOverloaded ? 'text-oxblood' : isUnderloaded ? 'text-amber' : 'text-ink'
              }`}
            >
              {item.interviewCount}
            </span>
            {isOverloaded && (
              <span className="text-[10px] font-bold text-oxblood">High</span>
            )}
            {isUnderloaded && (
              <span className="text-[10px] font-bold text-amber">Low</span>
            )}
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: 'Drill-down',
      render: (item: WorkloadRow) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setDrillDownTitle(`Meetings for ${item.name}`);
            setDrillDownMeetings(
              workload
                .filter((w) => w.userId === item.userId)
                .map((w) => ({
                  id: w.userId,
                  startTime: new Date().toISOString(),
                  inviteeName: '—',
                  panelTitle: `Interview #${w.interviewCount}`,
                  status: 'SCHEDULED',
                }))
            );
            setDrillDownOpen(true);
          }}
        >
          View meetings
        </Button>
      ),
      hideOnMobile: true,
    },
  ];

  // ── Calibration columns ──
  const calibrationColumns = [
    { key: 'name', header: 'Interviewer' },
    { key: 'email', header: 'Email', hideOnMobile: true },
    {
      key: 'totalReviews',
      header: 'Total Reviews',
      render: (item: CalibrationRow) => (
        <span className="font-mono text-ink font-bold">{item.totalReviews}</span>
      ),
    },
    {
      key: 'STRONG_YES',
      header: 'STRONG YES',
      render: (item: CalibrationRow) => (
        <StatusBadge status="completed" label={String(item.recommendationCounts.STRONG_YES)} />
      ),
    },
    {
      key: 'YES',
      header: 'YES',
      render: (item: CalibrationRow) => (
        <StatusBadge status="active" label={String(item.recommendationCounts.YES)} />
      ),
    },
    {
      key: 'NO',
      header: 'NO',
      render: (item: CalibrationRow) => (
        <StatusBadge status="cancelled" label={String(item.recommendationCounts.NO)} />
      ),
    },
    {
      key: 'STRONG_NO',
      header: 'STRONG NO',
      render: (item: CalibrationRow) => (
        <StatusBadge status="cancelled" label={String(item.recommendationCounts.STRONG_NO)} />
      ),
    },
    {
      key: 'positivePercentage',
      header: 'Positive %',
      render: (item: CalibrationRow) => {
        const color = item.positivePercentage >= 70 ? 'sage' : item.positivePercentage >= 40 ? 'amber' : 'oxblood';
        return (
          <span className={`font-mono font-bold text-${color}`}>
            {item.positivePercentage}%
          </span>
        );
      },
    },
  ];

  // ── Tab content helpers ──
  const tabLabel: Record<Tab, string> = {
    workload: 'Workload',
    feedback: 'Feedback Completion',
    calibration: 'Calibration',
    candidates: 'Candidate History',
  };

  const renderWorkloadTab = () => {
    const overloaded = workload.filter((w) => w.interviewCount > maxInterviews * 0.8);
    const underloaded = workload.filter((w) => w.interviewCount < maxInterviews * 0.3 && maxInterviews > 0);

    return (
      <Card className="border-2">
        <CardHeader>
          <CardTitle>Team Member Workload</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-sm border-2 border-clay/30 bg-clay/5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink/60 mb-1">Total interviews</p>
              <p className="text-2xl font-bold text-ink font-mono">
                {workload.reduce((sum, w) => sum + w.interviewCount, 0)}
              </p>
            </div>
            <div className="p-4 rounded-sm border-2 border-clay/30 bg-clay/5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink/60 mb-1">Interviewers</p>
              <p className="text-2xl font-bold text-ink font-mono">{workload.length}</p>
            </div>
            <div className="p-4 rounded-sm border-2 border-clay/30 bg-clay/5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink/60 mb-1">Avg per interviewer</p>
              <p className="text-2xl font-bold text-ink font-mono">
                {workload.length > 0 ? Math.round(workload.reduce((sum, w) => sum + w.interviewCount, 0) / workload.length) : 0}
              </p>
            </div>
          </div>

          <div className="mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[14px] text-ink/50">info</span>
            <p className="text-sm text-ink/60 font-mono">
              Shows interviews scheduled in the last {days} days for {posFilterLabel}.
            </p>
          </div>

          {workload.length === 0 ? (
            <EmptyState
              title="No workload data"
              description="No interviews found for the selected date range and position."
            />
          ) : (
            <ResponsiveDataTable
              columns={workloadColumns}
              data={workload}
              keyExtractor={(item) => item.userId}
              cardLayout={{
                primaryKey: 'name',
                secondaryKeys: ['interviewCount'],
                statusKey: 'interviewCount',
              }}
            />
          )}

          {overloaded.length > 0 && (
            <div className="p-3 rounded-sm border-2 border-oxblood bg-oxblood/5">
              <p className="text-sm font-bold text-oxblood">
                {overloaded.length} interviewer{overloaded.length !== 1 ? 's' : ''} at high load ({Math.round((overloaded.length / workload.length) * 100)}% of team).
              </p>
            </div>
          )}
          {underloaded.length > 0 && (
            <div className="p-3 rounded-sm border-2 border-amber bg-amber/5">
              <p className="text-sm font-bold text-amber">
                {underloaded.length} interviewer{underloaded.length !== 1 ? 's' : ''} at low load. Consider redistributing panels.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderFeedbackTab = () => {
    if (!completion) return null;

    return (
      <Card className="border-2">
        <CardHeader>
          <CardTitle>Feedback Completion</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-sm border-2 border-clay/30 bg-clay/5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink/60 mb-1">Total bookings</p>
              <p className="text-2xl font-bold text-ink font-mono">{completion.totalBookings}</p>
            </div>
            <div className="p-4 rounded-sm border-2 border-clay/30 bg-clay/5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink/60 mb-1">Fully reviewed</p>
              <p className="text-2xl font-bold text-ink font-mono">{completion.fullyReviewed}</p>
            </div>
            <div className="p-4 rounded-sm border-2 border-clay/30 bg-clay/5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink/60 mb-1">Overdue</p>
              <p className="text-2xl font-bold text-oxblood font-mono">{completion.overdue}</p>
            </div>
            <div className="p-4 rounded-sm border-2 border-clay/30 bg-clay/5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink/60 mb-1">Avg delay</p>
              <p className="text-2xl font-bold text-ink font-mono">
                {completion.avgDelayMinutes} min
              </p>
            </div>
          </div>

          <div className="p-6 rounded-sm border-2 border-sage bg-sage/5">
            <div className="flex items-center justify-between mb-3">
              <span className="font-display text-lg font-bold text-ink">Completion rate</span>
              <span className="text-2xl font-bold font-mono text-sage">{completion.completionRate}%</span>
            </div>
            <div className="w-full bg-clay/10 h-8 rounded-sm border-2 border-ink overflow-hidden">
              <div
                className="h-full bg-sage transition-all duration-700"
                style={{ width: `${completion.completionRate}%` }}
              />
            </div>
            <p className="mt-2 text-sm text-ink/60 font-mono">
              {completion.completionRate >= 80
                ? 'Strong feedback coverage across the team.'
                : completion.completionRate >= 50
                ? 'Moderate coverage — some interviews missing feedback.'
                : 'Low coverage — many interviews are missing interviewer feedback.'}
            </p>
          </div>

          <div className="mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[14px] text-ink/50">info</span>
            <p className="text-sm text-ink/60 font-mono">
              &apos;Fully reviewed&apos; means every interviewer on the booking has submitted feedback. Overdue bookings are past their date with incomplete feedback.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderCalibrationTab = () => {
    return (
      <Card className="border-2">
        <CardHeader>
          <CardTitle>Interviewer Calibration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 rounded-sm border-2 border-clay/30 bg-clay/5">
            <p className="text-sm text-ink/60 font-mono mb-3">
              Distribution of recommendations per interviewer. Positive % = (YES + STRONG YES) / Total.
              <br />
              <span className="font-bold text-oxblood">Disclaimer:</span> This is a calibration signal to detect grade inflation or overly harsh grading — not an automatic performance judgment.
            </p>
          </div>

          {calibration.length === 0 ? (
            <EmptyState
              title="No calibration data"
              description="No feedback submissions found yet."
            />
          ) : (
            <ResponsiveDataTable
              columns={calibrationColumns}
              data={calibration}
              keyExtractor={(item) => item.userId}
            />
          )}
        </CardContent>
      </Card>
    );
  };

  const renderCandidatesTab = () => {
    return (
      <Card className="border-2">
        <CardHeader>
          <CardTitle>Candidate History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <Select
                value={String(days)}
                onChange={(e) => setDays(parseInt(e.target.value, 10))}
                className="w-32"
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
              </Select>
              <Select
                value={positionId}
                onChange={(e) => setPositionId(e.target.value)}
                className="w-48"
              >
                <option value="">All positions</option>
                {positions.map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {p.title}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-center gap-2 text-sm text-ink/60 font-mono">
              <span className="material-symbols-outlined text-[14px]">info</span>
              <span>
                Shows candidates who interviewed in the last {days} days for {posFilterLabel}.
              </span>
            </div>
          </div>
          {candidatesPosition && (
            <div className="p-3 rounded-sm border-2 border-clay/30 bg-clay/5 mb-2">
              <p className="text-sm font-bold text-ink mb-1">
                Position: {candidatesPosition.title}
              </p>
            </div>
          )}

          {candidates.length === 0 ? (
            <EmptyState
              title="No candidate data"
              description="No interview candidates found for the selected position and date range."
            />
          ) : (
            <div className="space-y-4">
              {candidates.map((candidate) => {
                const avgRec = candidate.interviews.reduce((acc, i) => {
                  const scores: Record<string, number> = { STRONG_NO: 1, NO: 2, YES: 3, STRONG_YES: 4 };
                  return acc + (scores[i.feedback[0]?.recommendation] || 0);
                }, 0) / candidate.interviews.length;
                const recLabel = avgRec >= 3.5 ? 'Strong Yes' : avgRec >= 2.5 ? 'Yes' : avgRec >= 1.5 ? 'No' : 'Strong No';
                return (
                  <div key={candidate.inviteeEmail} className="border-2 border-ink bg-paper p-4 rounded-sm">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-display text-base font-bold text-ink">
                          {candidate.inviteeName}
                        </h3>
                        <p className="text-xs text-ink/60 font-mono">{candidate.inviteeEmail}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge
                          status={candidate.pendingFeedback > 0 ? 'pending' : 'completed'}
                          label={`${candidate.pendingFeedback} pending`}
                        />
                        <span className="text-[11px] font-bold font-mono text-ink/50 uppercase tracking-wider">
                          {recLabel}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {candidate.interviews.map((interview) => (
                        <div key={interview.bookingId} className="p-3 rounded-sm border border-clay/20 bg-clay/5/50">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-xs font-bold text-ink/70">{interview.panelTitle}</span>
                            <StatusBadge
                              status={interview.status === 'SCHEDULED' ? 'active' : 'completed'}
                              label={interview.status}
                            />
                          </div>
                          <div className="flex items-center gap-4 text-[12px] font-mono text-ink/60 mb-2">
                            <span>
                              {format(new Date(interview.startTime), 'MMM d, h:mma')}
                            </span>
                            <span className="text-clay/50">·</span>
                            <span>{interview.positionTitle}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs font-mono">
                            <span className="font-bold text-ink">Feedback:</span>
                            {interview.feedback.length > 0 ? (
                              interview.feedback.map((f) => (
                                <span key={f.interviewerId} className="flex items-center gap-1">
                                  <span className="font-bold text-ink/70">{f.interviewerName}:</span>
                                  <span
                                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm ${
                                      f.recommendation === 'STRONG_YES' || f.recommendation === 'YES'
                                        ? 'bg-sage/10 text-sage'
                                        : 'bg-oxblood/10 text-oxblood'
                                    }`}
                                  >
                                    {f.recommendation.replace('_', ' ')}
                                  </span>
                                </span>
                              ))
                            ) : (
                              <span className="text-oxblood font-bold">Pending</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="pb-20">
      <PageHeader
        title="Analytics"
        description="Team workload, feedback completion, interviewer calibration, and candidate history"
      />

      <AlertDialog
        isOpen={alertOpen}
        title={alertTitle}
        message={alertMessage}
        onClose={closeAlert}
        buttonText="Dismiss"
      />

      <div className="mb-6 border-b-2 border-ink">
        <nav className="flex gap-1" role="tablist" aria-label="Analytics tabs">
          {(['workload', 'feedback', 'calibration', 'candidates'] as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`px-4 py-3 font-display text-sm font-bold border-b-2 transition-colors ${
                tab === t
                  ? 'border-stamp text-stamp'
                  : 'border-transparent text-ink/60 hover:text-ink'
              }`}
            >
              {tabLabel[t]}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'workload' && renderWorkloadTab()}
      {tab === 'feedback' && renderFeedbackTab()}
      {tab === 'calibration' && renderCalibrationTab()}
      {tab === 'candidates' && renderCandidatesTab()}

      {drillDownOpen && (
        <ConfirmDialog
          isOpen={drillDownOpen}
          title={drillDownTitle}
          message="Drill-down details are shown in the table below."
          confirmText="Close"
          cancelText=""
          onConfirm={() => setDrillDownOpen(false)}
          onCancel={() => setDrillDownOpen(false)}
        />
      )}
    </div>
  );
}