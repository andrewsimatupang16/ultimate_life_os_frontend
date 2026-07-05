import { useEffect, useState, type ReactNode } from 'react';
import { authApi } from '@/api/auth';
import type { AuthResponse, User } from '@/types';
import { AuthContext } from '@/context/auth-context';

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const normalizeOptionalText = (value?: string) => value?.trim() || undefined;
const AUTH_STORAGE_KEYS = ['access_token', 'refresh_token'] as const;

function clearAuthStorage() {
  AUTH_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
}

function getTokenExpiry(token: string) {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, '=');
    const decoded = JSON.parse(window.atob(paddedPayload)) as { exp?: unknown };
    return typeof decoded.exp === 'number' ? decoded.exp : null;
  } catch {
    return null;
  }
}

function isTokenExpiredOrNearExpiry(token: string) {
  const expiry = getTokenExpiry(token);
  if (!expiry) return true;
  const refreshMarginSeconds = 30;
  return expiry <= Math.floor(Date.now() / 1000) + refreshMarginSeconds;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const saveAuth = (data: AuthResponse) => {
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    setUser(data.user);
  };

  const login = async (email: string, password: string) => {
    const res = await authApi.login(normalizeEmail(email), password);
    saveAuth(res.data);
  };

  const register = async (email: string, password: string, fullName?: string) => {
    const res = await authApi.register(normalizeEmail(email), password, normalizeOptionalText(fullName));
    saveAuth(res.data);
  };

  const logout = () => {
    clearAuthStorage();
    setUser(null);
  };

  const refreshUser = async () => {
    const res = await authApi.me();
    setUser(res.data);
  };

  useEffect(() => {
    const loadUser = async () => {
      const accessToken = localStorage.getItem('access_token');
      const refreshToken = localStorage.getItem('refresh_token');

      if (!accessToken && !refreshToken) {
        setLoading(false);
        return;
      }

      try {
        if (refreshToken && (!accessToken || isTokenExpiredOrNearExpiry(accessToken))) {
          const res = await authApi.refresh(refreshToken);
          saveAuth(res.data);
          return;
        }

        if (accessToken) {
          const res = await authApi.me({ skipAuthRefresh: true });
          setUser(res.data);
          return;
        }

        logout();
      } catch {
        logout();
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}
