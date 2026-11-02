'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getMe, login as apiLogin, logout as apiLogout, type AuthUser } from '@/lib/api';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Hydrate from /auth/me on mount (cookie is httpOnly — JS can't read it directly)
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    const hydrate = async () => {
      try {
        let data;
        try {
          data = await getMe(controller.signal);
        } catch (error) {
          if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) {
            throw error;
          }
          await new Promise<void>((resolve) => setTimeout(resolve, 500));
          data = await getMe(controller.signal);
        }

        if (active) setUser(data.user);
      } catch {
        if (active) setUser(null);
      } finally {
        clearTimeout(timeoutId);
        if (active) setLoading(false);
      }
    };

    void hydrate();

    return () => {
      active = false;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await apiLogin(email, password);
    const data = await getMe();
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } finally {
      setUser(null);
      window.location.href = '/login';
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const data = await getMe();
    setUser(data.user);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
