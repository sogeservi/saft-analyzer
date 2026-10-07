"use client";

import { FileText, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatFileSize, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AnalysisResult } from "@/lib/types/analysis";
import { useLocale } from "@/lib/i18n";

export type FileStatus = "pending" | "uploading" | "complete" | "error";
export type UploadStage = "queue" | "upload" | "processing";

export interface XmlUploadError {
  kind: "xml";
  message: string;
  line: number;
  column: number;
}

export interface FileEntry {
  id: string;
  file: File | null;
  name: string;
  size: number;
  status: FileStatus;
  stage: UploadStage;
  queuePosition: number | null;
  uploadProgress: number;
  result: AnalysisResult | null;
  error: string | XmlUploadError | null;
}

interface FileListProps {
  files: FileEntry[];
  onRemove: (id: string) => void;
  disabled?: boolean;
}

const STATUS_CONFIG: Record<
  FileStatus,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    icon: typeof CheckCircle2;
  }
> = {
  pending: { label: "Pendente", variant: "secondary", icon: FileText },
  uploading: { label: "A analisar…", variant: "outline", icon: Loader2 },
  complete: { label: "Concluído", variant: "default", icon: CheckCircle2 },
  error: { label: "Erro", variant: "destructive", icon: AlertCircle },
};

export function FileList({ files, onRemove, disabled }: FileListProps) {
  const { t, languageTag } = useLocale();
  if (files.length === 0) return null;

  return (
    <div className="space-y-2">
      {files.map((entry) => {
        const config = STATUS_CONFIG[entry.status];
        const Icon = config.icon;
        return (
          <div key={entry.id} className="space-y-2">
            <div className="flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3">
              <FileText className="size-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{entry.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(entry.size)}
                </p>
              </div>
              <Badge variant={config.variant} className="shrink-0">
                <Icon
                  className={cn(
                    "size-3",
                    entry.status === "uploading" && "animate-spin",
                  )}
                />
                {t(config.label)}
              </Badge>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => onRemove(entry.id)}
                disabled={disabled || entry.status === "uploading"}
                aria-label={`${t("Remover ficheiro")} ${entry.name}`}
              >
                <X className="size-3" />
              </Button>
            </div>
            {entry.error && (
              <div
                role="alert"
                className="ml-8 flex min-w-0 items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
              >
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
                <div className="min-w-0 space-y-1">
                  <p className="font-semibold text-destructive">
                    {typeof entry.error === "string"
                      ? t("Falha ao analisar o ficheiro")
                      : t("Erro no XML")}
                  </p>
                  {typeof entry.error === "string" ? (
                    <p className="break-words text-foreground">{entry.error}</p>
                  ) : (
                    <>
                      <p className="font-medium text-foreground">
                        {t("Linha")} {formatNumber(entry.error.line, languageTag)},{" "}
                        {t("Coluna")} {formatNumber(entry.error.column, languageTag)}
                      </p>
                      <p className="break-words text-foreground">
                        {t(entry.error.message)}
                      </p>
                      <p className="text-muted-foreground">
                        {t("Corrija o XML nesta posição e carregue o ficheiro novamente.")}
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
