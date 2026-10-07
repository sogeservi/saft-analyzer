"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { FinancialSummary } from "@/lib/types/analysis";
import { formatCurrency, formatNumber } from "@/lib/format";

interface FinancialPanelProps {
  summary: FinancialSummary;
}

export function FinancialPanel({ summary }: FinancialPanelProps) {
  const maxDailyTotal = summary.dayStats.reduce(
    (maximum, day) => Math.max(maximum, day.grossTotal),
    1,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Resumo financeiro</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Receita total</p>
            <p className="text-xl font-bold">
              {formatCurrency(summary.totalRevenue)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total crédito</p>
            <p className="text-xl font-bold text-green-600">
              {formatCurrency(summary.totalCredit)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total débito</p>
            <p className="text-xl font-bold text-red-600">
              {formatCurrency(summary.totalDebit)}
            </p>
          </div>
        </div>

        {summary.dayStats.length > 1 && (
          <div className="rounded-xl border bg-gradient-to-br from-muted/50 to-background p-4">
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h4 className="text-sm font-medium">Atividade diária</h4>
              <span className="text-xs text-muted-foreground">Total bruto por data</span>
            </div>
            <svg
              role="img"
              aria-label={`Gráfico da atividade diária em ${summary.dayStats.length} datas`}
              viewBox="0 0 600 120"
              className="h-28 w-full"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="daily-activity" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0.12" />
                </linearGradient>
              </defs>
              <path d="M0 108 H600" stroke="currentColor" strokeOpacity="0.12" />
              {summary.dayStats.map((day, index) => {
                const count = summary.dayStats.length;
                const slot = 600 / count;
                const barWidth = Math.max(2, slot * 0.62);
                const height = Math.max(2, (Math.max(0, day.grossTotal) / maxDailyTotal) * 96);
                return (
                  <rect
                    key={day.date}
                    x={index * slot + (slot - barWidth) / 2}
                    y={108 - height}
                    width={barWidth}
                    height={height}
                    rx="3"
                    className="text-cyan-600 dark:text-cyan-400"
                    fill="url(#daily-activity)"
                  >
                    <title>{`${day.date}: ${formatCurrency(day.grossTotal)}`}</title>
                  </rect>
                );
              })}
            </svg>
          </div>
        )}

        {summary.vatBreakdown.length > 0 && (
          <div>
            <h4 className="mb-2 text-sm font-medium">IVA por taxa</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Taxa</TableHead>
                  <TableHead>Região</TableHead>
                  <TableHead className="text-right">Base</TableHead>
                  <TableHead className="text-right">IVA</TableHead>
                  <TableHead className="text-right">Docs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.vatBreakdown.map((vat, i) => (
                  <TableRow key={i}>
                    <TableCell>{vat.taxPercentage}%</TableCell>
                    <TableCell>{vat.taxCountryRegion}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(vat.baseAmount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(vat.taxAmount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(vat.documentCount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {summary.documentTypeCounts.length > 0 && (
          <div>
            <h4 className="mb-2 text-sm font-medium">Documentos por tipo</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead className="text-right">Total bruto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.documentTypeCounts.map((dt, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{dt.type}</TableCell>
                    <TableCell className="text-right">
                      {formatNumber(dt.count)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(dt.grossTotal)}
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
