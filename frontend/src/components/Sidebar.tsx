'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import CreateMenuPopover from '@/components/ui/CreateMenuPopover';

type SidebarProps = {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

export default function Sidebar({
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [createMenuOpen, setCreateMenuOpen] = useState(false);

  const [isDesktopViewport, setIsDesktopViewport] = useState(false);
  const createMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!createMenuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCreateMenuOpen(false);
    };

    const onPointerDown = (event: MouseEvent | PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (createMenuRef.current && !createMenuRef.current.contains(target)) {
        setCreateMenuOpen(false);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [createMenuOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const applyValue = (matches: boolean) => {
      setIsDesktopViewport(matches);
    };

    applyValue(mediaQuery.matches);
    const handleChange = (event: MediaQueryListEvent) => applyValue(event.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const navLinks = [
    { name: 'Scheduling', href: '/', icon: 'calendar_today' },
    { name: 'Meetings', href: '/meetings', icon: 'group' },
    { name: 'Availability', href: '/availability', icon: 'schedule' },
    { name: 'Projects & Roles', href: '/positions', icon: 'work' },
    { name: 'Feedback', href: '/feedback', icon: 'rate_review' },
    { name: 'Contacts', href: '/contacts', icon: 'person_book' },
    { name: 'Webhooks', href: '/settings/webhooks', icon: 'webhook' },
    { name: 'Settings', href: '/settings', icon: 'settings' },
  ];

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    if (href === '/settings') return pathname === '/settings';
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const openEventTypeCreate = () => {
    setCreateMenuOpen(false);
    onCloseMobile();
    router.push('/');
    window.dispatchEvent(new CustomEvent('open-create-event'));
  };

  const openSingleUseLinks = () => {
    setCreateMenuOpen(false);
    onCloseMobile();
    router.push('/');
    window.dispatchEvent(new CustomEvent('open-single-use-links'));
  };

  const openMeetingPolls = () => {
    setCreateMenuOpen(false);
    onCloseMobile();
    router.push('/');
    window.dispatchEvent(new CustomEvent('open-meeting-polls'));
  };

  const sidebarCollapsed = isDesktopViewport ? collapsed : false;

  const sidebarStyle = {
    '--sidebar-width': `${sidebarCollapsed ? 88 : 230}px`,
  } as CSSProperties;

  return (
    <aside
      className={`fixed left-0 top-0 z-50 flex h-screen w-[280px] flex-col border-r-2 border-ink bg-paper transition-transform duration-300 ease-out lg:w-sidebar ${
 mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
 }`}
      style={sidebarStyle}
    >
      <div className={sidebarCollapsed ? 'p-4 pb-2' : 'p-4 sm:p-6 sm:pb-2 pb-2'}>
        {/* Logo */}
        <div className="flex items-center gap-2 mb-6 cursor-pointer select-none">
          <div className="w-8 h-8 flex items-center justify-center text-stamp shrink-0">
            <span className="material-symbols-outlined text-xl font-bold transform -rotate-6">gavel</span>
          </div>
          {!sidebarCollapsed && (
            <span className="font-display text-[20px] font-bold tracking-tight text-ink">PanelFlow</span>
          )}

          <button
            type="button"
            onClick={onCloseMobile}
            className="ml-auto inline-flex h-10 w-10 items-center justify-center text-ink/70 hover:text-ink lg:hidden"
            aria-label="Close sidebar"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>

          <button
            type="button"
            onClick={onToggleCollapsed}
            className="ml-auto hidden p-1 text-ink/50 transition-colors hover:text-ink lg:inline-flex"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <span className="material-symbols-outlined text-[20px]">
              {sidebarCollapsed ? 'keyboard_double_arrow_right' : 'keyboard_double_arrow_left'}
            </span>
          </button>
        </div>

        {/* Create Button */}
        <div className="relative mb-6" ref={createMenuRef}>
          <button
            type="button"
            onClick={() => setCreateMenuOpen((value) => !value)}
            className={
              sidebarCollapsed
                ? 'mx-auto flex h-11 w-11 items-center justify-center rounded-sm border border-ink bg-paper text-ink transition-colors hover:bg-clay/10 focus:outline-none focus:ring-2 focus:ring-stamp focus:ring-offset-1 lg:h-10 lg:w-10'
                : 'w-full h-10 flex items-center justify-center gap-2 rounded-sm border border-ink bg-ink text-paper font-display font-medium text-sm hover:bg-ink/90 transition-colors focus:outline-none focus:ring-2 focus:ring-stamp focus:ring-offset-1'
            }
            aria-label="Create"
            aria-haspopup="menu"
            aria-expanded={createMenuOpen}
          >
            <span className="material-symbols-outlined text-xl font-bold">add</span>
            {!sidebarCollapsed && 'Create'}
          </button>

          {createMenuOpen ? (
            <div className={`absolute top-[calc(100%+8px)] z-50 ${sidebarCollapsed ? 'left-0' : 'left-0'}`}>
              <CreateMenuPopover
                onCreateEventType={openEventTypeCreate}
                onCreateSingleUseLink={openSingleUseLinks}
                onCreateMeetingPoll={openMeetingPolls}
              />
            </div>
          ) : null}
        </div>
      </div>

      {/* Navigation */}
      <nav className={sidebarCollapsed ? 'flex-1 overflow-y-auto px-1' : 'flex-1 overflow-y-auto px-2'}>
        {navLinks.map((link) => {
          const active = isActive(link.href);
          return (
            <Link
              key={link.name}
              href={link.href}
              onClick={onCloseMobile}
              className={
                sidebarCollapsed
                  ? `group mb-1 flex min-h-11 flex-col items-center justify-center px-2 py-3 text-center font-display text-[11px] font-bold leading-tight transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-stamp ${
                      active
                        ? 'bg-ink text-paper'
                        : 'text-ink hover:bg-clay/10'
                    }`
                  : `group mb-1 flex min-h-10 items-center gap-3 px-4 py-2 font-display text-sm font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-stamp ${
                      active
                        ? 'bg-ink text-paper'
                        : 'text-ink hover:bg-clay/10'
                    }`
              }
            >
              <span
                className={`material-symbols-outlined transition-transform ${sidebarCollapsed ? 'text-[20px]' : 'text-[22px]'} ${
 active ? '' : 'group-hover:scale-110'
 }`}
              >
                {link.icon}
              </span>
              <span className={sidebarCollapsed ? 'mt-1' : ''}>{link.name}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
