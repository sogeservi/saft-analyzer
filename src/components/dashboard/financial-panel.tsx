"use client";

import { ArrowDownRight, ArrowUpRight, CircleDollarSign, CircleHelp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { FinancialSummary } from "@/lib/types/analysis";
import { formatCurrency, formatNumber } from "@/lib/format";
import { useLocale } from "@/lib/i18n";
import {
  ACTIVITY_PERIOD_LABELS,
  groupFinancialActivity,
} from "@/lib/financial-activity";

interface FinancialPanelProps {
  summary: FinancialSummary;
}

function MetricCard({
  label,
  value,
  help,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  help: string;
  icon: typeof CircleDollarSign;
  tone: "cyan" | "emerald" | "rose";
}) {
  const { t } = useLocale();
  const tones = {
    cyan: "border-cyan-500/15 from-cyan-500/[0.08] to-transparent text-cyan-700 dark:text-cyan-300",
    emerald: "border-emerald-500/15 from-emerald-500/[0.08] to-transparent text-emerald-700 dark:text-emerald-300",
    rose: "border-rose-500/15 from-rose-500/[0.08] to-transparent text-rose-700 dark:text-rose-300",
  };

  return (
    <div className={`rounded-xl border bg-gradient-to-br p-4 ${tones[tone]}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Icon className="size-4 opacity-80" aria-hidden="true" />
      </div>
      <p className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
        {value}
      </p>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground underline decoration-dotted underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Como se calcula <CircleHelp className="size-3" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{help}</TooltipContent>
      </Tooltip>
    </div>
  );
}

export function FinancialPanel({ summary }: FinancialPanelProps) {
  const { t, languageTag } = useLocale();
  const { period, buckets } = groupFinancialActivity(summary.dayStats, languageTag);
  const periodLabel = t(ACTIVITY_PERIOD_LABELS[period]);
  const maxTotal = buckets.reduce(
    (maximum, bucket) => Math.max(maximum, bucket.grossTotal),
    1,
  );
  const slot = 800 / Math.max(buckets.length, 1);
  const barWidth = Math.max(1, Math.min(26, slot * 0.66));
  const tickInterval = Math.max(1, Math.ceil(buckets.length / 5));

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b bg-gradient-to-r from-cyan-500/[0.06] via-transparent to-transparent pb-5">
        <CardTitle className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-cyan-500/10 text-cyan-700 dark:text-cyan-300">
            <CircleDollarSign className="size-5" />
          </span>
          {t("Resumo financeiro")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pt-5">
        <TooltipProvider>
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard
              label={t("Receita total")}
              value={formatCurrency(summary.totalRevenue, languageTag)}
              help={t("Total de crédito menos total de débito das faturas válidas.")}
              icon={CircleDollarSign}
              tone="cyan"
            />
            <MetricCard
              label={t("Total crédito")}
              value={formatCurrency(summary.totalCredit, languageTag)}
              help={t("Soma dos valores a crédito declarados nos documentos.")}
              icon={ArrowUpRight}
              tone="emerald"
            />
            <MetricCard
              label={t("Total débito")}
              value={formatCurrency(summary.totalDebit, languageTag)}
              help={t("Soma dos valores a débito declarados nos documentos.")}
              icon={ArrowDownRight}
              tone="rose"
            />
          </div>

          {buckets.length > 1 && (
            <section className="rounded-xl border bg-gradient-to-br from-muted/50 via-background to-cyan-500/[0.04] p-4">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold">
                    {t("Atividade por")} {periodLabel}
                  </h4>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("Total bruto e número de documentos por")} {periodLabel}
                  </p>
                </div>
                <span className="rounded-full border bg-background/70 px-2.5 py-1 text-xs text-muted-foreground">
                  {formatNumber(buckets.length, languageTag)} períodos
                </span>
              </div>
              <div className="overflow-x-auto pb-1">
                <svg
                  role="group"
                  aria-label={`${t("Atividade por")} ${periodLabel}, ${t("Total bruto")} e ${t("documentos")} ${t("em")} ${formatNumber(buckets.length, languageTag)} ${t("períodos")}`}
                  viewBox="0 0 800 180"
                  className="h-36 w-full overflow-visible text-muted-foreground"
                  style={{ minWidth: `${Math.max(640, buckets.length * 16)}px` }}
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="activity-bars" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="#0891b2" stopOpacity="0.9" />
                      <stop offset="100%" stopColor="#0891b2" stopOpacity="0.18" />
                    </linearGradient>
                  </defs>
                  {[32, 68, 104, 140].map((y) => (
                    <path
                      key={y}
                      d={`M0 ${y} H800`}
                      stroke="currentColor"
                      strokeOpacity="0.12"
                    />
                  ))}
                  {buckets.map((bucket, index) => {
                    const height = Math.max(2, (Math.max(0, bucket.grossTotal) / maxTotal) * 104);
                    const showLabel =
                      index === 0 ||
                      index === buckets.length - 1 ||
                      index % tickInterval === 0;
                    return (
                      <g key={bucket.key}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <rect
                              x={index * slot}
                              y="32"
                              width={slot}
                              height="108"
                              fill="transparent"
                              pointerEvents="all"
                              tabIndex={0}
                              role="img"
                              aria-label={`${bucket.label}: ${formatCurrency(bucket.grossTotal, languageTag)}, ${formatNumber(bucket.documentCount, languageTag)} ${t("documentos")}`}
                              className="cursor-help outline-none focus-visible:stroke-cyan-500 focus-visible:stroke-2"
                            />
                          </TooltipTrigger>
                          <TooltipContent className="space-y-1">
                            <p className="font-semibold">{bucket.label}</p>
                            <p>{t("Total bruto")}: {formatCurrency(bucket.grossTotal, languageTag)}</p>
                            <p>{formatNumber(bucket.documentCount, languageTag)} {t("documentos")}</p>
                          </TooltipContent>
                        </Tooltip>
                        <rect
                          x={index * slot + (slot - barWidth) / 2}
                          y={140 - height}
                          width={barWidth}
                          height={height}
                          rx="3"
                          fill="url(#activity-bars)"
                          pointerEvents="none"
                          aria-hidden="true"
                        />
                        {showLabel && (
                          <text
                            x={index * slot + slot / 2}
                            y="164"
                            textAnchor="middle"
                            className="fill-muted-foreground"
                            fontSize="10"
                          >
                            {bucket.label}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </svg>
              </div>
            </section>
          )}
        </TooltipProvider>

        {summary.vatBreakdown.length > 0 && (
          <div>
            <h4 className="mb-2 text-sm font-medium">{t("IVA por taxa")}</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("Taxa")}</TableHead>
                  <TableHead>{t("Região")}</TableHead>
                  <TableHead className="text-right">{t("Base")}</TableHead>
                  <TableHead className="text-right">{t("IVA")}</TableHead>
                  <TableHead className="text-right">{t("Docs")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.vatBreakdown.map((vat, i) => (
                  <TableRow key={i}>
                    <TableCell>{vat.taxPercentage}%</TableCell>
                    <TableCell>{vat.taxCountryRegion}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(vat.baseAmount, languageTag)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(vat.taxAmount, languageTag)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(vat.documentCount, languageTag)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {summary.documentTypeCounts.length > 0 && (
          <div>
            <h4 className="mb-2 text-sm font-medium">{t("Documentos por tipo")}</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("Tipo")}</TableHead>
                  <TableHead className="text-right">{t("Quantidade")}</TableHead>
                  <TableHead className="text-right">{t("Total bruto")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.documentTypeCounts.map((dt, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{dt.type}</TableCell>
                    <TableCell className="text-right">
                      {formatNumber(dt.count, languageTag)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(dt.grossTotal, languageTag)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
