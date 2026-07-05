export function isBlank(value: string | null | undefined) {
  return !value || value.trim().length === 0;
}

export function parsePositiveNumber(value: string, label: string) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    return {
      ok: false as const,
      message: `${label} harus lebih dari 0.`,
    };
  }

  return {
    ok: true as const,
    value: numberValue,
  };
}

export function parseNonNegativeNumber(value: string | number, label: string) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return {
      ok: false as const,
      message: `${label} tidak boleh kurang dari 0.`,
    };
  }

  return {
    ok: true as const,
    value: numberValue,
  };
}

export function isValidDateTimeLocal(value: string | null | undefined) {
  if (!value) return false;

  return Number.isFinite(new Date(value).getTime());
}

export function parseOptionalDateTimeLocal(value: string, label: string) {
  if (!value) {
    return {
      ok: true as const,
      value: null,
    };
  }

  if (!isValidDateTimeLocal(value)) {
    return {
      ok: false as const,
      message: `${label} tidak valid.`,
    };
  }

  return {
    ok: true as const,
    value,
  };
}

export function isInvalidDateRange(startDate: string, endDate: string) {
  if (!startDate || !endDate) return false;

  const startTime = new Date(startDate).getTime();
  const endTime = new Date(endDate).getTime();

  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) return true;

  return endTime <= startTime;
}
