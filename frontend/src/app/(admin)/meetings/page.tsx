'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { getMeetings, cancelMeeting, markNoShow } from '@/lib/api';
import type { MeetingRecord } from '@/types/booking';
import { Pagination } from '@/components/ui/Pagination';

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { AlertDialog } from '@/components/ui/AlertDialog';

import { DataTable, DataTableHeader, DataTableBody, DataTableRow, DataTableHead, DataTableCell } from '@/components/ui/DataTable';
import { StampChip } from '@/components/ui/StampChip';

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<MeetingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [markingNoShowId, setMarkingNoShowId] = useState<number | null>(null);

  const [cancelConfirmId, setCancelConfirmId] = useState<number | null>(null);
  const [noShowConfirmId, setNoShowConfirmId] = useState<number | null>(null);
  const [alertInfo, setAlertInfo] = useState({ isOpen: false, title: '', message: '' });
  const showAlert = (title: string, message: string) => setAlertInfo({ isOpen: true, title, message });
  const closeAlert = () => setAlertInfo(prev => ({ ...prev, isOpen: false }));
  const [activeTab, setActiveTab] = useState('Upcoming');
  const [showBufferTime, setShowBufferTime] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<'My PanelFlow' | 'Team booking page'>('My PanelFlow');
  const [showDateRangePicker, setShowDateRangePicker] = useState(false);
  const [baseMonth, setBaseMonth] = useState(startOfMonth(new Date()));
  const [selectedPreset, setSelectedPreset] = useState<'Today' | 'This week' | 'This month' | 'All time'>('Today');
  const [appliedRange, setAppliedRange] = useState<{ start: Date | null; end: Date | null }>({
    start: startOfDay(new Date()),
    end: startOfDay(new Date()),
  });
  const [draftRange, setDraftRange] = useState<{ start: Date | null; end: Date | null }>({
    start: startOfDay(new Date()),
    end: startOfDay(new Date()),
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const dateRangeRef = useRef<HTMLDivElement | null>(null);

  const tabs = ['Upcoming', 'Past', 'Date Range'];

  const weekDays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  useEffect(() => {
    fetchMeetings(activeTab, page, appliedRange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!dateRangeRef.current?.contains(event.target as Node)) {
        setShowDateRangePicker(false);
      }
    };

    if (showDateRangePicker) {
      document.addEventListener('mousedown', handleOutsideClick);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showDateRangePicker]);

  const fetchMeetings = async (currentTab = activeTab, pageToFetch = page, range = appliedRange) => {
    try {
      setLoading(true);
      const tab = currentTab;
      const statusParam = tab === 'Upcoming' ? 'upcoming' : tab === 'Past' ? 'past' : undefined;
      
      let from, to;
      if (tab === 'Date Range') {
        from = range.start?.toISOString();
        to = range.end?.toISOString();
      }

      const { data, meta } = await getMeetings({
        status: statusParam,
        page: pageToFetch,
        limit: 10,
        from,
        to,
      });
      setMeetings(data);
      setTotalPages(meta.totalPages);
      setTotalItems(meta.total);
    } catch (error) {
      console.error('Error fetching meetings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelMeetingClick = (meetingId: number) => {
    setCancelConfirmId(meetingId);
  };

  const handleCancelMeetingConfirm = async () => {
    if (cancelConfirmId === null) return;
    const meetingId = cancelConfirmId;
    setCancelConfirmId(null);

    const reason = window.prompt('Reason for cancellation (optional):') || undefined;

    try {
      setCancellingId(meetingId);
      await cancelMeeting(meetingId, reason);
      setMeetings((prev) =>
        prev.map((meeting) =>
          meeting.id === meetingId ? { ...meeting, status: 'CANCELLED', cancellationReason: reason } : meeting
        )
      );
      if (activeTab === 'Upcoming') {
        setTotalItems((prev) => Math.max(0, prev - 1));
        if (meetings.length === 1 && page > 1) {
          setPage(page - 1);
        }
      }
    } catch (error) {
      console.error('Error cancelling meeting:', error);
      showAlert('Error', 'Failed to cancel meeting. Please try again.');
    } finally {
      setCancellingId(null);
    }
  };

  const handleMarkNoShowClick = (meetingId: number) => {
    setNoShowConfirmId(meetingId);
  };

  const handleMarkNoShowConfirm = async () => {
    if (noShowConfirmId === null) return;
    const meetingId = noShowConfirmId;
    setNoShowConfirmId(null);

    try {
      setMarkingNoShowId(meetingId);
      await markNoShow(meetingId);
      setMeetings((prev) =>
        prev.map((meeting) =>
          meeting.id === meetingId ? { ...meeting, status: 'NO_SHOW' } : meeting
        )
      );
    } catch (error) {
      console.error('Error marking no-show:', error);
      showAlert('Error', 'Failed to mark as no-show. Please try again.');
    } finally {
      setMarkingNoShowId(null);
    }
  };

  const getPresetRange = (preset: 'Today' | 'This week' | 'This month' | 'All time') => {
    const today = startOfDay(new Date());

    if (preset === 'Today') {
      return { start: today, end: today };
    }

    if (preset === 'This week') {
      return {
        start: startOfWeek(today, { weekStartsOn: 0 }),
        end: endOfWeek(today, { weekStartsOn: 0 }),
      };
    }

    if (preset === 'This month') {
      return {
        start: startOfMonth(today),
        end: endOfMonth(today),
      };
    }

    return { start: null, end: null };
  };

  const handlePresetSelect = (preset: 'Today' | 'This week' | 'This month' | 'All time') => {
    setSelectedPreset(preset);
    const range = getPresetRange(preset);
    setDraftRange(range);
    setBaseMonth(startOfMonth(range.start ?? new Date()));
  };

  const handleDateSelection = (date: Date) => {
    setSelectedPreset('All time');

    if (!draftRange.start || (draftRange.start && draftRange.end)) {
      setDraftRange({ start: date, end: null });
      return;
    }

    if (!draftRange.end) {
      if (isBefore(date, draftRange.start)) {
        setDraftRange({ start: date, end: draftRange.start });
      } else {
        setDraftRange({ start: draftRange.start, end: date });
      }
    }
  };

  const openDateRangePicker = () => {
    setActiveTab('Date Range');
    setShowDateRangePicker(true);
    setDraftRange(appliedRange);
    setBaseMonth(startOfMonth((appliedRange.start ?? new Date())));
  };

  const applyDateRange = () => {
    setAppliedRange(draftRange);
    setShowDateRangePicker(false);
    setPage(1);
    void fetchMeetings('Date Range', 1, draftRange);
  };

  const cancelDateRange = () => {
    setDraftRange(appliedRange);
    setShowDateRangePicker(false);
  };

  const isInSelectedRange = (date: Date) => {
    if (!draftRange.start || !draftRange.end) return false;
    return (
      (isAfter(date, draftRange.start) || isSameDay(date, draftRange.start)) &&
      (isBefore(date, draftRange.end) || isSameDay(date, draftRange.end))
    );
  };

  const buildMonthGrid = (month: Date) => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    const daysInMonth = eachDayOfInterval({ start, end });
    const leadingOffset = start.getDay();

    return [
      ...Array.from({ length: leadingOffset }, () => null),
      ...daysInMonth,
    ];
  };

  const leftMonthDays = useMemo(() => buildMonthGrid(baseMonth), [baseMonth]);
  const rightMonth = useMemo(() => addMonths(baseMonth, 1), [baseMonth]);
  const rightMonthDays = useMemo(() => buildMonthGrid(rightMonth), [rightMonth]);

  const filteredMeetings = meetings;
  const totalCount = totalItems;
  const displayStart = totalCount === 0 ? 0 : (page - 1) * 10 + 1;
  const displayEnd = Math.min(page * 10, totalCount);

  return (
    <div className="pb-20 pt-4">
      <div className="mb-4 flex items-center gap-2">
        <h1 className="font-display text-[28px] font-bold text-ink">Meetings ({totalCount})</h1>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-6">
        <Button
          variant={sourceFilter === 'My PanelFlow' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setSourceFilter('My PanelFlow')}
        >
          My PanelFlow
        </Button>

        <div className="flex items-center gap-3">
          <span className="font-display text-sm font-bold text-ink">Show buffer time</span>
          <Switch checked={showBufferTime} onCheckedChange={setShowBufferTime} />
        </div>
      </div>

      <div className="relative border-2 border-ink bg-paper shadow-sm" ref={dateRangeRef}>
        <div className="flex flex-col gap-3 border-b-2 border-ink px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-6 overflow-x-auto pb-1">
            {tabs.map((tab) => {
              if (tab === 'Date Range') {
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={openDateRangePicker}
                    className={`relative inline-flex items-center gap-1 font-display text-sm font-bold uppercase tracking-wider ${
 activeTab === tab ? 'text-ink' : 'text-ink/60 hover:text-ink'
 }`}
                  >
                    {tab}
                    <span className="material-symbols-outlined text-[16px]">
                      {showDateRangePicker ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
                    </span>
                    {activeTab === tab && <span className="absolute -bottom-[14px] left-0 right-0 h-[2px] bg-ink" />}
                  </button>
                );
              }

              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab);
                    setShowDateRangePicker(false);
                    setPage(1);
                    void fetchMeetings(tab, 1, appliedRange);
                  }}
                  className={`relative font-display text-sm font-bold uppercase tracking-wider ${
 activeTab === tab ? 'text-ink' : 'text-ink/60 hover:text-ink'
 }`}
                >
                  {tab}
                  {activeTab === tab && <span className="absolute -bottom-[14px] left-0 right-0 h-[2px] bg-ink" />}
                </button>
              );
            })}
          </div>


        </div>

        {showDateRangePicker && (
          <div className="border-b-2 border-ink bg-clay/5 p-6">
            <div className="border-2 border-ink bg-paper p-6">
            <div className="mb-4 flex items-center gap-5 overflow-x-auto border-b-2 border-clay/30 pb-3 font-display text-[12px] font-bold uppercase tracking-wider text-stamp whitespace-nowrap">
              {(['Today', 'This week', 'This month', 'All time'] as const).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handlePresetSelect(preset)}
                  className={`${selectedPreset === preset ? 'text-stamp' : 'text-ink/60 hover:text-ink'}`}
                >
                  {preset}
                </button>
              ))}
            </div>

            <div className="flex items-start justify-between gap-2 sm:gap-4">
              <button
                type="button"
                onClick={() => setBaseMonth(subMonths(baseMonth, 1))}
                className="mt-1 inline-flex h-8 w-8 items-center justify-center border-2 border-transparent hover:border-ink"
                aria-label="Previous month"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_left</span>
              </button>

              <div className="grid flex-1 grid-cols-1 gap-2 sm:gap-6 md:grid-cols-2 md:gap-8">
                {[{ month: baseMonth, days: leftMonthDays }, { month: rightMonth, days: rightMonthDays }].map(
                  ({ month, days }) => (
                    <div key={month.toISOString()}>
                      <h3 className="mb-4 text-center font-display text-[20px] font-bold leading-none text-ink">
                        {format(month, 'MMMM yyyy')}
                      </h3>

                      <div className="mb-2 grid grid-cols-7 gap-x-1 text-center font-display text-[10px] font-bold uppercase tracking-widest text-ink/70">
                        {weekDays.map((day) => (
                          <span key={`${month.toISOString()}-${day}`} className="truncate">{day}</span>
                        ))}
                      </div>

                      <div className="grid grid-cols-7 gap-x-1 gap-y-1 text-center font-mono">
                        {days.map((date, index) => {
                          if (!date) {
                            return <span key={`${month.toISOString()}-empty-${index}`} className="h-8" />;
                          }

                          const isStart = draftRange.start ? isSameDay(date, draftRange.start) : false;
                          const isEnd = draftRange.end ? isSameDay(date, draftRange.end) : false;
                          const isSingle = Boolean(draftRange.start && draftRange.end && isStart && isEnd);
                          const inRange = isInSelectedRange(date);

                          return (
                            <button
                              key={date.toISOString()}
                              type="button"
                              onClick={() => handleDateSelection(startOfDay(date))}
                              className={`mx-auto inline-flex h-8 w-8 items-center justify-center text-[12px] font-bold leading-none sm:h-9 sm:w-9 ${
 isStart || isEnd
 ? 'bg-stamp text-paper'
 : inRange
 ? 'bg-stamp/10 text-stamp'
 : 'text-ink hover:bg-clay/20'
 } ${isSingle ? 'ring-0' : ''}`}
                            >
                              {format(date, 'd')}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )
                )}
              </div>

              <button
                type="button"
                onClick={() => setBaseMonth(addMonths(baseMonth, 1))}
                className="mt-1 inline-flex h-8 w-8 items-center justify-center border-2 border-transparent hover:border-ink"
                aria-label="Next month"
              >
                <span className="material-symbols-outlined text-[18px]">chevron_right</span>
              </button>
            </div>

            <div className="mt-8 flex items-center justify-center gap-6">
              <Button variant="ghost" onClick={cancelDateRange}>
                CANCEL
              </Button>
              <Button onClick={applyDateRange}>
                APPLY
              </Button>
            </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-ink/70 bg-paper border-b-2 border-ink">
          DISPLAYING {displayStart} - {displayEnd} OF {totalCount} EVENTS
        </div>

        <div className="min-h-[310px] bg-paper">
          {loading ? (
            <div className="flex h-[260px] items-center justify-center">
              <div className="h-7 w-7 animate-spin rounded-full border-b-2 border-stamp" />
            </div>
          ) : totalCount > 0 ? (
            <DataTable>
              <DataTableHeader>
                <DataTableRow>
                  <DataTableHead>Date & Time</DataTableHead>
                  <DataTableHead>Invitee</DataTableHead>
                  <DataTableHead>Event Type</DataTableHead>
                  <DataTableHead>Status</DataTableHead>
                  <DataTableHead className="text-right">Actions</DataTableHead>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {filteredMeetings.map((meeting) => {
                  const isCancelled = meeting.status === 'CANCELLED';
                  const isNoShow = meeting.status === 'NO_SHOW';
                  const isUpcoming = new Date(meeting.startTime).getTime() >= Date.now();
                  const canCancel = isUpcoming && !isCancelled && !isNoShow;
                  const canMarkNoShow = !isUpcoming && !isCancelled && !isNoShow;

                  return (
                    <DataTableRow key={meeting.id}>
                      <DataTableCell className="font-mono">
                        {new Date(meeting.startTime).toLocaleString()}
                      </DataTableCell>
                      <DataTableCell className="font-bold">
                        {meeting.inviteeName || 'Invitee'}
                      </DataTableCell>
                      <DataTableCell>
                        {meeting.eventType?.title || 'Meeting'}
                      </DataTableCell>
                      <DataTableCell>
                        {isCancelled ? (
                          <div className="flex flex-col gap-1">
                            <StampChip status="STRONG_NO" />
                            {meeting.cancellationReason && (
                              <span className="text-[10px] text-ink/60">Reason: {meeting.cancellationReason}</span>
                            )}
                          </div>
                        ) : isNoShow ? (
                          <StampChip status="NO" />
                        ) : (
                          <StampChip status="CONFIRMED" />
                        )}
                      </DataTableCell>
                      <DataTableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {canCancel && meeting.uid && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => window.open(`/reschedule/${meeting.uid}`, '_blank')}
                            >
                              RESCHEDULE
                            </Button>
                          )}
                          
                          {canCancel && (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleCancelMeetingClick(meeting.id)}
                              disabled={cancellingId === meeting.id}
                            >
                              {cancellingId === meeting.id ? 'CANCELLING...' : 'CANCEL'}
                            </Button>
                          )}
                          
                          {canMarkNoShow && (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleMarkNoShowClick(meeting.id)}
                              disabled={markingNoShowId === meeting.id}
                            >
                              {markingNoShowId === meeting.id ? 'MARKING...' : 'MARK NO-SHOW'}
                            </Button>
                          )}


                        </div>
                      </DataTableCell>
                    </DataTableRow>
                  );
                })}
              </DataTableBody>
            </DataTable>
          ) : (
            <div className="flex h-[260px] flex-col items-center justify-center text-center">
              <span className="material-symbols-outlined text-[48px] text-clay/60 mb-4">calendar_month</span>

              <h2 className="font-display text-[18px] font-bold text-ink">No Events Yet</h2>
              <p className="mt-2 text-sm text-ink/70 max-w-sm mx-auto">
                Share your link to your event types to start receiving bookings.
              </p>

              <Button className="mt-6" onClick={() => window.location.href = "/"}>
                VIEW EVENT TYPES
              </Button>
            </div>
          )}
          {totalCount > 0 && (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={cancelConfirmId !== null}
        title="Cancel Meeting"
        message="Are you sure you want to cancel this meeting?"
        confirmText="Cancel Meeting"
        variant="danger"
        onConfirm={handleCancelMeetingConfirm}
        onCancel={() => setCancelConfirmId(null)}
      />

      <ConfirmDialog
        isOpen={noShowConfirmId !== null}
        title="Mark No-Show"
        message="Are you sure you want to mark this meeting as a no-show?"
        confirmText="Mark No-Show"
        variant="danger"
        onConfirm={handleMarkNoShowConfirm}
        onCancel={() => setNoShowConfirmId(null)}
      />

      <AlertDialog
        isOpen={alertInfo.isOpen}
        title={alertInfo.title}
        message={alertInfo.message}
        onClose={closeAlert}
      />
    </div>
  );
}
