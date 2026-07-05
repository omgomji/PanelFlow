import * as React from 'react';
import { Card } from './Card';

export interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <Card className="flex min-h-[300px] flex-col items-center justify-center border-dashed text-center">
      {icon && (
        <span className="material-symbols-outlined mb-4 text-[48px] text-clay/60">
          {icon}
        </span>
      )}
      <h3 className="mb-2 font-display text-lg font-bold text-ink">{title}</h3>
      {description && (
        <p className="mb-6 max-w-sm text-sm text-ink/70">{description}</p>
      )}
      {action && <div>{action}</div>}
    </Card>
  );
}
