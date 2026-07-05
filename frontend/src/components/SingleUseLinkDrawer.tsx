'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

export interface SingleUseLinkData {
  title: string;
  duration: number;
  slug: string;
  description?: string;
}

interface SingleUseLinkDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: SingleUseLinkData) => void;
}

export default function SingleUseLinkDrawer({
  isOpen,
  onClose,
  onSave,
}: SingleUseLinkDrawerProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    duration: false,
    location: false,
    availability: false,
    host: false,
  });
  const { user } = useAuth();

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const title = String(formData.get('title') ?? '').trim();
    const duration = Number(formData.get('duration') ?? 30);

    onSave({
      title: title || 'One-off meeting',
      duration,
      slug: title.toLowerCase().replace(/\s+/g, '-'),
      description: '',
    });
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-slate-900/20"
        onClick={onClose}
      />

      {/* Right Drawer */}
      <div className="fixed right-0 top-0 w-full max-w-md h-screen z-50 bg-paper shadow-2xl overflow-y-auto animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="sticky top-0 bg-paper border-b border-ink border-2 p-4 flex items-center justify-between">
          <div>
            <div className="text-[12px] font-medium font-medium text-ink/60 mb-1">Create</div>
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded-sm bg-blue-500" />
              <h2 className="text-[18px] font-bold text-ink">
                One-off meeting
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-clay/10 rounded-sm transition-colors text-ink/70"
            aria-label="Close drawer"
          >
            <span className="material-symbols-outlined text-[20px] font-display font-semibold tracking-wide">close</span>
          </button>
        </div>

        {/* Content */}
        <form id="single-use-link-drawer-form" onSubmit={handleSubmit} className="p-4 space-y-0">
          {/* Duration Section */}
          <div className="border-b border-ink border-2">
            <button
              type="button"
              onClick={() => toggleSection('duration')}
              className="w-full flex items-center justify-between py-3 px-2 text-left"
            >
              <span className="text-[14px] font-display font-semibold tracking-wide font-bold text-ink">Duration</span>
              <span className="material-symbols-outlined text-[20px] font-display font-semibold tracking-wide text-ink/70">
                {expandedSections.duration ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            {expandedSections.duration && (
              <div className="pb-3 px-2">
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-[18px] text-ink/60">schedule</span>
                  <select
                    name="duration"
                    defaultValue="30"
                    className="flex-1 px-3 py-2 border-2 border-ink rounded-sm text-[13px] font-medium focus:outline-none focus:border-stamp border-2"
                  >
                    <option value="15">15 min</option>
                    <option value="30">30 min</option>
                    <option value="45">45 min</option>
                    <option value="60">60 min</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Location Section */}
          <div className="border-b border-ink border-2">
            <button
              type="button"
              onClick={() => toggleSection('location')}
              className="w-full flex items-center justify-between py-3 px-2 text-left"
            >
              <span className="text-[14px] font-display font-semibold tracking-wide font-bold text-ink">Location</span>
              <span className="material-symbols-outlined text-[20px] font-display font-semibold tracking-wide text-ink/70">
                {expandedSections.location ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            {expandedSections.location && (
              <div className="pb-3 px-2">
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    className="flex-1 py-2 px-3 rounded-sm border-2 border-ink text-[13px] font-medium font-medium text-ink/70 hover:bg-clay/5"
                  >
                    <span className="material-symbols-outlined inline text-[18px]">videocam</span>
                    <div className="text-[12px] font-medium">Zoom</div>
                  </button>
                  <button
                    type="button"
                    className="flex-1 py-2 px-3 rounded-sm border-2 border-ink text-[13px] font-medium font-medium text-ink/70 hover:bg-clay/5"
                  >
                    <span className="material-symbols-outlined inline text-[18px]">phone</span>
                    <div className="text-[12px] font-medium">Phone</div>
                  </button>
                  <button
                    type="button"
                    className="flex-1 py-2 px-3 rounded-sm border-2 border-ink text-[13px] font-medium font-medium text-ink/70 hover:bg-clay/5"
                  >
                    <span className="material-symbols-outlined inline text-[18px]">location_on</span>
                    <div className="text-[12px] font-medium">In-person</div>
                  </button>
                </div>
                <div className="text-[12px] font-medium text-ink/60">
                  <span className="material-symbols-outlined inline text-[16px]">info</span>
                  No location set
                </div>
              </div>
            )}
          </div>

          {/* Availability Section */}
          <div className="border-b border-ink border-2">
            <button
              type="button"
              onClick={() => toggleSection('availability')}
              className="w-full flex items-center justify-between py-3 px-2 text-left"
            >
              <span className="text-[14px] font-display font-semibold tracking-wide font-bold text-ink">Availability</span>
              <span className="material-symbols-outlined text-[20px] font-display font-semibold tracking-wide text-ink/70">
                {expandedSections.availability ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            {expandedSections.availability && (
              <div className="pb-3 px-2">
                <div className="text-[13px] font-medium font-medium text-ink/80 mb-2">
                  Weekdays, 9 am - 5 pm
                </div>
              </div>
            )}
          </div>

          {/* Host Section */}
          <div className="border-b border-ink border-2">
            <button
              type="button"
              onClick={() => toggleSection('host')}
              className="w-full flex items-center justify-between py-3 px-2 text-left"
            >
              <span className="text-[14px] font-display font-semibold tracking-wide font-bold text-ink">Host</span>
              <span className="material-symbols-outlined text-[20px] font-display font-semibold tracking-wide text-ink/70">
                {expandedSections.host ? 'expand_less' : 'expand_more'}
              </span>
            </button>

            {expandedSections.host && (
              <div className="pb-3 px-2">
                <div className="flex items-center gap-2 text-[13px] font-medium font-medium text-ink/80">
                  <div className="h-5 w-5 rounded-sm bg-clay/20 flex items-center justify-center text-[10px] font-bold text-ink/70">
                    {user?.name ? user.name.slice(0, 2).toUpperCase() : 'U'}
                  </div>
                  {user?.name || 'User'} (you)
                </div>
              </div>
            )}
          </div>

          {/* Hidden Form Fields */}
          <input
            type="hidden"
            name="title"
            defaultValue="One-off meeting"
          />
        </form>

        {/* Footer */}
        <div className="sticky bottom-0 bg-paper border-t border-ink border-2 p-4 flex items-center gap-3">
          <button
            type="submit"
            form="single-use-link-drawer-form"
            className="w-full py-2 px-4 rounded-sm bg-stamp text-[13px] font-medium font-bold text-paper hover:opacity-90"
          >
            Create
          </button>
        </div>
      </div>
    </>
  );
}
