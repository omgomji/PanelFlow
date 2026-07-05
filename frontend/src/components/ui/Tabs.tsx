import * as React from 'react';

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  onValueChange: (value: string) => void;
}

export function Tabs({ className = '', value, onValueChange, children, ...props }: TabsProps) {
  return (
    <div className={`flex items-center gap-6 border-b-2 border-clay/30 ${className}`} {...props}>
      {children}
    </div>
  );
}

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  activeValue?: string;
  onActiveChange?: (value: string) => void;
}

export function TabsTrigger({ className = '', value, activeValue, onActiveChange, children, ...props }: TabsTriggerProps) {
  const isActive = value === activeValue;
  return (
    <button
      type="button"
      onClick={() => onActiveChange?.(value)}
      className={`relative py-3 font-display text-sm font-bold transition-colors hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-stamp focus-visible:ring-offset-2 ${
 isActive ? 'text-ink' : 'text-clay/80'
 } ${className}`}
      {...props}
    >
      {children}
      {isActive && (
        <span className="absolute -bottom-[2px] left-0 right-0 h-[2px] bg-ink" />
      )}
    </button>
  );
}
