'use client';

import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from 'next-themes';

type TopBarProps = {
  sidebarWidth: number;
  onMobileMenuToggle: () => void;
};

export default function TopBar({ sidebarWidth, onMobileMenuToggle }: TopBarProps) {
  const [profileOpen, setProfileOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const profileButtonRef = useRef<HTMLButtonElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const { user, logout } = useAuth();
  const { theme, setTheme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const initials = user?.name ? user.name.slice(0, 2).toUpperCase() : 'U';

  useEffect(() => {
    setMounted(true);
  }, []);

  const headerStyle = {
    '--sidebar-width': `${sidebarWidth}px`,
  } as CSSProperties;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProfileOpen(false);
    };

    const onMouseDown = (event: MouseEvent) => {
      if (!profileOpen) return;
      const target = event.target as Node;
      if (profileMenuRef.current?.contains(target)) return;
      if (profileButtonRef.current?.contains(target)) return;
      setProfileOpen(false);
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onMouseDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [profileOpen]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleCopyLink = () => {
    const username = user?.name?.toLowerCase().replace(/\s+/g, '') || 'admin';
    const adminLink = `${window.location.origin}/${username}`;
    navigator.clipboard.writeText(adminLink);
    setCopied(true);
  };

  return (
    <header
      className="fixed top-0 right-0 left-0 z-40 h-14 border-b-2 border-ink bg-paper transition-all duration-300 lg:left-sidebar"
      style={headerStyle}
    >
      <div className="flex h-full w-full items-center justify-between px-3 sm:px-4 lg:px-8">
        <div className="flex items-center">
          <button
            type="button"
            onClick={onMobileMenuToggle}
            className="inline-flex h-11 w-11 items-center justify-center text-ink/70 transition-colors hover:bg-clay/10 hover:text-ink lg:hidden"
            aria-label="Open navigation"
          >
            <span className="material-symbols-outlined text-[22px]">menu</span>
          </button>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {mounted && (
            <button
              type="button"
              onClick={() => setTheme(theme === 'dark' || (theme === 'system' && systemTheme === 'dark') ? 'light' : 'dark')}
              className="inline-flex h-9 w-9 items-center justify-center text-ink/70 transition-colors hover:bg-clay/10 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-stamp rounded-sm"
              aria-label="Toggle dark mode"
            >
              <span className="material-symbols-outlined text-[20px]">
                {theme === 'dark' || (theme === 'system' && systemTheme === 'dark') ? 'light_mode' : 'dark_mode'}
              </span>
            </button>
          )}

          <div className="relative">
            <button
              ref={profileButtonRef}
              type="button"
              onClick={() => setProfileOpen((v) => !v)}
              className="group flex min-h-11 cursor-pointer items-center gap-1 border-2 border-transparent p-1 pr-1.5 transition-colors hover:bg-clay/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-stamp sm:min-h-0 sm:pr-2"
              aria-haspopup="menu"
              aria-expanded={profileOpen}
            >
              <div className="h-9 w-9 border-2 border-ink bg-paper font-display text-[11px] font-bold text-ink flex items-center justify-center sm:h-8 sm:w-8">
                {initials}
              </div>
              <span className="material-symbols-outlined text-ink/60 text-sm">arrow_drop_down</span>
            </button>

            {profileOpen && (
              <div
                ref={profileMenuRef}
                role="menu"
                className="absolute right-0 mt-2 w-[min(280px,calc(100vw-1rem))] border-2 border-ink bg-paper shadow-sm"
              >
                <div className="p-4">
                  <div className="font-display text-[15px] font-bold text-ink">{user?.name ?? 'User'}</div>
                  <div className="text-[12px] text-ink/70 mt-0.5">{user?.email}</div>
                  <div className="mt-2 inline-flex items-center bg-ink px-2 py-0.5 text-[12px] font-semibold text-paper">
                    {user?.role ?? 'INTERVIEWER'}
                  </div>
                </div>

                <div className="h-px bg-clay/30" />

                <div className="p-2">
                  <div className="px-2 py-2 font-display text-[13px] font-semibold text-ink/60">Account settings</div>
                  {[
                    { label: 'My Link', icon: 'link', action: handleCopyLink },
                  ].map((item) => (
                    <button
                      key={item.label}
                      role="menuitem"
                      onClick={item.action}
                      className="w-full flex items-center gap-3 px-3 py-2 hover:bg-clay/10 font-display text-[14px] font-bold text-ink justify-between focus:outline-none focus-visible:ring-2 focus-visible:ring-stamp"
                    >
                      <span className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-[20px] text-ink/60">{item.icon}</span>
                        {item.label}
                      </span>
                      {item.label === 'My Link' && copied && (
                        <span className="text-[12px] font-semibold text-sage">Copied!</span>
                      )}
                    </button>
                  ))}

                  <div className="h-px bg-clay/30 my-2" />
                  <button
                    role="menuitem"
                    onClick={() => { setProfileOpen(false); logout(); }}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-oxblood/10 font-display text-[14px] font-bold text-oxblood focus:outline-none focus-visible:ring-2 focus-visible:ring-oxblood"
                  >
                    <span className="material-symbols-outlined text-[20px]">logout</span>
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
