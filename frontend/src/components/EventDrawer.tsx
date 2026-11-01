'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
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

  // Controlled state
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

  // Reset form whenever initialData changes (create vs edit)
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
      setSlug(value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
    }
    setErrors((prev) => ({ ...prev, title: '' }));
  };

  const handleSlugChange = (value: string) => {
    setSlug(value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
    setSlugManuallyEdited(true);
    setErrors((prev) => ({ ...prev, slug: '' }));
  };

  const toggleSection = (section: string, setExpandedSections: React.Dispatch<React.SetStateAction<Record<string, boolean>>>) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const finalSlug = slug.trim() || title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

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
    } catch (err: any) {
      showToast({
        title: 'Failed to save',
        message: err?.response?.data?.error || 'Something went wrong. Please try again.',
        type: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Right Drawer */}
      <div className="fixed right-0 top-0 w-full max-w-md h-screen z-50 bg-paper shadow-2xl overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="sticky top-0 bg-paper border-b border-ink border-2 p-4 flex items-center justify-between">
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
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="New meeting"
                className={`w-full bg-transparent text-[18px] font-bold text-ink outline-none placeholder:text-clay/40 ${errors.title ? 'border-b border-oxblood border-2' : ''}`}
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

        {/* Content */}
        <form id="event-drawer-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-5">

          {/* Slug field */}
          <div className="border-b border-ink border-2 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <label className="text-[12px] font-medium font-bold text-ink/70">URL Slug</label>
              {errors.slug && (
                <span className="text-[11px] font-medium text-oxblood">error</span>
              )}
            </div>
            <div className="flex items-center rounded-sm border-2 border-ink bg-clay/5 overflow-hidden">
              <span className="px-2.5 py-2 text-[12px] font-medium text-ink/50 border-r border-ink border-2 whitespace-nowrap">
                /{'{'}username{'}'}/
              </span>
              <input
                type="text"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="event-slug"
                className="flex-1 bg-transparent px-2.5 py-2 text-[13px] font-medium text-ink/90 outline-none"
                aria-label="URL Slug"
              />
            </div>
            <p className="mt-1 text-[11px] font-medium text-ink/50">
              Public booking URL will be <code className="text-ink font-bold">/{slug}</code>
            </p>
          </div>

          {/* Description */}
          <div className="border-b border-ink border-2 pb-4">
            <label className="block text-[12px] font-medium font-bold text-ink/70 mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what this meeting is for..."
              rows={3}
              className="w-full rounded-sm border-2 border-ink bg-clay/5 px-3 py-2 text-[13px] font-medium text-ink/90 outline-none focus:border-stamp border-2 resize-none"
            />
          </div>

          {/* Duration Section */}
          <div className="border-b border-ink border-2 pb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-medium font-bold text-ink/70">Duration</span>
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
            <p className="mt-1 text-[11px] font-medium text-ink/50">
              Length of each booking slot
            </p>
          </div>

          {/* Location Section */}
          <div className="border-b border-ink border-2 pb-4">
            <label className="block text-[12px] font-medium font-bold text-ink/70 mb-2">Location (optional)</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={LOCATION_PLACEHOLDER}
              className="w-full rounded-sm border-2 border-ink bg-clay/5 px-3 py-2 text-[13px] font-medium text-ink/90 outline-none focus:border-stamp border-2"
            />
            <p className="mt-1 text-[11px] font-medium text-ink/50">
              Where the meeting will take place (Zoom link, room number, etc.)
            </p>
          </div>

          {/* Buffer Times Section */}
          <div className="grid grid-cols-2 gap-3 border-b border-ink border-2 pb-4">
            <div className="space-y-2">
              <label className="text-[12px] font-medium font-bold text-ink/70">Buffer Before</label>
              <input
                type="number"
                value={bufferBefore}
                onChange={(e) => setBufferBefore(Number(e.target.value) || 0)}
                min={0}
                max={1440}
                className="w-full rounded-sm border-2 border-ink bg-clay/5 px-3 py-2 text-[13px] font-medium text-ink/90 outline-none focus:border-stamp border-2"
              />
              <p className="text-[11px] font-medium text-ink/50">min before</p>
            </div>
            <div className="space-y-2">
              <label className="text-[12px] font-medium font-bold text-ink/70">Buffer After</label>
              <input
                type="number"
                value={bufferAfter}
                onChange={(e) => setBufferAfter(Number(e.target.value) || 0)}
                min={0}
                max={1440}
                className="w-full rounded-sm border-2 border-ink bg-clay/5 px-3 py-2 text-[13px] font-medium text-ink/90 outline-none focus:border-stamp border-2"
              />
              <p className="text-[11px] font-medium text-ink/50">min after</p>
            </div>
          </div>

          {/* Active toggle */}
          <div className="border-b border-ink border-2 pb-4">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium font-bold text-ink/70">Active</span>
              <Switch
                checked={isActive}
                onCheckedChange={setIsActive}
                aria-label="Toggle event active"
              />
            </div>
            <p className="mt-1 text-[11px] font-medium text-ink/60">
              {isActive ? 'Invitees can book this event' : 'Event is hidden from booking page'}
            </p>
          </div>

          {/* Submit */}
          <div className="pt-4">
            <Button
              type="submit"
              form="event-drawer-form"
              disabled={submitting}
              className="w-full py-3 px-6 text-[13px] font-medium font-bold text-paper uppercase tracking-wider"
            >
              {submitting ? 'Saving…' : isEditing ? 'Save changes' : 'Create event type'}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
