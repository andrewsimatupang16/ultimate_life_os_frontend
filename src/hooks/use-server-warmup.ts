import { useCallback, useEffect, useRef, useState } from 'react';
import { API_URL } from '@/api/axios';

type ServerWarmupStatus = 'checking' | 'waking' | 'ready' | 'unavailable';

type ServerWarmupState = {
  status: ServerWarmupStatus;
  lastCheckedAt: Date | null;
  lastError: string | null;
  retry: () => Promise<boolean>;
};

const DEFAULT_INTERVAL_MS = 10 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 12 * 1000;
const SLOW_NOTICE_DELAY_MS = 2500;

function envFlag(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  return !['0', 'false', 'no', 'off'].includes(String(value).trim().toLowerCase());
}

function envNumber(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getHealthUrl(): string {
  return `${API_URL.replace(/\/+$/, '')}/health`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'Request timeout';
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown connection error';
}

export function useServerWarmup(): ServerWarmupState {
  const enabled = envFlag(import.meta.env.VITE_SERVER_WARMUP_ENABLED, true);
  const intervalMs = envNumber(import.meta.env.VITE_SERVER_WARMUP_INTERVAL_MS, DEFAULT_INTERVAL_MS);
  const timeoutMs = envNumber(import.meta.env.VITE_SERVER_WARMUP_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  const healthUrl = getHealthUrl();

  const [status, setStatus] = useState<ServerWarmupStatus>(enabled ? 'checking' : 'ready');
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const pingServer = useCallback(
    async (showCheckingState: boolean): Promise<boolean> => {
      if (!enabled) {
        setStatus('ready');
        setLastError(null);
        return true;
      }

      if (showCheckingState) {
        setStatus('checking');
      }

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
      const slowNoticeId = window.setTimeout(() => {
        if (mountedRef.current) {
          setStatus((currentStatus) => (currentStatus === 'checking' ? 'waking' : currentStatus));
        }
      }, SLOW_NOTICE_DELAY_MS);

      try {
        const response = await fetch(healthUrl, {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
          },
        });

        if (!mountedRef.current) {
          return response.ok;
        }

        setLastCheckedAt(new Date());

        if (response.ok) {
          setStatus('ready');
          setLastError(null);
          return true;
        }

        setStatus('unavailable');
        setLastError(`HTTP ${response.status}`);
        return false;
      } catch (error) {
        if (mountedRef.current) {
          setStatus('unavailable');
          setLastCheckedAt(new Date());
          setLastError(getErrorMessage(error));
        }
        return false;
      } finally {
        window.clearTimeout(timeoutId);
        window.clearTimeout(slowNoticeId);
      }
    },
    [enabled, healthUrl, timeoutMs]
  );

  useEffect(() => {
    mountedRef.current = true;

    if (!enabled) {
      setStatus('ready');
      return () => {
        mountedRef.current = false;
      };
    }

    void pingServer(true);

    const intervalId = window.setInterval(() => {
      void pingServer(false);
    }, intervalMs);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void pingServer(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      mountedRef.current = false;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, intervalMs, pingServer]);

  return {
    status,
    lastCheckedAt,
    lastError,
    retry: () => pingServer(true),
  };
}
