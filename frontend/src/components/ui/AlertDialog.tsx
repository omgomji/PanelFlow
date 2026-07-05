import * as React from 'react';
import { Button } from './Button';

export interface AlertDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  buttonText?: string;
  onClose: () => void;
}

export function AlertDialog({
  isOpen,
  title,
  message,
  buttonText = 'OK',
  onClose,
}: AlertDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm">
      <div 
        className="w-full max-w-md bg-paper border-2 border-ink shadow-[4px_4px_0px_rgba(27,31,43,1)] p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="alert-dialog-title"
      >
        <h2 id="alert-dialog-title" className="font-display text-xl font-bold text-ink mb-2">
          {title}
        </h2>
        <p className="text-ink/80 mb-6">
          {message}
        </p>
        <div className="flex justify-end">
          <Button variant="primary" onClick={onClose}>
            {buttonText}
          </Button>
        </div>
      </div>
    </div>
  );
}
