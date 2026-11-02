'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { useToast } from '@/components/ui/Toast';

export interface PositionDrawerData {
  title: string;
  description: string;
  isActive: boolean;
}

interface PositionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: PositionDrawerData) => void;
  initialData?: Partial<PositionDrawerData>;
}

export default function PositionDrawer({
  isOpen,
  onClose,
  onSave,
  initialData,
}: PositionDrawerProps) {
  const isEditing = Boolean(initialData?.title);
  const { showToast } = useToast();

  const [title, setTitle] = useState(initialData?.title ?? '');
  const [description, setDescription] = useState(initialData?.description ?? '');
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setTitle(initialData?.title ?? '');
    setDescription(initialData?.description ?? '');
    setIsActive(initialData?.isActive ?? true);
    setErrors({});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialData?.title, initialData?.description]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) newErrors.title = 'Title is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      onSave({
        title: title.trim(),
        description: description.trim(),
        isActive,
      });

      showToast({
        title: isEditing ? 'Position updated' : 'Position created',
        message: `Position “${title}” is ${isActive ? 'open' : 'closed'}.`,
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
              {isEditing ? 'Edit Position' : 'Create Position'}
            </div>
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-sm bg-clay/10 flex items-center justify-center text-clay shrink-0">
                <span className="material-symbols-outlined text-[18px] font-display font-semibold tracking-wide">work</span>
              </div>
              <input
                id="position-title"
                type="text"
                required
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Senior Backend Engineer"
                className={`w-full bg-transparent text-[18px] font-bold text-ink outline-none placeholder:text-clay/40 border-b-2 border-b-transparent focus:border-b-clay focus:ring-0 ${errors.title ? 'border-b-oxblood' : ''}`}
                aria-label="Position name"
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

        <form id="position-drawer-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Description */}
          <section className="space-y-2 border-b-2 border-ink pb-4">
            <label className="text-[11px] font-medium font-bold text-ink/70 uppercase tracking-wider">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe this hiring position..."
              rows={3}
              className="w-full rounded-sm border-2 border-ink bg-clay/5 px-3 py-2 text-[13px] font-medium text-ink/90 outline-none focus:border-stamp border-2 resize-none"
            />
          </section>

          {/* Active */}
          <section className="space-y-2 border-b-2 border-ink pb-4">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-medium font-bold text-ink/70 uppercase tracking-wider">Status</label>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm ${isActive ? 'bg-clay/10 text-clay' : 'bg-oxblood/10 text-oxblood'}`}>
                {isActive ? 'Open' : 'Closed'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={isActive}
                onCheckedChange={setIsActive}
                aria-label="Toggle position status"
              />
            </div>
            <p className="mt-1 text-[10px] font-medium text-ink/40">
              {isActive ? 'Position is open and accepting panels' : 'Position is closed'}
            </p>
          </section>

          {/* Submit */}
          <div className="pt-6">
            <Button
              type="submit"
              form="position-drawer-form"
              disabled={submitting}
              className="w-full py-3.5 px-6 text-[13px] font-medium font-bold text-paper uppercase tracking-wider"
            >
              {submitting ? 'Saving…' : isEditing ? 'Save changes' : 'Create position'}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
