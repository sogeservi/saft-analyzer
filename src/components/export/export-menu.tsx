"use client";

import { useState } from "react";
import { Download, FileText, Table2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AnalysisResult } from "@/lib/types/analysis";
import { useLocale } from "@/lib/i18n";

interface ExportMenuProps {
  result: AnalysisResult;
}

export function ExportMenu({ result }: ExportMenuProps) {
  const { t } = useLocale();
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format: "pdf" | "xlsx") => {
    setExporting(true);
    const endpoint =
      format === "pdf" ? "/api/export/pdf" : "/api/export/xlsx";

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
        cache: "no-store",
      });

      if (!response.ok)
        throw new Error(`${t("Erro ao exportar")} ${format.toUpperCase()}`);

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        response.headers
          .get("Content-Disposition")
          ?.match(/filename="(.+)"/)?.[1] ?? `saft-export.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${format.toUpperCase()} ${t("exportado com sucesso")}`);
    } catch {
      toast.error(`${t("Erro ao exportar")} ${format.toUpperCase()}`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={exporting}>
          <Download className="size-4" />
          {t("Exportar")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport("pdf")}>
          <FileText className="size-4" />
          {t("Relatório PDF")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("xlsx")}>
          <Table2 className="size-4" />
          Excel (.xlsx)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
