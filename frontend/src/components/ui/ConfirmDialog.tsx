import * as React from 'react';
import { Button } from './Button';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'primary' | 'danger';
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'primary',
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      onClick={(e) => {
        // Clicking outside the dialog cancels
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        className="w-full max-w-md bg-paper border-2 border-ink shadow-[4px_4px_0px_rgba(27,31,43,1)] p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby="dialog-message"
        onKeyDown={handleKeyDown}
      >
        <h2 id="dialog-title" className="font-display text-xl font-bold text-ink mb-2">
          {title}
        </h2>
        <p id="dialog-message" className="text-ink/80 mb-6">
          {message}
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onCancel}>
            {cancelText}
          </Button>
          <Button variant={variant} onClick={onConfirm} autoFocus>
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}