'use client';

import * as React from 'react';
import { useState, useCallback, useEffect, createContext, useContext } from 'react';
import { Button } from './Button';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  action?: React.ReactNode;
}

interface ToastContextValue {
  toasts: Toast[];
  showToast: (toast: Omit<Toast, 'id'>) => string;
  dismissToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

const typeStyles: Record<ToastType, string> = {
  success: 'border-sage/30 bg-sage/5',
  error: 'border-oxblood/30 bg-oxblood/5',
  warning: 'border-amber/30 bg-amber/5',
  info: 'border-blue/30 bg-blue/5',
};

const typeIcons: Record<ToastType, string> = {
  success: 'check_circle',
  error: 'error',
  warning: 'warning',
  info: 'info',
};

const typeColors: Record<ToastType, string> = {
  success: 'text-sage',
  error: 'text-oxblood',
  warning: 'text-amber',
  info: 'text-blue',
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const duration = toast.duration ?? 5000;
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onDismiss(toast.id), 200);
    }, duration);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!visible) return null;

  return (
    <div
      className={`fixed bottom-4 right-4 z-[100] w-full max-w-md animate-in slide-in-from-right duration-300 animate-out slide-out-to-right duration-200 ${typeStyles[toast.type]} border-2 p-4 shadow-lg`}
      role="alert"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 mt-0.5 ${typeColors[toast.type]}`}>
          <span className="material-symbols-outlined text-[22px]">{typeIcons[toast.type]}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display text-sm font-bold text-ink">{toast.title}</div>
          {toast.message && (
            <div className="mt-1 text-sm text-ink/70 font-mono">{toast.message}</div>
          )}
          {toast.action && (
            <div className="mt-3">{toast.action}</div>
          )}
        </div>
        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          className="flex-shrink-0 text-ink/40 hover:text-ink transition-colors"
          aria-label="Dismiss"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
      </div>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    const newToast = { ...toast, id };
    setToasts((prev) => [...prev, newToast]);
    return id;
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, showToast, dismissToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div key={toast.id} style={{ pointerEvents: 'auto' }}>
            <ToastItem
              key={toast.id}
              toast={toast}
              onDismiss={dismissToast}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}