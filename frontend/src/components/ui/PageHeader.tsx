'use client';

import * as React from 'react';
import { Button } from './Button';

export interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  backHref?: string;
  backLabel?: string;
  className?: string;
}

export function PageHeader({
  title,
  description,
  action,
  backHref,
  backLabel = 'Back',
  className = '',
}: PageHeaderProps) {
  return (
    <header className={`mb-6 ${className}`}>
      {backHref && (
        <div className="mb-4">
          <a
            href={backHref}
            className="inline-flex items-center gap-1.5 font-display text-sm font-bold text-ink/70 hover:text-ink transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            {backLabel}
          </a>
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] font-bold text-ink">{title}</h1>
          {description && (
            <p className="mt-1 text-ink/70 font-mono text-sm max-w-2xl">
              {description}
            </p>
          )}
        </div>
        {action && (
          <div className="shrink-0 mt-4 sm:mt-0">
            {action}
          </div>
        )}
      </div>
    </header>
  );
}