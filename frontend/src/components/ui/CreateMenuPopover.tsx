'use client';

import * as React from 'react';
import { useToast } from './Toast';

type CreateMenuPopoverProps = {
  onCreateEventType: () => void;
  onCreatePanel?: () => void;
  onCreatePosition?: () => void;
};

type MenuItem = {
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  action: 'event-type' | 'panel' | 'position';
};

const menuItems: MenuItem[] = [
  {
    title: 'Event Type',
    subtitle: 'Individual Meeting',
    description: 'Create a one-on-one booking link for yourself',
    icon: 'event',
    action: 'event-type',
  },
  {
    title: 'Panel',
    subtitle: 'Group Interview',
    description: 'Create a multi-interviewer panel booking',
    icon: 'groups',
    action: 'panel',
  },
  {
    title: 'Position',
    subtitle: 'Job Opening',
    description: 'Create a new hiring position to organize panels',
    icon: 'work',
    action: 'position',
  },
];

function ItemRow({ item, onSelect }: { item: MenuItem; onSelect: (action: MenuItem['action']) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item.action)}
      className="w-full rounded-sm px-3 py-3 text-left hover:bg-clay/5 transition-colors border-b border-clay/20 last:border-b-0"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex shrink-0 items-center justify-center rounded-sm bg-clay/5 p-1 text-[18px] font-display font-semibold tracking-wide text-stamp">
            <span className="material-symbols-outlined">{item.icon}</span>
          </span>
          <div>
            <div className="text-[14px] font-display font-semibold tracking-wide font-bold text-ink">{item.title}</div>
            <div className="text-[11px] font-medium text-ink/60">{item.subtitle}</div>
          </div>
        </div>
        <span className="material-symbols-outlined text-[16px] text-ink/30">chevron_right</span>
      </div>
      <div className="mt-1 text-[12px] font-medium text-ink/50">{item.description}</div>
    </button>
  );
}

export default function CreateMenuPopover({ onCreateEventType, onCreatePanel, onCreatePosition }: CreateMenuPopoverProps) {
  const { showToast } = useToast();

  const handleSelect = (action: MenuItem['action']) => {
    switch (action) {
      case 'event-type':
        onCreateEventType();
        break;
      case 'panel':
        onCreatePanel?.();
        break;
      case 'position':
        onCreatePosition?.();
        break;
    }
  };

  const visibleItems = menuItems.filter((item) => {
    if (item.action === 'panel') return !!onCreatePanel;
    if (item.action === 'position') return !!onCreatePosition;
    return true;
  });

  return (
    <div className="relative z-50 w-[min(92vw,420px)] rounded-sm border-2 border-ink bg-paper p-1 shadow-[0_8px_24px_rgba(16,42,67,0.14)]">
      <div className="space-y-0">
        {visibleItems.map((item) => (
          <ItemRow key={item.title} item={item} onSelect={handleSelect} />
        ))}
      </div>
    </div>
  );
}
