export function formatNumber(n: number, locale = "pt-PT"): string {
  return n.toLocaleString(locale);
}

export function formatCurrency(n: number, locale = "pt-PT"): string {
  return n.toLocaleString(locale, {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatDecimal(n: number, digits = 2, locale = "pt-PT"): string {
  return n.toLocaleString(locale, {
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

export function formatPercentage(n: number, locale = "pt-PT"): string {
  return `${n.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

export function formatDuration(ms: number, locale = "pt-PT"): string {
  const english = locale.toLowerCase().startsWith("en");
  if (ms < 1000) {
    const value = Math.round(ms);
    if (value >= 1000) return english ? "1 second" : "1 segundo";
    return `${value} ${english ? (value === 1 ? "millisecond" : "milliseconds") : (value === 1 ? "milissegundo" : "milissegundos")}`;
  }
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) {
    const seconds = ms / 1000;
    const value = seconds.toLocaleString(locale, {
      maximumFractionDigits: 1,
    });
    return `${value} ${english ? (totalSeconds === 1 ? "second" : "seconds") : (totalSeconds === 1 ? "segundo" : "segundos")}`;
  }

  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  const minutesLabel = english ? (mins === 1 ? "minute" : "minutes") : (mins === 1 ? "minuto" : "minutos");
  if (secs === 0) return `${mins} ${minutesLabel}`;
  return `${mins} ${minutesLabel} ${english ? "and" : "e"} ${secs} ${english ? (secs === 1 ? "second" : "seconds") : (secs === 1 ? "segundo" : "segundos")}`;
}
