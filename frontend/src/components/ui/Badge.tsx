import * as React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'danger' | 'outline';
}

export function Badge({ className = '', variant = 'default', ...props }: BadgeProps) {
  let variantStyles = '';
  switch (variant) {
    case 'default':
      variantStyles = 'bg-ink text-paper';
      break;
    case 'success':
      variantStyles = 'bg-sage text-paper';
      break;
    case 'danger':
      variantStyles = 'bg-oxblood text-paper';
      break;
    case 'outline':
      variantStyles = 'bg-transparent text-ink border border-ink';
      break;
  }

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[13px] font-medium font-bold ${variantStyles} ${className}`}
      {...props}
    />
  );
}
