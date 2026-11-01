'use client';

import * as React from 'react';

export type StatusVariant =
  | 'active'
  | 'inactive'
  | 'pending'
  | 'scheduled'
  | 'completed'
  | 'cancelled'
  | 'no-show'
  | 'open'
  | 'closed'
  | 'draft'
  | 'published';

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: StatusVariant;
  className?: string;
  label?: string;
}

const statusStyles: Record<StatusVariant, string> = {
  active: 'bg-sage/10 text-sage border-sage/20',
  inactive: 'bg-ink/10 text-ink/60 border-ink/20',
  pending: 'bg-amber/10 text-amber border-amber/20',
  scheduled: 'bg-blue/10 text-blue border-blue/20',
  completed: 'bg-sage/10 text-sage border-sage/20',
  cancelled: 'bg-oxblood/10 text-oxblood border-oxblood/20',
  'no-show': 'bg-orange/10 text-orange border-orange/20',
  open: 'bg-sage/10 text-sage border-sage/20',
  closed: 'bg-ink/10 text-ink/60 border-ink/20',
  draft: 'bg-clay/10 text-ink/60 border-clay/20',
  published: 'bg-pine/10 text-pine border-pine/20',
};

const statusLabels: Record<StatusVariant, string> = {
  active: 'Active',
  inactive: 'Inactive',
  pending: 'Pending',
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
  'no-show': 'No Show',
  open: 'Open',
  closed: 'Closed',
  draft: 'Draft',
  published: 'Published',
};

export function StatusBadge({ status, className = '', label }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-sm border font-display text-[11px] font-bold uppercase tracking-wider ${statusStyles[status] || statusStyles.inactive} ${className}`}
    >
      {(label ?? statusLabels[status]) ?? status}
    </span>
  );
}