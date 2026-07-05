'use client';

import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Switch } from '@/components/ui/Switch';
import { Button } from '@/components/ui/Button';

interface EventCardProps {
  id: number;
  title: string;
  slug: string;
  duration: number;
  description?: string | null;
  bookingUrl?: string;
  publicUsername?: string;
  isActive: boolean;
  onDelete: (id: number) => void;
  onEdit: (event: { id: number; title: string; slug: string; duration: number; description?: string | null }) => void;
  onBookMeeting: (event: { id: number; title: string; slug: string; duration: number; description?: string | null; bookingUrl?: string }) => void;
  onCreateSingleUseLink: (event: { id: number; title: string; slug: string; duration: number; description?: string | null; bookingUrl?: string }) => void;
  onDuplicate: (event: { id: number; title: string; slug: string; duration: number; description?: string | null; bookingUrl?: string }) => void;
  onToggleActive: (event: { id: number; title: string; slug: string; duration: number; description?: string | null; bookingUrl?: string }, nextValue: boolean) => void | Promise<void>;
  onSelect?: (event: { id: number; title: string; slug: string; duration: number; description?: string | null }) => void;
  selected?: boolean;
}

export default function EventCard({
  id,
  title,
  slug,
  duration,
  description,
  bookingUrl,
  publicUsername,
  isActive,
  onDelete,
  onEdit,
  onBookMeeting,
  onCreateSingleUseLink,
  onDuplicate,
  onToggleActive,
  onSelect,
  selected = false,
}: EventCardProps) {
  const [copied, setCopied] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [active, setActive] = useState(isActive);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const eventPayload = { id, title, slug, duration, description, bookingUrl };

  const getPublicUrl = () => {
    if (bookingUrl && bookingUrl.startsWith('http')) return bookingUrl;
    if (bookingUrl) return `${window.location.origin}${bookingUrl}`;
    if (publicUsername) return `${window.location.origin}/${publicUsername}/${slug}`;
    return null;
  };

  const openBookingPage = () => {
    const url = getPublicUrl();
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      onBookMeeting(eventPayload);
    }
  };

  const copyLink = async () => {
    const url = getPublicUrl() ?? `${window.location.origin}/${slug}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  useEffect(() => {
    setActive(isActive);
  }, [isActive]);

  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };

    const onPointerDown = (e: MouseEvent | PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [menuOpen]);

  return (
    <Card
      className={`group relative overflow-visible ${
 selected ? 'border-2 border-stamp' : 'border-ink'
 }`}
      onClick={() => onSelect?.(eventPayload)}
    >
      <div className={`absolute left-0 top-0 h-full w-2 ${active ? 'bg-stamp' : 'bg-clay'}`} aria-hidden="true" />

      <div className="flex flex-wrap items-center gap-4 px-2 sm:px-4">
        <input
          type="checkbox"
          aria-label={`Select ${title}`}
          checked={selected}
          onChange={() => onSelect?.(eventPayload)}
          onClick={(e) => e.stopPropagation()}
          className="h-5 w-5 cursor-pointer border-ink text-stamp focus:ring-stamp"
        />

        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onEdit(eventPayload)}
            className="block max-w-full truncate text-left font-display text-lg font-bold text-ink hover:text-stamp focus:outline-none focus:underline"
            title={title}
          >
            {title}
          </button>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] font-medium text-ink/70">
            <span>{duration} min</span>
            <span className="text-clay/50">•</span>
            <span>Google Meet</span>
            <span className="text-clay/50">•</span>
            <span>One-on-One</span>
          </div>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          <div className="flex items-center gap-2 md:pointer-events-none md:opacity-0 md:transition-opacity md:group-hover:pointer-events-auto md:group-hover:opacity-100 md:group-focus-within:pointer-events-auto md:group-focus-within:opacity-100">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onBookMeeting(eventPayload);
              }}
              title="Book meeting"
              aria-label="Book meeting"
            >
              <span className="material-symbols-outlined text-[18px]">calendar_add_on</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onCreateSingleUseLink(eventPayload);
              }}
              title="Create single-use link"
              aria-label="Create single-use link"
            >
              <span className="material-symbols-outlined text-[18px]">switch_access_shortcut</span>
            </Button>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              void copyLink();
            }}
            className="gap-2"
          >
            <span className="material-symbols-outlined rotate-[135deg] text-[16px]">link</span>
            <span className="text-[13px] font-bold">{copied ? 'Copied' : 'Copy'}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              openBookingPage();
            }}
            title="Open booking page"
            aria-label="Open booking page"
          >
            <span className="material-symbols-outlined text-[18px]">open_in_new</span>
          </Button>

          <div className="relative" ref={menuRef}>
            <Button
              variant="ghost"
              size="sm"
              aria-label="More actions"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
            >
              <span className="material-symbols-outlined text-[20px]">more_vert</span>
            </Button>

            {menuOpen && (
              <div
                role="menu"
                aria-label="Event type actions"
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-full z-50 mt-2 w-[min(250px,90vw)] overflow-hidden border-2 border-ink bg-paper shadow-sm"
              >
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left font-display text-[14px] font-bold text-ink hover:bg-clay/10 focus:bg-clay/10"
                  onClick={() => {
                    setMenuOpen(false);
                    onBookMeeting(eventPayload);
                  }}
                >
                  <span className="material-symbols-outlined text-[18px] text-ink/70">open_in_new</span>
                  View booking page
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left font-display text-[14px] font-bold text-ink hover:bg-clay/10 focus:bg-clay/10"
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit(eventPayload);
                  }}
                >
                  <span className="material-symbols-outlined text-[18px] text-ink/70">edit</span>
                  Edit
                </button>

                <div className="my-1 h-[2px] bg-ink" />

                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left font-display text-[14px] font-bold text-ink hover:bg-clay/10 focus:bg-clay/10"
                  onClick={() => {
                    setMenuOpen(false);
                    onDuplicate(eventPayload);
                  }}
                >
                  <span className="material-symbols-outlined text-[18px] text-ink/70">content_copy</span>
                  Duplicate
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left font-display text-[14px] font-bold text-oxblood hover:bg-oxblood/10 focus:bg-oxblood/10"
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete(id);
                  }}
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                  Delete
                </button>

                <div className="my-1 h-[2px] bg-ink" />

                <div className="flex items-center justify-between px-4 py-3">
                  <span className="font-display text-[14px] font-bold text-ink">Active Status</span>
                  <Switch
                    checked={active}
                    onCheckedChange={async (nextValue) => {
                      setActive(nextValue);
                      await onToggleActive(eventPayload, nextValue);
                    }}
                    aria-label="Toggle event active status"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
