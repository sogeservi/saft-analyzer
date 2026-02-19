"use client";

import { Loader2, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatFileSize } from "@/lib/format";

interface ProgressViewProps {
  fileName: string;
  fileSize: number;
}

export function ProgressView({ fileName, fileSize }: ProgressViewProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <Loader2 className="size-5 animate-spin" />A analisar ficheiro
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <div className="flex w-full items-center gap-3 rounded-lg bg-muted px-4 py-3">
            <FileText className="size-5 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{fileName}</p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(fileSize)}
              </p>
            </div>
          </div>
          <p className="text-center text-sm text-muted-foreground">
            A processar validações XML, regras de negócio e cadeia de hash…
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
