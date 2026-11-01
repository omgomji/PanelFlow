'use client';

import * as React from 'react';

export type AriaLivePriority = 'off' | 'polite' | 'assertive';

export interface AriaLiveProps {
  children: React.ReactNode;
  priority?: AriaLivePriority;
}

export function AriaLive({ children, priority = 'polite' }: AriaLiveProps) {
  return (
    <span
      aria-live={priority}
      aria-atomic="true"
      className="sr-only"
    >
      {children}
    </span>
  );
}

/**
 * A toast-style live announcer that can be triggered imperatively.
 * Use for async status updates that screen readers should announce.
 */
export interface UseAriaAnnouncerReturn {
  announce: (message: string, priority?: AriaLivePriority) => void;
}

export function useAriaAnnouncer(): UseAriaAnnouncerReturn {
  const ref = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!ref.current) {
      const el = document.createElement('div');
      el.setAttribute('aria-live', 'polite');
      el.setAttribute('aria-atomic', 'true');
      el.className = 'sr-only';
      document.body.appendChild(el);
      ref.current = el;
    }
    return () => {
      if (ref.current && ref.current.parentNode) {
        ref.current.parentNode.removeChild(ref.current);
      }
      ref.current = null;
    };
  }, []);

  const announce = React.useCallback((message: string, priority: AriaLivePriority = 'polite') => {
    if (!ref.current) return;
    ref.current.setAttribute('aria-live', priority);
    // Clear and re-set to force re-announcement of the same message
    ref.current.textContent = '';
    void ref.current.offsetHeight; // force reflow
    ref.current.textContent = message;
  }, []);

  return { announce };
}