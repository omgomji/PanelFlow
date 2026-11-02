'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';

export interface ContactDrawerData {
  name: string;
  email: string;
  phone: string;
  note: string;
}

type ContactDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: ContactDrawerData) => void;
  loading?: boolean;
};

export default function ContactDrawer({ isOpen, onClose, onSave, loading = false }: ContactDrawerProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    setIsSubmitting(true);
    try {
      await onSave({
        name: String(formData.get('name') ?? '').trim(),
        email: String(formData.get('email') ?? '').trim(),
        phone: String(formData.get('phone') ?? '').trim(),
        note: String(formData.get('note') ?? '').trim(),
      });

      e.currentTarget.reset();

      showToast({
        title: 'Contact created',
        message: `New contact added.`,
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
      setIsSubmitting(false);
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
              Create Contact
            </div>
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-sm bg-clay/10 flex items-center justify-center text-clay shrink-0">
                <span className="material-symbols-outlined text-[18px] font-display font-semibold tracking-wide">person_add</span>
              </div>
              <input
                id="contact-name"
                type="text"
                required
                autoFocus
                placeholder="e.g. Jane Doe"
                className={`w-full bg-transparent text-[18px] font-bold text-ink outline-none placeholder:text-clay/40 ${''}`}
                aria-label="Contact name"
              />
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

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Name */}
          <section className="space-y-2 border-b-2 border-ink pb-4">
            <label className="text-[11px] font-medium font-bold text-ink/70 uppercase tracking-wider">Name</label>
            <input
              id="contact-name"
              name="name"
              type="text"
              required
              placeholder="OM"
              className="w-full rounded-sm border-2 border-ink bg-clay/5 px-3 py-2 text-[13px] font-medium text-ink/90 outline-none focus:border-stamp border-2"
            />
          </section>

          {/* Email */}
          <section className="space-y-2 border-b-2 border-ink pb-4">
            <label className="text-[11px] font-medium font-bold text-ink/70 uppercase tracking-wider">Email</label>
            <input
              id="contact-email"
              name="email"
              type="email"
              required
              placeholder="om@example.com"
              className="w-full rounded-sm border-2 border-ink bg-clay/5 px-3 py-2 text-[13px] font-medium text-ink/90 outline-none focus:border-stamp border-2"
            />
          </section>

          {/* Phone */}
          <section className="space-y-2 border-b-2 border-ink pb-4">
            <label className="text-[11px] font-medium font-bold text-ink/70 uppercase tracking-wider">Phone</label>
            <input
              id="contact-phone"
              name="phone"
              type="tel"
              placeholder="+1 555 123 4567"
              className="w-full rounded-sm border-2 border-ink bg-clay/5 px-3 py-2 text-[13px] font-medium text-ink/90 outline-none focus:border-stamp border-2"
            />
          </section>

          {/* Note */}
          <section className="space-y-2 border-b-2 border-ink pb-4">
            <label className="text-[11px] font-medium font-bold text-ink/70 uppercase tracking-wider">Note</label>
            <textarea
              id="contact-note"
              name="note"
              rows={4}
              placeholder="Add context about this contact"
              className="w-full resize-none rounded-sm border-2 border-ink bg-clay/5 px-3 py-2 text-[13px] font-medium text-ink/90 outline-none focus:border-stamp border-2"
            />
          </section>

          {/* Submit */}
          <div className="pt-6">
            <Button
              type="submit"
              disabled={isSubmitting || loading}
              className="w-full py-3.5 px-6 text-[13px] font-medium font-bold text-paper uppercase tracking-wider"
            >
              {isSubmitting || loading ? 'Saving…' : 'Save contact'}
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
