const PT_LOCALE = "pt-PT";

export function formatNumber(n: number): string {
  return n.toLocaleString(PT_LOCALE);
}

export function formatCurrency(n: number): string {
  return n.toLocaleString(PT_LOCALE, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatDecimal(n: number, digits = 2): string {
  return n.toLocaleString(PT_LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatPercentage(n: number): string {
  return `${n.toFixed(1)}%`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) {
    const value = Math.round(ms);
    if (value >= 1000) return "1 segundo";
    return `${value} ${value === 1 ? "milissegundo" : "milissegundos"}`;
  }
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) {
    const seconds = ms / 1000;
    const value = seconds.toLocaleString(PT_LOCALE, {
      maximumFractionDigits: 1,
    });
    return `${value} ${totalSeconds === 1 ? "segundo" : "segundos"}`;
  }

  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  const minutesLabel = mins === 1 ? "minuto" : "minutos";
  if (secs === 0) return `${mins} ${minutesLabel}`;
  return `${mins} ${minutesLabel} e ${secs} ${secs === 1 ? "segundo" : "segundos"}`;
}
