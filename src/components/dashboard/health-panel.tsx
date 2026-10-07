"use client";

import {
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  AlertTriangle,
  AlertCircle,
  Info,
  XCircle,
  CircleHelp,
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
import { useLocale } from "@/lib/i18n";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  const { t, languageTag } = useLocale();
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
  const displayedErrors = errorSummary.topErrors.slice(0, 3);
  const summarizedErrorCount = displayedErrors.reduce(
    (sum, error) => sum + error.count,
    0,
  );
  const reportableErrorCount =
    errorSummary.bySeverity.critical +
    errorSummary.bySeverity.error +
    errorSummary.bySeverity.warning;
  const allErrorsShown = summarizedErrorCount === reportableErrorCount;

  return (
    <Card>
      <CardHeader className="border-b bg-gradient-to-r from-indigo-500/[0.06] via-transparent to-transparent pb-5">
        <CardTitle className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-indigo-500/10 text-indigo-700 dark:text-indigo-300">
            <ShieldCheck className="size-5" />
          </span>
          {t("Saúde da Validação")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="grid size-14 place-items-center rounded-2xl bg-muted/70">
            <HealthIcon className={cn("size-9", healthColor)} />
          </div>
          <div>
            <p className={cn("text-3xl font-bold", healthColor)}>
              {formatPercentage(healthScore.overall, languageTag)}
            </p>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-sm text-muted-foreground underline decoration-dotted underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {t("Pontuação de Saúde")}  <CircleHelp className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{t("A pontuação resume as validações aplicadas ao ficheiro SAF-T.")}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
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
                  {t(SEVERITY_LABELS[sev])}: {count}
                </Badge>
              );
            },
          )}
          {errorSummary.bySeverity.critical + errorSummary.bySeverity.error + errorSummary.bySeverity.warning === 0 && (
            <Badge className="bg-green-600 text-white">{t("Sem erros")}</Badge>
          )}
        </div>

        {errorSummary.topErrors.length > 0 && (
          <div>
            <h4 className="mb-2 text-sm font-medium">
              {allErrorsShown ? t("Erros encontrados") : t("Erros mais comuns")}
            </h4>
            <div className="space-y-1">
              {displayedErrors.map((te) => (
                <div
                  key={te.code}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="truncate text-muted-foreground">
                    <code className="mr-2 text-xs">{te.code}</code>
                    {t(te.message)}
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
            <p className="text-xs text-muted-foreground">{t("Cadeia de Hash")}</p>
            <p
              className={cn(
                "text-sm font-medium",
                allHashValid ? "text-green-600" : "text-red-600",
              )}
            >
              {allHashValid ? t("Válida") : t("Quebrada")}
            </p>
          </div>
          <div className="rounded-lg border px-3 py-2">
            <p className="text-xs text-muted-foreground">{t("Validação XSD")}</p>
            <p
              className={cn(
                "text-sm font-medium",
                xsdValid ? "text-green-600" : "text-red-600",
              )}
            >
              {xsdValid ? t("Válido") : t("Inválido")}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
