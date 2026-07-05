import * as React from 'react';

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <select
        className={`flex h-10 w-full border border-clay/40 bg-paper px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-stamp focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 appearance-none ${className}`}
        ref={ref}
        {...props}
      >
        {children}
      </select>
    );
  }
);
Select.displayName = 'Select';
