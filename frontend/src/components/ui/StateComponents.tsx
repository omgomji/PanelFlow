'use client';

import * as React from 'react';
import { Button } from './Button';

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className = ''
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-4 text-center ${className}`}>
      {icon ? (
        <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-sm border-2 border-ink/10 bg-paper text-ink/40">
          {icon}
        </div>
      ) : (
        <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-sm border-2 border-ink/10 bg-paper text-ink/40">
          <span className="material-symbols-outlined text-[28px]">inbox</span>
        </div>
      )}
      <h3 className="font-display text-lg font-bold text-ink mb-2">{title}</h3>
      {description && (
        <p className="text-ink/60 font-mono text-sm max-w-xs mb-6">{description}</p>
      )}
      {action && (
        <div className="mt-2">{action}</div>
      )}
    </div>
  );
}

export interface LoadingStateProps {
  message?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function LoadingState({
  message = 'Loading...',
  className = '',
  size = 'md'
}: LoadingStateProps) {
  const sizeStyles = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  return (
    <div className={`flex flex-col items-center justify-center py-12 ${className}`}>
      <div className={`animate-spin rounded-full border-b-2 border-stamp ${sizeStyles[size]}`} />
      {message && (
        <p className="mt-4 font-mono text-sm text-ink/70">{message}</p>
      )}
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Try again',
  className = ''
}: ErrorStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-4 text-center ${className}`}>
      <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-sm border-2 border-oxblood/20 bg-oxblood/5 text-oxblood">
        <span className="material-symbols-outlined text-[28px]">error_outline</span>
      </div>
      <h3 className="font-display text-lg font-bold text-ink mb-2">{title}</h3>
      <p className="text-ink/60 font-mono text-sm max-w-xs mb-6">{message}</p>
      {onRetry && (
        <Button variant="primary" onClick={onRetry} className="gap-2">
          <span className="material-symbols-outlined text-[18px]">refresh</span>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}