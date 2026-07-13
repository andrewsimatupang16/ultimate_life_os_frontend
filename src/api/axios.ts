import axios from 'axios';

declare module 'axios' {
  export interface AxiosRequestConfig {
    _retry?: boolean;
    skipAuthRefresh?: boolean;
  }
}

function normalizeApiBaseUrl(): string {
  const explicitApiUrl = (
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_API_BASE_URL ||
    ''
  ).trim();

  const useDevProxy = String(import.meta.env.VITE_USE_API_PROXY || '').toLowerCase() === 'true';

  if (import.meta.env.DEV && useDevProxy) {
    return '/api';
  }

  if (explicitApiUrl) {
    return explicitApiUrl.replace(/\/+$/, '');
  }

  if (import.meta.env.DEV) {
    return 'http://localhost:8000';
  }

  return '/api';
}

export const API_URL = normalizeApiBaseUrl();
const AUTH_STORAGE_KEYS = ['access_token', 'refresh_token', 'auth_user'] as const;

const DEFAULT_API_TIMEOUT_MS = 25_000;

function getApiTimeoutMs(): number {
  const rawValue = import.meta.env.VITE_API_TIMEOUT_MS;
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_API_TIMEOUT_MS;
}

export function isTransientConnectionError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) {
    return false;
  }

  if (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK') {
    return true;
  }

  if (!error.response) {
    return true;
  }

  return error.response.status >= 500;
}

function clearAuthStorage() {
  AUTH_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
}

function redirectToLogin() {
  if (window.location.pathname !== '/login') {
    window.location.assign('/login');
  }
}

const api = axios.create({
  baseURL: API_URL,
  timeout: getApiTimeoutMs(),
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const requestUrl = String(originalRequest?.url || '');
    const isAuthRequest = requestUrl.includes('/auth/login')
      || requestUrl.includes('/auth/register')
      || requestUrl.includes('/auth/refresh');

    if (
      error.response?.status === 401
      && originalRequest
      && !originalRequest._retry
      && !originalRequest.skipAuthRefresh
      && !isAuthRequest
    ) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');

      if (refreshToken) {
        try {
          const response = await axios.post(`${API_URL}/auth/refresh`, { refresh_token: refreshToken }, { timeout: getApiTimeoutMs() });
          const { access_token, refresh_token, user } = response.data;
          localStorage.setItem('access_token', access_token);
          if (refresh_token) {
            localStorage.setItem('refresh_token', refresh_token);
          }
          if (user) {
            localStorage.setItem('auth_user', JSON.stringify(user));
          }
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return api(originalRequest);
        } catch (refreshError) {
          if (!isTransientConnectionError(refreshError)) {
            clearAuthStorage();
            redirectToLogin();
          }
          return Promise.reject(refreshError);
        }
      }

      clearAuthStorage();
      redirectToLogin();
    }

    return Promise.reject(error);
  }
);

export default api;
