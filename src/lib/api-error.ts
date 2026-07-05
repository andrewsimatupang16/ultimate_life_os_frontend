import type { AxiosError } from 'axios';

type ApiValidationError = {
  loc?: Array<string | number>;
  msg?: string;
  type?: string;
};

type ApiErrorBody = {
  detail?: string | ApiValidationError[] | Record<string, unknown>;
  message?: string;
};

function humanizeValidationError(item: ApiValidationError) {
  const field = item.loc?.filter((part) => part !== 'body').join('.') || '';
  const message = item.msg || 'Input tidak valid';
  return field ? `${field}: ${message}` : message;
}

function statusFallback(status?: number) {
  switch (status) {
    case 400:
      return 'Request tidak valid. Periksa kembali data yang dikirim.';
    case 401:
      return 'Sesi login berakhir. Silakan login ulang.';
    case 403:
      return 'Anda tidak memiliki akses untuk menjalankan aksi ini.';
    case 404:
      return 'Data yang diminta tidak ditemukan atau sudah dihapus.';
    case 409:
      return 'Aksi ditolak karena bertentangan dengan kondisi data saat ini.';
    case 422:
      return 'Validasi data gagal. Periksa field yang wajib diisi dan format nilainya.';
    case 500:
      return 'Server gagal memproses data. Periksa log backend untuk detail teknis.';
    default:
      return undefined;
  }
}

export function getApiErrorMessage(error: unknown, fallback = 'Terjadi kesalahan. Silakan coba lagi.') {
  const axiosError = error as AxiosError<ApiErrorBody>;
  const status = axiosError.response?.status;
  const detail = axiosError.response?.data?.detail;
  const message = axiosError.response?.data?.message;

  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    const firstMessage = detail.find((item) => typeof item.msg === 'string');
    if (firstMessage) return humanizeValidationError(firstMessage);
  }
  if (detail && typeof detail === 'object') {
    const nestedMessage = 'message' in detail ? detail.message : undefined;
    if (typeof nestedMessage === 'string' && nestedMessage.trim()) return nestedMessage;
  }
  if (typeof message === 'string' && message.trim()) return message;
  if (!axiosError.response && axiosError.request) {
    return 'Tidak bisa terhubung ke backend. Pastikan API server berjalan dan URL API benar.';
  }
  const byStatus = statusFallback(status);
  if (byStatus) return byStatus;
  if (error instanceof Error && error.message) return error.message;

  return fallback;
}
