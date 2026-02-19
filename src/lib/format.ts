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
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60000);
  const secs = Math.round((ms % 60000) / 1000);
  return `${mins}m ${secs}s`;
}
