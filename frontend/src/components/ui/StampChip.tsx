import * as React from 'react';
import { useEffect, useState } from 'react';

export type Verdict = 'STRONG_YES' | 'YES' | 'NO' | 'STRONG_NO';
export type StampState = Verdict | 'CONFIRMED' | 'SEALED' | 'UNSEALED';

export interface StampChipProps extends React.HTMLAttributes<HTMLDivElement> {
  status: StampState;
  animateOnMount?: boolean;
}

export function StampChip({ status, animateOnMount = false, className = '', ...props }: StampChipProps) {
  const [isAnimating, setIsAnimating] = useState(animateOnMount);

  useEffect(() => {
    if (isAnimating) {
      const timer = setTimeout(() => setIsAnimating(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isAnimating]);

  let colorStyles = '';
  switch (status) {
    case 'STRONG_YES':
    case 'YES':
      colorStyles = 'text-sage border-sage';
      break;
    case 'NO':
    case 'STRONG_NO':
      colorStyles = 'text-oxblood border-oxblood';
      break;
    case 'CONFIRMED':
    case 'SEALED':
    case 'UNSEALED':
    default:
      colorStyles = 'text-stamp border-stamp';
      break;
  }

  const animationClass = isAnimating ? 'motion-safe:animate-stamp-pulse' : '';

  if (status === 'SEALED') {
    return (
      <div
        className={`inline-flex items-center justify-center p-1 border-2 rounded-sm transform -rotate-2 ${colorStyles} ${animationClass} ${className}`}
        title="Sealed"
        {...props}
      >
        <span className="material-symbols-outlined text-[16px]">lock</span>
      </div>
    );
  }

  const textLabel = status.replace('_', ' ');

  return (
    <div
      className={`inline-flex items-center justify-center px-3 py-1 border-2 rounded-sm font-display font-bold uppercase tracking-widest text-[12px] transform -rotate-2 bg-paper/80 backdrop-blur-sm shadow-sm ${colorStyles} ${animationClass} ${className}`}
      {...props}
    >
      {textLabel}
    </div>
  );
}
