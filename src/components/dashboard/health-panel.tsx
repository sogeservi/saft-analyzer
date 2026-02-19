"use client";

import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  AlertTriangle,
  AlertCircle,
  Info,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type {
  ErrorSummary,
  HashChainResult,
  HealthScore,
} from "@/lib/types/analysis";
import type { Severity } from "@/lib/types/errors";
import { formatPercentage } from "@/lib/format";
import { cn } from "@/lib/utils";

interface HealthPanelProps {
  healthScore: HealthScore;
  errorSummary: ErrorSummary;
  hashChainResults: HashChainResult[];
  xsdValid: boolean;
}

const SEVERITY_ICONS: Record<Severity, typeof AlertCircle> = {
  critical: XCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const SEVERITY_COLORS: Record<Severity, string> = {
  critical: "bg-red-600 text-white",
  error: "bg-red-500 text-white",
  warning: "bg-amber-500 text-white",
  info: "bg-blue-500 text-white",
};

const SEVERITY_LABELS: Record<Severity, string> = {
  critical: "Crítico",
  error: "Erro",
  warning: "Aviso",
  info: "Info",
};

export function HealthPanel({
  healthScore,
  errorSummary,
  hashChainResults,
  xsdValid,
}: HealthPanelProps) {
  const allHashValid = hashChainResults.every((h) => h.valid);
  const HealthIcon =
    healthScore.overall >= 90
      ? ShieldCheck
      : healthScore.overall >= 60
        ? ShieldAlert
        : ShieldX;
  const healthColor =
    healthScore.overall >= 90
      ? "text-green-600"
      : healthScore.overall >= 60
        ? "text-amber-600"
        : "text-red-600";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Saúde da Validação</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4">
          <HealthIcon className={cn("size-12", healthColor)} />
          <div>
            <p className={cn("text-3xl font-bold", healthColor)}>
              {formatPercentage(healthScore.overall)}
            </p>
            <p className="text-sm text-muted-foreground">
              Pontuação de Saúde
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(["critical", "error", "warning"] as Severity[]).map(
            (sev) => {
              const count = errorSummary.bySeverity[sev] ?? 0;
              if (count === 0) return null;
              const Icon = SEVERITY_ICONS[sev];
              return (
                <Badge key={sev} className={cn("gap-1", SEVERITY_COLORS[sev])}>
                  <Icon className="size-3" />
                  {SEVERITY_LABELS[sev]}: {count}
                </Badge>
              );
            },
          )}
          {errorSummary.bySeverity.critical + errorSummary.bySeverity.error + errorSummary.bySeverity.warning === 0 && (
            <Badge className="bg-green-600 text-white">Sem erros</Badge>
          )}
        </div>

        {errorSummary.topErrors.length > 0 && (
          <div>
            <h4 className="mb-2 text-sm font-medium">Erros mais comuns</h4>
            <div className="space-y-1">
              {errorSummary.topErrors.slice(0, 3).map((te) => (
                <div
                  key={te.code}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="truncate text-muted-foreground">
                    <code className="mr-2 text-xs">{te.code}</code>
                    {te.message}
                  </span>
                  <Badge variant="secondary" className="ml-2 shrink-0">
                    {te.count}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border px-3 py-2">
            <p className="text-xs text-muted-foreground">Cadeia de Hash</p>
            <p
              className={cn(
                "text-sm font-medium",
                allHashValid ? "text-green-600" : "text-red-600",
              )}
            >
              {allHashValid ? "Válida" : "Quebrada"}
            </p>
          </div>
          <div className="rounded-lg border px-3 py-2">
            <p className="text-xs text-muted-foreground">Validação XSD</p>
            <p
              className={cn(
                "text-sm font-medium",
                xsdValid ? "text-green-600" : "text-red-600",
              )}
            >
              {xsdValid ? "Válido" : "Inválido"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
