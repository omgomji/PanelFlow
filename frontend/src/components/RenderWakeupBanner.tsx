'use client';

import { useEffect, useState } from 'react';

const HEALTH_URL = (() => {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
  return base.replace(/\/api\/?$/, '') + '/health';
})();

const RETRY_INTERVAL_MS = 4000;

type BannerState = 'waking' | 'ready';

export default function RenderWakeupBanner() {
  const [state, setState] = useState<BannerState>('waking');
  const [elapsedSec, setElapsedSec] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout>;

    // Tick every second to show elapsed time
    const ticker = setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1000);

    async function ping() {
      try {
        const res = await fetch(HEALTH_URL, { cache: 'no-store' });
        if (!cancelled && res.ok) {
          clearInterval(ticker);
          setState('ready');
          // Auto-dismiss the success flash after 3s
          setTimeout(() => {
            if (!cancelled) setDismissed(true);
          }, 3000);
          return;
        }
      } catch {
        // still sleeping — retry
      }
      if (!cancelled) {
        retryTimer = setTimeout(ping, RETRY_INTERVAL_MS);
      }
    }

    // Start pinging immediately
    ping();

    return () => {
      cancelled = true;
      clearInterval(ticker);
      clearTimeout(retryTimer);
    };
  }, []);

  if (dismissed) return null;

  const isReady = state === 'ready';

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px 20px',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        background: state === 'ready'
          ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
          : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        color: '#fff',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '14px',
        fontWeight: 500,
        whiteSpace: 'nowrap',
        animation: 'slideUp 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
        maxWidth: 'calc(100vw - 48px)',
        flexWrap: 'wrap',
        justifyContent: 'center',
        textAlign: 'center',
      }}
    >
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateX(-50%) translateY(20px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>

      {state === 'ready' ? (
        <>
          <span style={{ fontSize: '18px' }}>✅</span>
          <span>Backend is awake — loading your data now!</span>
        </>
      ) : (
        <>
          <span
            style={{
              width: '18px',
              height: '18px',
              border: '2.5px solid rgba(255,255,255,0.4)',
              borderTopColor: '#fff',
              borderRadius: '50%',
              flexShrink: 0,
              display: 'inline-block',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <span>
            <strong>Backend waking up</strong> — Render free tier spins down after inactivity.
            Please wait
            {elapsedSec > 0 && (
              <span style={{ opacity: 0.85 }}> ({elapsedSec}s elapsed)</span>
            )}
            …
          </span>
          <button
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '12px',
              padding: '2px 8px',
              fontWeight: 600,
            }}
          >
            ✕
          </button>
        </>
      )}
    </div>
  );
}
