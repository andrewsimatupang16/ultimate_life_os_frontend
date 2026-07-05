import api from './axios';
import type { AuthResponse, User } from '@/types';

export const authApi = {
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { email: email.trim().toLowerCase(), password }),

  register: (email: string, password: string, full_name?: string) =>
    api.post<AuthResponse>('/auth/register', {
      email: email.trim().toLowerCase(),
      password,
      full_name: full_name?.trim() || undefined,
    }),

  me: (options?: { skipAuthRefresh?: boolean }) => api.get<User>('/auth/me', options),

  refresh: (refresh_token: string) =>
    api.post<AuthResponse>('/auth/refresh', { refresh_token }),
};
