'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Switch } from '@/components/ui/Switch';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';

export interface PanelDrawerData {
  title: string;
  slug: string;
  duration: number;
  isActive: boolean;
  interviewerIds: number[];
}

interface PanelDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: PanelDrawerData) => void;
  initialData?: Partial<PanelDrawerData>;
  interviewers: Array<{ id: number; name: string; email: string }>;
}

const DURATION_OPTIONS = [15, 30, 45, 60, 90];

export default function PanelDrawer({
  isOpen,
  onClose,
  onSave,
  initialData,
  interviewers,
}: PanelDrawerProps) {
  const isEditing = Boolean(initialData?.title);
  const { showToast } = useToast();

  const [title, setTitle] = useState(initialData?.title ?? '');
  const [slug, setSlug] = useState(initialData?.slug ?? '');
  const [duration, setDuration] = useState(initialData?.duration ?? 45);
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);
  const [selectedInterviewers, setSelectedInterviewers] = useState<number[]>(initialData?.interviewerIds ?? []);

  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setTitle(initialData?.title ?? '');
    setSlug(initialData?.slug ?? '');
    setDuration(initialData?.duration ?? 45);
    setIsActive(initialData?.isActive ?? true);
    setSelectedInterviewers(initialData?.interviewerIds ?? []);
    setSlugManuallyEdited(false);
    setErrors({});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialData?.title, initialData?.slug]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) newErrors.title = 'Title is required';
    if (!slug.trim()) newErrors.slug = 'Slug is required';
    else if (!/^[a-z0-9-]+$/.test(slug)) newErrors.slug = 'Slug can only contain lowercase letters, numbers, and hyphens';
    if (selectedInterviewers.length === 0) newErrors.interviewers = 'Select at least one interviewer';

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

  const toggleInterviewer = (userId: number) => {
    setSelectedInterviewers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
    setErrors((prev) => ({ ...prev, interviewers: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      const finalSlug = slug.trim() || title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

      onSave({
        title: title.trim(),
        slug: finalSlug,
        duration,
        isActive,
        interviewerIds: selectedInterviewers,
      });

      showToast({
        title: isEditing ? 'Panel updated' : 'Panel created',
        message: `Panel “${title}” is ${isActive ? 'live' : 'inactive'}.`,
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
      <div
        className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="fixed right-0 top-0 w-full max-w-md h-screen z-50 bg-paper shadow-2xl overflow-y-auto flex flex-col">
        <div className="sticky top-0 bg-paper border-b border-ink border-2 p-4 flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-medium font-bold text-ink/60 uppercase tracking-wider mb-1">
              {isEditing ? 'Edit Panel' : 'Create Panel'}
            </div>
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-sm bg-pine/10 flex items-center justify-center text-pine shrink-0">
                <span className="material-symbols-outlined text-[18px] font-display font-semibold tracking-wide">groups</span>
              </div>
              <input
                id="panel-title"
                type="text"
                required
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="e.g. Technical Sync"
                className={`w-full bg-transparent text-[18px] font-bold text-ink outline-none placeholder:text-clay/40 ${errors.title ? 'border-b border-oxblood border-2' : ''}`}
                aria-label="Panel name"
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

        <form id="panel-drawer-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-5">
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
                /panel/
              </span>
              <input
                type="text"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="panel-slug"
                className="flex-1 bg-transparent px-2.5 py-2 text-[13px] font-medium text-ink/90 outline-none"
                aria-label="Panel Slug"
              />
            </div>
            <p className="mt-1 text-[11px] font-medium text-ink/50">
              Public booking URL: <code className="text-ink font-bold">/panel/{slug}</code>
            </p>
          </div>

          {/* Duration */}
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
          </div>

          {/* Interviewers */}
          <div className="border-b border-ink border-2 pb-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-[12px] font-medium font-bold text-ink/70">Interviewers</span>
                {errors.interviewers && (
                  <span className="ml-2 text-[11px] font-medium text-oxblood">error</span>
                )}
              </div>
              <span className="text-[11px] font-medium text-stamp">{selectedInterviewers.length} selected</span>
            </div>
            {interviewers.length === 0 ? (
              <div className="rounded-sm border-2 border-dashed border-ink bg-clay/5 p-4 text-center">
                <span className="material-symbols-outlined text-3xl text-clay/50 mb-2">person_off</span>
                <p className="text-[12px] font-medium text-ink/60">No team members available</p>
                <p className="text-[11px] font-medium text-ink/50 mt-1">
                  Add interviewers first to assign them to this panel.
                </p>
              </div>
            ) : (
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {interviewers.map((iv) => (
                  <label
                    key={iv.id}
                    className="flex items-center gap-3 p-2.5 rounded-sm hover:bg-clay/5 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedInterviewers.includes(iv.id)}
                      onChange={() => toggleInterviewer(iv.id)}
                      className="h-4 w-4 rounded border-ink border-2 text-stamp focus:ring-stamp"
                    />
                    <div className="flex-1">
                      <div className="text-[13px] font-medium text-ink">{iv.name}</div>
                      <div className="text-[11px] text-ink/50">{iv.email}</div>
                    </div>
                    <span className={`text-[11px] font-bold rounded-sm px-1.5 py-0.5 ${
                      selectedInterviewers.includes(iv.id) ? 'bg-stamp text-paper' : 'bg-clay/5 text-ink/50'
                    }`}>
                      {selectedInterviewers.includes(iv.id) ? 'Added' : 'Add'}
                    </span>
                  </label>
                ))}
              </div>
            )}
            {selectedInterviewers.length === 0 && interviewers.length > 0 && (
              <p className="mt-2 text-[11px] font-bold text-oxblood">
                Select at least one interviewer to accept bookings.
              </p>
            )}
          </div>

          {/* Active toggle */}
          <div className="border-b border-ink border-2 pb-4">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium font-bold text-ink/70">Active</span>
              <Switch
                checked={isActive}
                onCheckedChange={setIsActive}
                aria-label="Toggle panel active"
              />
            </div>
            <p className="mt-1 text-[11px] font-medium text-ink/60">
              {isActive ? 'Candidates can book this panel' : 'Panel is hidden from booking page'}
            </p>
          </div>

          <div className="pt-4">
            <Button
              type="submit"
              form="panel-drawer-form"
              disabled={submitting}
              className="w-full py-3 px-6 text-[13px] font-medium font-bold text-paper uppercase tracking-wider"
            >
              {submitting ? 'Saving…' : isEditing ? 'Save changes' : 'Create panel'}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
