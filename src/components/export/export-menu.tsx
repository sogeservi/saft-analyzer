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
import { downloadPdf } from "@/lib/export/pdf-client";
import { downloadFile } from "@/lib/export/download-file";

interface ExportMenuProps {
  result: AnalysisResult;
}

export function ExportMenu({ result }: ExportMenuProps) {
  const { t } = useLocale();
  const [exporting, setExporting] = useState(false);

  const handleExport = async (format: "pdf" | "xlsx") => {
    setExporting(true);
    try {
      if (format === "pdf") {
        await downloadPdf(result);
      } else {
        const { generateXlsx } = await import("@/lib/export/xlsx-generator");
        const buffer = await generateXlsx(result);
        downloadFile(
          new Blob([buffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          }),
          "saft-analysis.xlsx",
        );
      }
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
