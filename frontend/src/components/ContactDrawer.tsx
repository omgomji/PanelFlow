'use client';

import { useState } from 'react';

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    try {
      setIsSubmitting(true);
      await onSave({
        name: String(formData.get('name') ?? '').trim(),
        email: String(formData.get('email') ?? '').trim(),
        phone: String(formData.get('phone') ?? '').trim(),
        note: String(formData.get('note') ?? '').trim(),
      });

      e.currentTarget.reset();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-slate-900/20" onClick={onClose} />

      <aside className="fixed right-0 top-0 z-50 h-screen w-full max-w-md overflow-y-auto bg-white shadow-2xl animate-in slide-in-from-right duration-300">
        <div className="sticky top-0 border-b border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-[18px] font-bold text-slate-900">New contact</h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-slate-600 transition-colors hover:bg-slate-100"
              aria-label="Close drawer"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
          <p className="mt-1 text-[12px] text-slate-500">Add a contact with basic details for follow-up.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-4">
          <div>
            <label htmlFor="contact-name" className="mb-1 block text-[12px] font-semibold text-slate-700">
              Name
            </label>
            <input
              id="contact-name"
              name="name"
              type="text"
              required
              placeholder="OM"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-[13px] text-slate-800 focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="contact-email" className="mb-1 block text-[12px] font-semibold text-slate-700">
              Email
            </label>
            <input
              id="contact-email"
              name="email"
              type="email"
              required
              placeholder="om@example.com"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-[13px] text-slate-800 focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="contact-phone" className="mb-1 block text-[12px] font-semibold text-slate-700">
              Contact
            </label>
            <input
              id="contact-phone"
              name="phone"
              type="tel"
              placeholder="+1 555 123 4567"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-[13px] text-slate-800 focus:border-primary focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="contact-note" className="mb-1 block text-[12px] font-semibold text-slate-700">
              Note
            </label>
            <textarea
              id="contact-note"
              name="note"
              rows={4}
              placeholder="Add context about this contact"
              className="w-full resize-none rounded-md border border-slate-300 px-3 py-2 text-[13px] text-slate-800 focus:border-primary focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="inline-flex h-9 items-center rounded-full border border-slate-300 px-4 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-[12px] font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save contact'}
            </button>
          </div>
        </form>
      </aside>
    </>
  );
}
