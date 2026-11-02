'use client';

import * as React from 'react';
import type { Dispatch, SetStateAction } from 'react';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  theme: Theme;
  setTheme: Dispatch<SetStateAction<Theme>>;
  systemTheme: 'light' | 'dark';
  resolvedTheme: 'light' | 'dark';
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = React.useState<Theme>('system');
  const [mounted, setMounted] = React.useState(false);
  const [systemTheme, setSystemTheme] = React.useState<'light' | 'dark'>('light');

  React.useEffect(() => {
    setMounted(true);
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemTheme(media.matches ? 'dark' : 'light');
    const handler = (e: MediaQueryListEvent) => setSystemTheme(e.matches ? 'dark' : 'light');
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, []);

  const resolvedTheme = React.useMemo(() => {
    if (theme === 'system') return systemTheme;
    return theme;
  }, [theme, systemTheme]);

  React.useEffect(() => {
    if (!mounted) return;
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(resolvedTheme);
  }, [resolvedTheme, mounted]);

  const value = React.useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, systemTheme, resolvedTheme }),
    [theme, setTheme, systemTheme, resolvedTheme],
  );

  if (!mounted) {
    return <>{children}</>;
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = React.useContext(ThemeContext);
  if (!context) {
    return { theme: 'system', setTheme: () => {}, systemTheme: 'light', resolvedTheme: 'light' };
  }
  return context;
}

export { ThemeContext };
