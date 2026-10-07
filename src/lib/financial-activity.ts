import type { DayStats } from "./types/analysis";

export type ActivityPeriod = "day" | "week" | "month" | "quarter" | "year";

export interface ActivityBucket {
  key: string;
  label: string;
  grossTotal: number;
  documentCount: number;
}

export interface ActivitySeries {
  period: ActivityPeriod;
  buckets: ActivityBucket[];
}

export const ACTIVITY_PERIOD_LABELS: Record<ActivityPeriod, string> = {
  day: "dia",
  week: "semana",
  month: "mês",
  quarter: "trimestre",
  year: "ano",
};

export function groupFinancialActivity(dayStats: DayStats[]): ActivitySeries {
  const validStats = dayStats
    .map((day) => ({ day, date: new Date(`${day.date}T00:00:00.000Z`) }))
    .filter(({ date }) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const spanDays = validStats.length > 1
    ? (validStats[validStats.length - 1].date.getTime() - validStats[0].date.getTime()) / 86_400_000
    : 0;
  const period: ActivityPeriod =
    spanDays <= 45 ? "day" :
    spanDays <= 365 ? "week" :
    spanDays <= 1095 ? "month" :
    spanDays <= 4380 ? "quarter" : "year";
  const buckets = new Map<string, ActivityBucket>();
  const shortDate = new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
  const monthDate = new Intl.DateTimeFormat("pt-PT", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

  for (const { day, date } of validStats) {
    const start = new Date(date);
    if (period === "week") {
      start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
    } else if (period === "month") {
      start.setUTCDate(1);
    } else if (period === "quarter") {
      start.setUTCMonth(Math.floor(start.getUTCMonth() / 3) * 3, 1);
    } else if (period === "year") {
      start.setUTCMonth(0, 1);
    }

    const key = start.toISOString().slice(0, 10);
    let label: string;
    if (period === "day") {
      label = shortDate.format(start);
    } else if (period === "week") {
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 6);
      label = `${shortDate.format(start)} - ${shortDate.format(end)}`;
    } else if (period === "month") {
      label = monthDate.format(start);
    } else if (period === "quarter") {
      label = `T${Math.floor(start.getUTCMonth() / 3) + 1} ${start.getUTCFullYear()}`;
    } else {
      label = String(start.getUTCFullYear());
    }

    const bucket = buckets.get(key) ?? {
      key,
      label,
      grossTotal: 0,
      documentCount: 0,
    };
    bucket.grossTotal += day.grossTotal;
    bucket.documentCount += day.documentCount;
    buckets.set(key, bucket);
  }

  return { period, buckets: Array.from(buckets.values()) };
}
