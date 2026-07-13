import { useEffect, useState, type ReactNode } from 'react';
import { authApi } from '@/api/auth';
import { isTransientConnectionError } from '@/api/axios';
import type { AuthResponse, User } from '@/types';
import { AuthContext } from '@/context/auth-context';

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const normalizeOptionalText = (value?: string) => value?.trim() || undefined;
const AUTH_STORAGE_KEYS = ['access_token', 'refresh_token', 'auth_user'] as const;

function clearAuthStorage() {
  AUTH_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
}


function saveCachedUser(user: User) {
  localStorage.setItem('auth_user', JSON.stringify(user));
}

function readCachedUser(): User | null {
  const rawUser = localStorage.getItem('auth_user');
  if (!rawUser) return null;

  try {
    const parsed = JSON.parse(rawUser) as Partial<User>;
    return typeof parsed.id === 'string' ? (parsed as User) : null;
  } catch {
    localStorage.removeItem('auth_user');
    return null;
  }
}

function decodeTokenPayload(token: string): Record<string, unknown> | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, '=');
    return JSON.parse(window.atob(paddedPayload)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function buildFallbackUserFromToken(token: string | null): User | null {
  if (!token) return null;
  const payload = decodeTokenPayload(token);
  const userId = payload?.sub;
  if (typeof userId !== 'string' || !userId) return null;

  const now = new Date().toISOString();
  return {
    id: userId,
    email: '',
    full_name: null,
    avatar_url: null,
    friend_code: null,
    level: 1,
    xp_balance: 0,
    total_xp_earned: 0,
    coin_balance: 0,
    active_title: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
}

function isAuthRejection(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const maybeAxiosError = error as { response?: { status?: number } };
  return maybeAxiosError.response?.status === 401 || maybeAxiosError.response?.status === 403;
}

function getTokenExpiry(token: string) {
  const decoded = decodeTokenPayload(token) as { exp?: unknown } | null;
  return typeof decoded?.exp === 'number' ? decoded.exp : null;
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
    saveCachedUser(data.user);
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
    saveCachedUser(res.data);
    setUser(res.data);
  };

  useEffect(() => {
    let isMounted = true;

    const finishLoading = () => {
      if (isMounted) {
        setLoading(false);
      }
    };

    const loadUser = async () => {
      const accessToken = localStorage.getItem('access_token');
      const refreshToken = localStorage.getItem('refresh_token');

      if (!accessToken && !refreshToken) {
        clearAuthStorage();
        setUser(null);
        finishLoading();
        return;
      }

      const optimisticUser = readCachedUser() || buildFallbackUserFromToken(accessToken || refreshToken);
      if (optimisticUser) {
        setUser(optimisticUser);
        finishLoading();
      }

      try {
        if (refreshToken && (!accessToken || isTokenExpiredOrNearExpiry(accessToken))) {
          const res = await authApi.refresh(refreshToken);
          if (isMounted) {
            saveAuth(res.data);
          }
          return;
        }

        if (accessToken) {
          const res = await authApi.me({ skipAuthRefresh: true });
          if (isMounted) {
            saveCachedUser(res.data);
            setUser(res.data);
          }
          return;
        }

        if (isMounted) {
          logout();
        }
      } catch (error) {
        if (isAuthRejection(error)) {
          if (isMounted) {
            logout();
          }
          return;
        }

        if (isTransientConnectionError(error) && optimisticUser) {
          if (isMounted) {
            setUser(optimisticUser);
          }
          return;
        }

        if (isMounted) {
          logout();
        }
      } finally {
        finishLoading();
      }
    };

    void loadUser();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}
