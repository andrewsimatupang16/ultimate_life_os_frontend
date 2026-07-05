export function formatCurrency(value: number | null | undefined) {
  return `Rp ${(value || 0).toLocaleString('id-ID')}`;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return '-';

  return new Date(value).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return '-';

  return new Date(value).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function toDateTimeLocal(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

export function fromDateTimeLocal(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function fromDateTimeLocalOrUndefined(value: string | null | undefined): string | undefined {
  return fromDateTimeLocal(value) ?? undefined;
}
