import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

const TARGET_PREFIX = 'dashboard-target-';

export function dashboardTargetId(id: string) {
  return `${TARGET_PREFIX}${id}`;
}

export function useDashboardTargetHighlight() {
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight') || '';

  useEffect(() => {
    if (!highlightId) return undefined;

    const timeoutId = window.setTimeout(() => {
      document.getElementById(dashboardTargetId(highlightId))?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [highlightId]);

  const highlightClassName = (id: string) =>
    id === highlightId ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-white' : '';

  return { highlightId, highlightClassName };
}
