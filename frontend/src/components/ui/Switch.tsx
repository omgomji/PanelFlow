import * as React from 'react';

export interface SwitchProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ className = '', checked, onCheckedChange, ...props }, ref) => {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onCheckedChange?.(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stamp focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
 checked ? 'bg-stamp' : 'bg-clay/40'
 } ${className}`}
        ref={ref}
        {...props}
      >
        <span
          className={`pointer-events-none block h-4 w-4 rounded-full bg-paper shadow-lg ring-0 transition-transform ${
 checked ? 'translate-x-4' : 'translate-x-0'
 }`}
        />
      </button>
    );
  }
);
Switch.displayName = 'Switch';
