"use client";

import { FileText, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatFileSize } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AnalysisResult } from "@/lib/types/analysis";

export type FileStatus = "pending" | "uploading" | "complete" | "error";

export interface FileEntry {
  id: string;
  file: File;
  name: string;
  size: number;
  status: FileStatus;
  result: AnalysisResult | null;
  error: string | null;
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
  if (files.length === 0) return null;

  return (
    <div className="space-y-2">
      {files.map((entry) => {
        const config = STATUS_CONFIG[entry.status];
        const Icon = config.icon;
        return (
          <div
            key={entry.id}
            className="flex items-center gap-3 rounded-lg border px-4 py-3"
          >
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
              {config.label}
            </Badge>
            {entry.error && (
              <span className="max-w-48 truncate text-xs text-destructive">
                {entry.error}
              </span>
            )}
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => onRemove(entry.id)}
              disabled={disabled || entry.status === "uploading"}
            >
              <X className="size-3" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
