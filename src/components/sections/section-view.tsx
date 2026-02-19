"use client";

import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AnalysisResult } from "@/lib/types/analysis";
import { HeaderView } from "./header-view";
import { DataTableView } from "./data-table-view";

interface SectionViewProps {
  result: AnalysisResult;
  section: string;
  onBack: () => void;
}

const SECTION_TITLES: Record<string, string> = {
  header: "Cabeçalho",
  customers: "Clientes",
  suppliers: "Fornecedores",
  products: "Produtos",
  "tax-tables": "Tabelas de impostos",
  "gl-entries": "Lançamentos contabilísticos",
  invoices: "Faturas de venda",
  payments: "Pagamentos",
  movements: "Movimentos de mercadorias",
  "work-docs": "Documentos de trabalho",
};

export function SectionView({ result, section, onBack }: SectionViewProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="size-4" />
          Voltar
        </Button>
        <h2 className="text-xl font-semibold">
          {SECTION_TITLES[section] ?? section}
        </h2>
      </div>

      {section === "header" ? (
        <HeaderView
          header={result.header}
          errors={result.errors.filter((e) => e.section === "HDR")}
        />
      ) : (
        <DataTableView result={result} section={section} />
      )}
    </div>
  );
}
