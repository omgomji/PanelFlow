import * as React from 'react';
import Link from 'next/link';

export interface SidebarNavItemProps {
  href: string;
  icon: string;
  label: string;
  isActive?: boolean;
}

export function SidebarNavItem({ href, icon, label, isActive = false }: SidebarNavItemProps) {
  return (
    <Link
      href={href}
      className={`group flex items-center gap-3 px-4 py-3 font-display text-sm font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-stamp ${
 isActive
 ? 'bg-ink text-paper'
 : 'text-ink hover:bg-clay/10 hover:text-ink'
 }`}
    >
      <span
        className={`material-symbols-outlined text-[20px] transition-transform ${
 isActive ? 'scale-110' : 'group-hover:scale-110'
 }`}
      >
        {icon}
      </span>
      <span>{label}</span>
    </Link>
  );
}
