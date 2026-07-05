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

const API_URL = normalizeApiBaseUrl();
const AUTH_STORAGE_KEYS = ['access_token', 'refresh_token'] as const;

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
          const response = await axios.post(`${API_URL}/auth/refresh`, { refresh_token: refreshToken });
          const { access_token, refresh_token } = response.data;
          localStorage.setItem('access_token', access_token);
          if (refresh_token) {
            localStorage.setItem('refresh_token', refresh_token);
          }
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return api(originalRequest);
        } catch (refreshError) {
          clearAuthStorage();
          redirectToLogin();
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
