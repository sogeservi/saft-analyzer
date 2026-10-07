"use client";

import {
  FileText,
  Users,
  Truck,
  Package,
  Receipt,
  BookOpen,
  CreditCard,
  ScrollText,
  Briefcase,
  AlertTriangle,
  Table2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { AnalysisResult } from "@/lib/types/analysis";
import { formatNumber } from "@/lib/format";

interface SectionCardsProps {
  result: AnalysisResult;
  onSelect: (section: string) => void;
}

interface SectionDef {
  id: string;
  label: string;
  icon: typeof FileText;
  getCount: (r: AnalysisResult) => number;
  getErrors: (r: AnalysisResult) => number;
}

const SECTIONS: SectionDef[] = [
  {
    id: "header",
    label: "Cabeçalho",
    icon: FileText,
    getCount: () => 1,
    getErrors: (r) => r.errors.filter((e) => e.section === "HDR").length,
  },
  {
    id: "customers",
    label: "Clientes",
    icon: Users,
    getCount: (r) => r.saftData.masterFiles.customers.length,
    getErrors: (r) => r.errors.filter((e) => e.section === "CUST").length,
  },
  {
    id: "suppliers",
    label: "Fornecedores",
    icon: Truck,
    getCount: (r) => r.saftData.masterFiles.suppliers.length,
    getErrors: (r) => r.errors.filter((e) => e.section === "SUPP").length,
  },
  {
    id: "products",
    label: "Produtos",
    icon: Package,
    getCount: (r) => r.saftData.masterFiles.products.length,
    getErrors: (r) => r.errors.filter((e) => e.section === "PROD").length,
  },
  {
    id: "tax-tables",
    label: "Tabelas de impostos",
    icon: Table2,
    getCount: (r) => r.saftData.masterFiles.taxTable.length,
    getErrors: (r) => r.errors.filter((e) => e.section === "TAX").length,
  },
  {
    id: "gl-entries",
    label: "Lançamentos",
    icon: BookOpen,
    getCount: (r) => r.saftData.generalLedgerEntries?.numberOfEntries ?? 0,
    getErrors: (r) => r.errors.filter((e) => e.section === "GL").length,
  },
  {
    id: "invoices",
    label: "Faturas",
    icon: Receipt,
    getCount: (r) =>
      r.saftData.sourceDocuments.salesInvoices?.invoices.length ?? 0,
    getErrors: (r) => r.errors.filter((e) => e.section === "INV").length,
  },
  {
    id: "payments",
    label: "Pagamentos",
    icon: CreditCard,
    getCount: (r) =>
      r.saftData.sourceDocuments.payments?.payments.length ?? 0,
    getErrors: (r) => r.errors.filter((e) => e.section === "PAY").length,
  },
  {
    id: "movements",
    label: "Movimentos",
    icon: ScrollText,
    getCount: (r) =>
      r.saftData.sourceDocuments.movementOfGoods?.stockMovements.length ?? 0,
    getErrors: (r) => r.errors.filter((e) => e.section === "MOV").length,
  },
  {
    id: "work-docs",
    label: "Docs. Trabalho",
    icon: Briefcase,
    getCount: (r) =>
      r.saftData.sourceDocuments.workingDocuments?.workDocuments.length ?? 0,
    getErrors: (r) => r.errors.filter((e) => e.section === "WRK").length,
  },
  {
    id: "errors",
    label: "Erros e correções",
    icon: AlertTriangle,
    getCount: (r) => r.errors.length,
    getErrors: () => 0,
  },
];

export function SectionCards({ result, onSelect }: SectionCardsProps) {
  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Explorar o ficheiro</h3>
          <p className="mt-1 text-sm text-muted-foreground">Abra uma secção para consultar os registos e respetivas validações.</p>
        </div>
        <span className="hidden rounded-full border bg-muted/50 px-3 py-1 text-xs text-muted-foreground sm:inline-flex">
          {SECTIONS.length - 1} secções
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {SECTIONS.map((sec) => {
          const count = sec.getCount(result);
          const errors = sec.getErrors(result);
          const Icon = sec.icon;
          return (
            <Card
              key={sec.id}
              className="group overflow-hidden bg-gradient-to-br from-card via-card to-muted/50 transition duration-200 hover:-translate-y-0.5 hover:border-cyan-500/30 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <CardContent className="p-0">
                <button
                  type="button"
                  onClick={() => onSelect(sec.id)}
                  className="flex min-h-24 w-full items-center gap-3 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan-500/10 text-cyan-700 transition group-hover:bg-cyan-500/15 dark:text-cyan-300">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{sec.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {sec.id === "errors"
                        ? `${formatNumber(count)} erros encontrados`
                        : formatNumber(count)}
                    </p>
                  </div>
                  {errors > 0 && (
                    <Badge variant="destructive" className="shrink-0">
                      {errors}
                    </Badge>
                  )}
                </button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
