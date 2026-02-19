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
