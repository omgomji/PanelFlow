'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Sidebar from '@/components/Sidebar';
import TopBar from '@/components/TopBar';

const SIDEBAR_EXPANDED_WIDTH = 230;
const SIDEBAR_COLLAPSED_WIDTH = 88;

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { loading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const handleBreakpoint = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setMobileSidebarOpen(false);
      }
    };

    mediaQuery.addEventListener('change', handleBreakpoint);
    return () => mediaQuery.removeEventListener('change', handleBreakpoint);
  }, []);

  const sidebarWidth = useMemo(
    () => (sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH),
    [sidebarCollapsed],
  );

  const sidebarDesktopStyle = {
    '--sidebar-width': `${sidebarWidth}px`,
  } as CSSProperties;

  const [slowLoad, setSlowLoad] = useState(false);

  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => setSlowLoad(true), 3000);
    return () => clearTimeout(t);
  }, [loading]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface">
        {loading && <div className="h-8 w-8 animate-spin rounded-sm border-b-2 border-stamp border-2" />}
        {loading && slowLoad && (
          <div className="text-center">
            <p className="text-sm font-medium text-ink/70">Waking up the server&hellip;</p>
            <p className="text-xs text-ink/40 mt-1">This takes ~15s on first load</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="cal-ui-shell flex min-h-screen bg-paper selection:bg-stamp/10">
      {mobileSidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-ink/20 lg:hidden"
        />
      )}

      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((prev) => !prev)}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          sidebarWidth={sidebarWidth}
          onMobileMenuToggle={() => setMobileSidebarOpen((prev) => !prev)}
        />
        <main
          className="flex-1 mt-14 overflow-y-auto bg-paper p-4 sm:p-6 lg:p-10 lg:ml-sidebar transition-all duration-300"
          style={sidebarDesktopStyle}
        >
          <div className="w-full max-w-5xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
