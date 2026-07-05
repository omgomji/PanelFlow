'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getEventTypes, deleteEventType, createEventType, updateEventType, getPublicProfile, getAdminWorkload } from '@/lib/api';
import type { EventType, EventTypePayload } from '@/types/event-types';
import type { WorkloadRow } from '@/lib/api';
import EventCard from '@/components/EventCard';
import EventDrawer from '@/components/EventDrawer';
import SingleUseLinkDrawer from '@/components/SingleUseLinkDrawer';
import MeetingPollDrawer from '@/components/MeetingPollDrawer';
import CreateMenuPopover from '@/components/ui/CreateMenuPopover';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { AlertDialog } from '@/components/ui/AlertDialog';
import { Input } from '@/components/ui/Input';
import { Tabs, TabsTrigger } from '@/components/ui/Tabs';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';

type EventTypeUpsert = EventTypePayload;

export default function Dashboard() {
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventDrawerOpen, setEventDrawerOpen] = useState(false);
  const [singleUseLinkDrawerOpen, setSingleUseLinkDrawerOpen] = useState(false);
  const [meetingPollDrawerOpen, setMeetingPollDrawerOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventType | null>(null);
  const [activeTab, setActiveTab] = useState('Event types');
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEventIds, setSelectedEventIds] = useState<number[]>([]);
  const [bulkToggleMenuOpen, setBulkToggleMenuOpen] = useState(false);

  const [publicUsername, setPublicUsername] = useState<string | null>(null);
  const [workload, setWorkload] = useState<WorkloadRow[]>([]);
  const createMenuRef = useRef<HTMLDivElement | null>(null);
  const bulkToggleRef = useRef<HTMLDivElement | null>(null);
  const { user } = useAuth();

  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [alertInfo, setAlertInfo] = useState({ isOpen: false, title: '', message: '' });

  const showAlert = (title: string, message: string) => setAlertInfo({ isOpen: true, title, message });
  const closeAlert = () => setAlertInfo(prev => ({ ...prev, isOpen: false }));

  const tabs = ['Event types', 'Single-use links', 'Meeting polls'];

  const searchPlaceholder = useMemo(() => {
    if (activeTab === 'Meeting polls') return 'Search meeting polls';
    if (activeTab === 'Single-use links') return 'Search single-use links';
    return 'Search event types...';
  }, [activeTab]);

  useEffect(() => {
    fetchEventTypes();
    fetchPublicUsername();
    if (user?.role === 'ADMIN') {
      fetchWorkload();
    }

    const handleOpenCreate = () => {
      setEditingEvent(null);
      setEventDrawerOpen(true);
    };

    const handleOpenSingleUseLinks = () => {
      setActiveTab('Single-use links');
      setSingleUseLinkDrawerOpen(true);
      setCreateMenuOpen(false);
    };

    const handleOpenMeetingPolls = () => {
      setActiveTab('Meeting polls');
      setMeetingPollDrawerOpen(true);
      setCreateMenuOpen(false);
    };

    window.addEventListener('open-create-event', handleOpenCreate);
    window.addEventListener('open-single-use-links', handleOpenSingleUseLinks);
    window.addEventListener('open-meeting-polls', handleOpenMeetingPolls);

    return () => {
      window.removeEventListener('open-create-event', handleOpenCreate);
      window.removeEventListener('open-single-use-links', handleOpenSingleUseLinks);
      window.removeEventListener('open-meeting-polls', handleOpenMeetingPolls);
    };
  }, [user?.role]);

  useEffect(() => {
    if (!createMenuOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCreateMenuOpen(false);
    };

    const onPointerDown = (e: MouseEvent | PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (createMenuRef.current && !createMenuRef.current.contains(target)) {
        setCreateMenuOpen(false);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [createMenuOpen]);

  useEffect(() => {
    if (!bulkToggleMenuOpen) return;

    const onPointerDown = (e: MouseEvent | PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (bulkToggleRef.current && !bulkToggleRef.current.contains(target)) {
        setBulkToggleMenuOpen(false);
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [bulkToggleMenuOpen]);

  const fetchEventTypes = async () => {
    try {
      setLoading(true);
      const data = await getEventTypes();
      setEventTypes(data);
    } catch (error) {
      console.error('Error fetching event types:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPublicUsername = async () => {
    const defaultUsername = user?.username || 'om';
    try {
      const profile = await getPublicProfile(defaultUsername);
      setPublicUsername(profile.user.username || defaultUsername);
    } catch {
      setPublicUsername(defaultUsername);
    }
  };

  const fetchWorkload = async () => {
    try {
      const data = await getAdminWorkload(30);
      setWorkload(data);
    } catch (e) {
      console.error('Error fetching workload:', e);
    }
  };

  const handleDelete = (id: number) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (deleteConfirmId !== null) {
      try {
        await deleteEventType(deleteConfirmId);
        fetchEventTypes();
      } catch (error) {
        console.error('Error deleting event type:', error);
      } finally {
        setDeleteConfirmId(null);
      }
    }
  };

  const handleToggleSelection = (event: EventType) => {
    setSelectedEventIds((prev) =>
      prev.includes(event.id) ? prev.filter((id) => id !== event.id) : [...prev, event.id]
    );
  };

  const handleBulkDelete = () => {
    if (selectedEventIds.length === 0) return;
    setBulkDeleteConfirmOpen(true);
  };

  const confirmBulkDelete = async () => {
    setBulkDeleteConfirmOpen(false);
    try {
      await Promise.all(selectedEventIds.map((id) => deleteEventType(id)));
      setSelectedEventIds([]);
      await fetchEventTypes();
    } catch (error) {
      console.error('Error deleting selected event types:', error);
      showAlert('Error', 'Failed to delete one or more selected event types.');
    }
  };

  const handleBulkToggleActive = async (nextValue: boolean) => {
    const selectedEvents = eventTypes.filter((event) => selectedEventIds.includes(event.id));
    if (selectedEvents.length === 0) return;

    try {
      await Promise.all(
        selectedEvents.map((event) =>
          updateEventType(event.id, {
            title: event.title,
            slug: event.slug,
            duration: event.duration,
            description: event.description || '',
            isActive: nextValue,
          })
        )
      );
      setBulkToggleMenuOpen(false);
      await fetchEventTypes();
    } catch (error) {
      console.error('Error toggling selected event types:', error);
      showAlert('Error', 'Failed to update one or more selected event types.');
    }
  };

  const handleEdit = (event: EventType) => {
    setEditingEvent(event);
    setEventDrawerOpen(true);
  };

  const handleBookMeeting = (event: EventType) => {
    const defaultUsername = user?.name?.toLowerCase().replace(/\s+/g, '') || 'admin';
    const username = publicUsername || defaultUsername;
    const url = event.bookingUrl || `${window.location.origin}/${username}/${event.slug}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCreateSingleUseLink = () => {
    setActiveTab('Single-use links');
    setSingleUseLinkDrawerOpen(true);
  };

  const handleDuplicate = async (event: EventType) => {
    const existingSlugs = new Set(eventTypes.map((e) => e.slug));
    const baseSlug = `${event.slug}-copy`;
    let nextSlug = baseSlug;
    let n = 2;

    while (existingSlugs.has(nextSlug)) {
      nextSlug = `${baseSlug}-${n}`;
      n += 1;
    }

    try {
      await createEventType({
        title: `${event.title} (Copy)`,
        slug: nextSlug,
        duration: event.duration,
        description: event.description || '',
        isActive: event.isActive ?? true,
      });
      await fetchEventTypes();
    } catch (error) {
      console.error('Error duplicating event type:', error);
      showAlert('Error', 'Failed to duplicate event type. Please try again.');
    }
  };

  const handleToggleActive = async (event: EventType, nextValue: boolean) => {
    try {
      await updateEventType(event.id, {
        title: event.title,
        slug: event.slug,
        duration: event.duration,
        description: event.description || '',
        isActive: nextValue,
      });
      await fetchEventTypes();
    } catch (error) {
      console.error('Error updating event status:', error);
      showAlert('Error', 'Failed to update status. Please try again.');
    }
  };

  const handleCreateEventType = () => {
    setCreateMenuOpen(false);
    setActiveTab('Event types');
    setEditingEvent(null);
    setEventDrawerOpen(true);
  };

  const handleSave = async (data: EventTypeUpsert) => {
    try {
      if (editingEvent) {
        await updateEventType(editingEvent.id, data);
      } else {
        await createEventType(data);
      }
      setEventDrawerOpen(false);
      setEditingEvent(null);
      fetchEventTypes();
    } catch (error) {
      console.error('Error saving event type:', error);
      showAlert('Error', 'Failed to save event type. Please try again.');
    }
  };

  const visibleEventTypes = useMemo(
    () =>
      eventTypes.filter((e) => {
        if (!searchTerm.trim()) return true;
        const q = searchTerm.trim().toLowerCase();
        return String(e.title ?? '').toLowerCase().includes(q) || String(e.slug ?? '').toLowerCase().includes(q);
      }),
    [eventTypes, searchTerm]
  );

  useEffect(() => {
    if (selectedEventIds.length === 0) return;
    const existingIds = new Set(eventTypes.map((event) => event.id));
    setSelectedEventIds((prev) => prev.filter((id) => existingIds.has(id)));
  }, [eventTypes, selectedEventIds.length]);

  useEffect(() => {
    if (activeTab !== 'Event types') {
      setSelectedEventIds([]);
      setBulkToggleMenuOpen(false);
    }
  }, [activeTab]);

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="mt-2 mb-6 flex flex-col gap-3 sm:mt-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="font-display text-[28px] font-bold text-ink">Scheduling</h1>

        <div className="relative" ref={createMenuRef}>
          <Button
            type="button"
            onClick={() => setCreateMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={createMenuOpen}
          >
            <span className="material-symbols-outlined text-[18px] mr-2">add</span>
            Create
            <span className="material-symbols-outlined text-[18px] ml-2">keyboard_arrow_down</span>
          </Button>

          {createMenuOpen && (
            <div role="menu" aria-label="Create menu" className="absolute right-0 mt-2 z-50 border-2 border-ink bg-paper shadow-sm">
              <CreateMenuPopover
                onCreateEventType={handleCreateEventType}
                onCreateSingleUseLink={() => {
                  setCreateMenuOpen(false);
                  setActiveTab('Single-use links');
                }}
                onCreateMeetingPoll={() => {
                  setCreateMenuOpen(false);
                  setActiveTab('Meeting polls');
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        {tabs.map((tab) => (
          <TabsTrigger key={tab} value={tab} activeValue={activeTab} onActiveChange={setActiveTab}>
            {tab}
          </TabsTrigger>
        ))}
      </Tabs>

      {/* Search + (optional) filter */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full max-w-md">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-ink/50 text-[20px]">
            search
          </span>
          <Input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-10"
          />
        </div>

        {activeTab === 'Meeting polls' && (
          <Button variant="secondary" className="gap-2">
            <span className="material-symbols-outlined text-[18px]">filter_list</span>
            Filter
            <span className="material-symbols-outlined text-[18px]">keyboard_arrow_down</span>
          </Button>
        )}
      </div>

      {/* User Context Line (Event types) */}
      {activeTab === 'Event types' && (
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center border-2 border-ink bg-paper font-display text-[11px] font-bold text-ink">
              {user?.name ? user.name.slice(0, 2).toUpperCase() : 'U'}
            </div>
            <span className="font-display text-[14px] font-bold text-ink">{user?.name || 'User'}</span>
          </div>

          {publicUsername && (
            <Link
              href={`/${publicUsername}`}
              target="_blank"
              className="flex items-center gap-1.5 self-start font-display text-[14px] font-bold text-stamp hover:underline"
            >
              View landing page
              <span className="material-symbols-outlined text-[16px]">open_in_new</span>
            </Link>
          )}
        </div>
      )}

      {activeTab === 'Event types' && selectedEventIds.length > 0 && (
        <div className="mb-6 border-2 border-ink bg-clay/5 px-4 py-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 font-display text-[14px] font-bold text-ink">
              <span className="inline-flex h-6 w-6 items-center justify-center border-2 border-ink bg-stamp text-[12px] text-paper">
                {selectedEventIds.length}
              </span>
              <span>SELECTED</span>
            </div>

            <Button
              variant="danger"
              size="sm"
              onClick={handleBulkDelete}
              className="gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">delete</span>
              DELETE
            </Button>

            <div className="relative" ref={bulkToggleRef}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setBulkToggleMenuOpen((v) => !v)}
                className="gap-2"
              >
                TOGGLE ON/OFF
                <span className="material-symbols-outlined text-[18px]">keyboard_arrow_down</span>
              </Button>

              {bulkToggleMenuOpen && (
                <div className="absolute left-0 top-full z-20 mt-2 w-40 overflow-hidden border-2 border-ink bg-paper shadow-sm">
                  <button
                    type="button"
                    className="w-full px-4 py-2 text-left font-display text-[14px] font-bold text-ink hover:bg-clay/10"
                    onClick={() => handleBulkToggleActive(true)}
                  >
                    TURN ON
                  </button>
                  <button
                    type="button"
                    className="w-full px-4 py-2 text-left font-display text-[14px] font-bold text-ink hover:bg-clay/10"
                    onClick={() => handleBulkToggleActive(false)}
                  >
                    TURN OFF
                  </button>
                </div>
              )}
            </div>



            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedEventIds([]);
                setBulkToggleMenuOpen(false);
              }}
              className="sm:ml-auto"
              aria-label="Clear selection"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </Button>
          </div>
        </div>
      )}

      {/* Tab Content */}
      {activeTab === 'Event types' && (
        <>
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-stamp" />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {eventTypes.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {visibleEventTypes.map((event) => (
                    <EventCard
                      key={event.id}
                      id={event.id}
                      title={event.title}
                      slug={event.slug}
                      duration={event.duration}
                      description={event.description}
                      bookingUrl={event.bookingUrl}
                      publicUsername={publicUsername ?? undefined}
                      isActive={event.isActive ?? true}
                      onDelete={handleDelete}
                      onEdit={handleEdit}
                      onBookMeeting={handleBookMeeting}
                      onCreateSingleUseLink={handleCreateSingleUseLink}
                      onDuplicate={handleDuplicate}
                      onToggleActive={handleToggleActive}
                      onSelect={handleToggleSelection}
                      selected={selectedEventIds.includes(event.id)}
                    />
                  ))}
                </div>
              ) : (
                <Card className="border-dashed py-20 text-center">
                  <p className="font-display font-medium text-ink/70">No event types found.</p>
                  <Button
                    type="button"
                    onClick={handleCreateEventType}
                    className="mt-6 gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    Create event type
                  </Button>
                </Card>
              )}
            </div>
          )}
        </>
      )}

      {activeTab === 'Single-use links' && (
        <Card className="mt-8 bg-clay/5 p-8">
          <CardTitle>Share one-time booking links</CardTitle>
          <p className="mt-2 max-w-2xl text-[14px] text-ink/70">
            Single-use links let you generate a one-off scheduling link without creating a permanent event type.
          </p>
          <div className="mt-6">
            <Button type="button" onClick={handleCreateSingleUseLink} className="gap-2">
              <span className="material-symbols-outlined text-[18px]">add</span>
              Create single-use link
            </Button>
          </div>
        </Card>
      )}

      {activeTab === 'Meeting polls' && (
        <Card className="mt-6 overflow-hidden bg-clay/5 p-8">
          <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-2">
            <div>
              <CardTitle>Find the best time for everyone</CardTitle>
              <p className="mt-2 text-[14px] text-ink/70">
                Gather everyone’s availability to pick the best time for the group. Track votes as they come in, and book the most popular time.
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-4">
                <Button onClick={() => setMeetingPollDrawerOpen(true)} className="gap-2">
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  Create meeting poll
                </Button>
              </div>
            </div>

            <div className="flex justify-center md:justify-end">
              <div className="flex h-[180px] w-[240px] items-center justify-center border-2 border-ink bg-paper">
                <span className="material-symbols-outlined text-[64px] text-stamp">calendar_month</span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Workload Widget (Admin Only) */}
      {user?.role === 'ADMIN' && (
        <Card className="mt-10 mb-8 max-w-3xl border-2">
          <CardHeader>
            <CardTitle>Team Member Workload</CardTitle>
          </CardHeader>
          <p className="text-sm font-mono text-ink/70 mb-6 uppercase tracking-wider">Number of meetings per team member over the last 30 days.</p>
          
          <CardContent className="space-y-4">
            {workload.length === 0 ? (
              <p className="text-sm font-mono italic text-ink/60">No team members found.</p>
            ) : (
              (() => {
                const maxCount = Math.max(...workload.map(w => w.interviewCount), 1);
                return workload.map((row) => {
                  const widthPercent = (row.interviewCount / maxCount) * 100;
                  
                  return (
                    <div key={row.userId} className="flex items-center gap-4 border-b border-clay/20 pb-4 last:border-0 last:pb-0">
                      <div className="w-32 shrink-0">
                        <div className="font-display text-sm font-bold text-ink truncate">{row.name}</div>
                      </div>
                      <div className="flex-1 bg-clay/10 h-6 relative border-2 border-ink overflow-hidden">
                        <div 
                          className="absolute top-0 left-0 h-full bg-stamp transition-all duration-500"
                          style={{ width: `${Math.max(widthPercent, 1)}%` }}
                        />
                      </div>
                      <div className="w-8 shrink-0 text-right">
                        <span className="font-mono text-sm font-bold text-ink">{row.interviewCount}</span>
                      </div>
                    </div>
                  );
                });
              })()
            )}
          </CardContent>
        </Card>
      )}

      <EventDrawer
        isOpen={eventDrawerOpen}
        onClose={() => {
          setEventDrawerOpen(false);
          setEditingEvent(null);
        }}
        onSave={handleSave}
        initialData={
          editingEvent
            ? {
                title: editingEvent.title,
                duration: editingEvent.duration,
                slug: editingEvent.slug,
                description: editingEvent.description ?? '',
                isActive: editingEvent.isActive ?? true,
              }
            : undefined
        }
      />

      <SingleUseLinkDrawer
        isOpen={singleUseLinkDrawerOpen}
        onClose={() => setSingleUseLinkDrawerOpen(false)}
        onSave={() => setSingleUseLinkDrawerOpen(false)}
      />

      <MeetingPollDrawer
        isOpen={meetingPollDrawerOpen}
        onClose={() => setMeetingPollDrawerOpen(false)}
        onSave={() => setMeetingPollDrawerOpen(false)}
      />

      <ConfirmDialog
        isOpen={deleteConfirmId !== null}
        title="Delete Event Type"
        message="Are you sure you want to delete this event type?"
        confirmText="Delete"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirmId(null)}
      />

      <ConfirmDialog
        isOpen={bulkDeleteConfirmOpen}
        title="Delete Selected"
        message={`Delete ${selectedEventIds.length} selected event type(s)?`}
        confirmText="Delete All"
        variant="danger"
        onConfirm={confirmBulkDelete}
        onCancel={() => setBulkDeleteConfirmOpen(false)}
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
