'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const HEALTH_URL = (() => {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
  return base.replace(/\/api\/?$/, '') + '/health';
})();

const RETRY_INTERVAL_MS = 5000;
const MAX_RETRIES = 10;

type BannerState = 'checking' | 'waking' | 'ready' | 'offline';

interface BackendStatusBannerProps {
  dismissible?: boolean;
}

export default function BackendStatusBanner({ dismissible = true }: BackendStatusBannerProps) {
  const [state, setState] = useState<BannerState>('checking');
  const [retryCount, setRetryCount] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (tickerRef.current) clearInterval(tickerRef.current);
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
  }, []);

  useEffect(() => {
    tickerRef.current = setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1000);
    return () => {
      if (tickerRef.current) clearInterval(tickerRef.current);
    };
  }, []);

  const checkHealth = useCallback(async (): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const res = await fetch(HEALTH_URL, {
        cache: 'no-store',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  const pollHealth = useCallback(async () => {
    if (cancelledRef.current) return;

    const isHealthy = await checkHealth();

    if (isHealthy) {
      setState('ready');
      setRetryCount(0);
      return;
    }

    setRetryCount((prev) => prev + 1);

    if (retryCount >= MAX_RETRIES - 1) {
      setState('offline');
      return;
    }

    setState('waking');
    retryTimerRef.current = setTimeout(pollHealth, RETRY_INTERVAL_MS);
  }, [checkHealth, retryCount]);

  const handleRetry = useCallback(async () => {
    setRetryCount(0);
    setState('checking');
    cancelledRef.current = false;
    await pollHealth();
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    pollHealth();

    return () => {
      cancelledRef.current = true;
      clearTimers();
    };
  }, [pollHealth, clearTimers]);

  if (dismissed) return null;

  const isLoading = state === 'checking' || state === 'waking';

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 px-3 py-2.5 rounded-2xl shadow-2xl border border-white/30 backdrop-blur-md bg-white/95 text-black animate-in fade-in slide-in-from-bottom-4 duration-300 max-w-[calc(100vw-48px)] flex-wrap justify-center"
    >
      {/* Ready state - success */}
      {state === 'ready' && (
        <>
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-green-600 text-white flex items-center justify-center text-xs font-bold">
              ✓
            </span>
            <span className="text-sm font-bold text-green-900">
              Backend is online
            </span>
          </div>
          {dismissible && (
            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label="Dismiss"
              className="ml-2 p-1.5 rounded-md text-gray-600 hover:text-black hover:bg-gray-100 transition-colors"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          )}
        </>
      )}

      {/* Waking/Checking state */}
      {isLoading && (
        <>
          <div className="flex items-center gap-2">
            <div
              className="w-5 h-5 rounded-full border-2.5 border-gray-200 border-t-blue-600 animate-spin flex-shrink-0"
            ></div>
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-bold text-gray-900">
                {state === 'checking' ? 'Checking backend…' : 'Backend waking up…'}
              </span>
              <span className="text-[10px] font-medium text-gray-600">
                ({elapsedSec}s)
              </span>
            </div>
          </div>
        </>
      )}

      {/* Offline state */}
      {state === 'offline' && (
        <>
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center text-xs font-bold">
              !
            </span>
            <div className="flex flex-col items-center gap-1">
              <span className="text-sm font-bold text-red-900">
                Backend is unreachable
              </span>
              <span className="text-[10px] font-medium text-red-700">
                Unable to connect after {MAX_RETRIES} attempts
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <button
              type="button"
              onClick={handleRetry}
              className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              Try again
            </button>
            {dismissible && (
              <button
                type="button"
                onClick={() => setDismissed(true)}
                aria-label="Dismiss"
                className="p-1.5 rounded-md text-gray-600 hover:text-black hover:bg-gray-100 transition-colors"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
