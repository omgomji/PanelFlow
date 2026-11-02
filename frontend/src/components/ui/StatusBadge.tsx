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
  active: 'border-2 border-sage/20 bg-sage/10 text-sage',
  inactive: 'border-2 border-ink/20 bg-ink/10 text-ink/60',
  pending: 'border-2 border-amber/20 bg-amber/10 text-amber',
  scheduled: 'border-2 border-blue/20 bg-blue/10 text-blue',
  completed: 'border-2 border-sage/20 bg-sage/10 text-sage',
  cancelled: 'border-2 border-oxblood/20 bg-oxblood/10 text-oxblood',
  'no-show': 'border-2 border-orange/20 bg-orange/10 text-orange',
  open: 'border-2 border-sage/20 bg-sage/10 text-sage',
  closed: 'border-2 border-ink/20 bg-ink/10 text-ink/60',
  draft: 'border-2 border-clay/20 bg-clay/10 text-ink/60',
  published: 'border-2 border-pine/20 bg-pine/10 text-pine',
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