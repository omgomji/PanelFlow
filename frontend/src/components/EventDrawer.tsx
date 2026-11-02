'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';

export interface EventDrawerData {
  title: string;
  duration: number;
  slug: string;
  description: string;
  isActive: boolean;
  location?: string;
  bufferBefore?: number;
  bufferAfter?: number;
}

interface EventDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: EventDrawerData) => void;
  initialData?: Partial<EventDrawerData>;
}

const DURATION_OPTIONS = [15, 30, 45, 60, 90];
const LOCATION_PLACEHOLDER = 'e.g. Zoom link, Conference Room A, or Google Meet';

export default function EventDrawer({
  isOpen,
  onClose,
  onSave,
  initialData,
}: EventDrawerProps) {
  const isEditing = Boolean(initialData?.title);
  const { showToast } = useToast();

  const [title, setTitle] = useState(initialData?.title ?? '');
  const [slug, setSlug] = useState(initialData?.slug ?? '');
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [duration, setDuration] = useState(initialData?.duration ?? 30);
  const [location, setLocation] = useState(initialData?.location ?? '');
  const [bufferBefore, setBufferBefore] = useState(initialData?.bufferBefore ?? 0);
  const [bufferAfter, setBufferAfter] = useState(initialData?.bufferAfter ?? 0);
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);

  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setTitle(initialData?.title ?? '');
    setSlug(initialData?.slug ?? '');
    setDescription(initialData?.description ?? '');
    setDuration(initialData?.duration ?? 30);
    setLocation(initialData?.location ?? '');
    setBufferBefore(initialData?.bufferBefore ?? 0);
    setBufferAfter(initialData?.bufferAfter ?? 0);
    setIsActive(initialData?.isActive ?? true);
    setSlugManuallyEdited(false);
    setErrors({});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialData?.title, initialData?.slug]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) newErrors.title = 'Title is required';
    if (!slug.trim()) newErrors.slug = 'Slug is required';
    else if (!/^[a-z0-9-]+$/.test(slug)) newErrors.slug = 'Slug can only contain lowercase letters, numbers, and hyphens';
    if (duration < 15 || duration > 480) newErrors.duration = 'Duration must be between 15 and 480 minutes';
    if (bufferBefore < 0 || bufferBefore > 1440) newErrors.bufferBefore = 'Buffer must be between 0 and 1440 minutes';
    if (bufferAfter < 0 || bufferAfter > 1440) newErrors.bufferAfter = 'Buffer must be between 0 and 1440 minutes';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!slugManuallyEdited) {
      setSlug(value.toLowerCase().replace(/\\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
    }
    setErrors((prev) => ({ ...prev, title: '' }));
  };

  const handleSlugChange = (value: string) => {
    setSlug(value.toLowerCase().replace(/\\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
    setSlugManuallyEdited(true);
    setErrors((prev) => ({ ...prev, slug: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const finalSlug = slug.trim() || title.toLowerCase().replace(/\\s+/g, '-').replace(/[^a-z0-9-]/g, '');

      onSave({
        title: title.trim(),
        duration,
        slug: finalSlug,
        description: description.trim(),
        isActive,
        location: location.trim() || undefined,
        bufferBefore,
        bufferAfter,
      });

      showToast({
        title: isEditing ? 'Event type updated' : 'Event type created',
        message: `Your event “${title}” is ${isActive ? 'live' : 'inactive'}.`,
        type: 'success',
      });

      onClose();
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Something went wrong. Please try again.';
      showToast({
        title: 'Failed to save',
        message,
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-md"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed right-0 top-0 w-full max-w-md h-screen z-50 bg-paper shadow-2xl overflow-y-auto flex flex-col border-l-2 border-ink ring-1 ring-ink/10">
        <div className="sticky top-0 bg-paper border-b-2 border-ink p-4 flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-medium font-bold text-ink/60 uppercase tracking-wider mb-1">
              {isEditing ? 'Edit Event Type' : 'Create Event Type'}
            </div>
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-sm bg-stamp/10 flex items-center justify-center text-stamp shrink-0">
                <span className="material-symbols-outlined text-[18px] font-display font-semibold tracking-wide">event</span>
              </div>
              <input
                id="event-title"
                type="text"
                required
                autoFocus
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="New meeting"
                className={`w-full bg-transparent text-[18px] font-bold text-ink outline-none placeholder:text-clay/40 border-b-2 border-b-transparent focus:border-b-stamp focus:ring-0 ${errors.title ? 'border-b-oxblood' : ''}`}
                aria-label="Meeting name"
              />
              {errors.title && (
                <p className="mt-1 text-[11px] font-medium text-oxblood">{errors.title}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-3 p-2 hover:bg-clay/10 rounded-sm transition-colors text-ink/70 shrink-0"
            aria-label="Close drawer"
          >
            <span className="material-symbols-outlined text-[20px] font-display font-semibold tracking-wide">close</span>
          </button>
        </div>

        <form id="event-drawer-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* URL Slug */}
          <section className="space-y-2 border-b-2 border-ink pb-4">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-medium font-bold text-ink/70 uppercase tracking-wider">URL Slug</label>
              {errors.slug && <span className="text-[10px] font-medium text-oxblood">error</span>}
            </div>
            <div className="flex items-center rounded-sm border-2 border-ink bg-clay/5 overflow-hidden">
              <span className="px-2.5 py-2 text-[11px] font-medium text-ink/50 border-r border-ink border-2 whitespace-nowrap">
                /{publicUsername()}/
              </span>
              <input
                type="text"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="event-slug"
                className="flex-1 bg-transparent px-2.5 py-2 text-[13px] font-medium text-ink/90 outline-none border-b-0"
                aria-label="URL Slug"
              />
            </div>
            <p className="mt-1 text-[10px] font-medium text-ink/40">
              Public booking URL will be <code className="text-ink font-bold">/{slug}</code>
            </p>
          </section>

          {/* Description */}
          <section className="space-y-2 border-b-2 border-ink pb-4">
            <label className="text-[11px] font-medium font-bold text-ink/70 uppercase tracking-wider">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this meeting is for..."
              rows={3}
              className="w-full rounded-sm border-2 border-ink bg-clay/5 px-3 py-2 text-[13px] font-medium text-ink/90 outline-none focus:border-stamp border-2 resize-none"
            />
          </section>

          {/* Duration */}
          <section className="space-y-2 border-b-2 border-ink pb-4">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-medium font-bold text-ink/70 uppercase tracking-wider">Duration</label>
              <span className="text-[11px] font-medium text-stamp">{duration} min</span>
            </div>
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="w-full px-3 py-2.5 border-2 border-ink rounded-sm text-[13px] font-medium focus:outline-none focus:border-stamp border-2"
            >
              {DURATION_OPTIONS.map((d) => (
                <option key={d} value={d}>{d} min</option>
              ))}
            </select>
            <p className="mt-1 text-[10px] font-medium text-ink/40">
              Length of each booking slot
            </p>
          </section>

          {/* Location */}
          <section className="space-y-2 border-b-2 border-ink pb-4">
            <label className="text-[11px] font-medium font-bold text-ink/70 uppercase tracking-wider">Location (optional)</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={LOCATION_PLACEHOLDER}
              className="w-full rounded-sm border-2 border-ink bg-clay/5 px-3 py-2 text-[13px] font-medium text-ink/90 outline-none focus:border-stamp border-2"
            />
            <p className="mt-1 text-[10px] font-medium text-ink/40">
              Where the meeting will take place (Zoom link, room number, etc.)
            </p>
          </section>

          {/* Buffer Times */}
          <section className="space-y-2 border-b-2 border-ink pb-4">
            <label className="text-[11px] font-medium font-bold text-ink/70 uppercase tracking-wider">Buffer Times</label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-ink/60 uppercase tracking-wider">Buffer Before</label>
                <input
                  type="number"
                  value={bufferBefore}
                  onChange={(e) => setBufferBefore(Number(e.target.value) || 0)}
                  min={0}
                  max={1440}
                  className="w-full rounded-sm border-2 border-ink bg-clay/5 px-3 py-2 text-[13px] font-medium text-ink/90 outline-none focus:border-stamp border-2"
                />
                <p className="text-[10px] font-medium text-ink/40">min before</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-ink/60 uppercase tracking-wider">Buffer After</label>
                <input
                  type="number"
                  value={bufferAfter}
                  onChange={(e) => setBufferAfter(Number(e.target.value) || 0)}
                  min={0}
                  max={1440}
                  className="w-full rounded-sm border-2 border-ink bg-clay/5 px-3 py-2 text-[13px] font-medium text-ink/90 outline-none focus:border-stamp border-2"
                />
                <p className="text-[10px] font-medium text-ink/40">min after</p>
              </div>
            </div>
          </section>

          {/* Active */}
          <section className="space-y-2 border-b-2 border-ink pb-4">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-medium font-bold text-ink/70 uppercase tracking-wider">Active</label>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm ${isActive ? 'bg-stamp/10 text-stamp' : 'bg-clay/5 text-clay'}`}>
                {isActive ? 'Live' : 'Inactive'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={isActive}
                onCheckedChange={setIsActive}
                aria-label="Toggle event active"
              />
            </div>
            <p className="mt-1 text-[10px] font-medium text-ink/40">
              {isActive ? 'Invitees can book this event' : 'Event is hidden from booking page'}
            </p>
          </section>

          {/* Submit */}
          <div className="pt-6">
            <Button
              type="submit"
              form="event-drawer-form"
              disabled={submitting}
              className="w-full py-3.5 px-6 text-[13px] font-medium font-bold text-paper uppercase tracking-wider"
            >
              {submitting ? 'Saving…' : isEditing ? 'Save changes' : 'Create event type'}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}

function publicUsername(): string {
  if (typeof window === 'undefined') return 'username';
  const path = window.location.pathname;
  const match = path.match(/^\/([^/]+)\/?$/);
  return match ? match[1] : 'username';
}
