'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Admin route error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface p-4">
      <div className="w-full max-w-md rounded-sm border-2 border-ink bg-paper p-8 text-center shadow-[4px_4px_0px_rgba(27,31,43,1)]">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-oxblood/10">
          <span className="material-symbols-outlined text-[32px] text-oxblood">error</span>
        </div>
        
        <h2 className="font-display text-2xl font-bold text-ink">Something went wrong!</h2>
        
        <p className="mt-4 text-[14px] text-ink/70">
          We encountered an unexpected error while loading this page.
        </p>

        <div className="mt-8">
          <Button onClick={() => reset()} variant="primary" className="w-full">
            Try again
          </Button>
        </div>
      </div>
    </div>
  );
}
