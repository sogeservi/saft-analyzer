"use client";

import { useState, useMemo } from "react";
import { ArrowLeft, Search, Wrench, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AnalysisResult } from "@/lib/types/analysis";
import type { ValidationError, Severity } from "@/lib/types/errors";
import { SEVERITY_LABELS } from "@/lib/types/errors";
import { cn } from "@/lib/utils";

interface ErrorsViewProps {
  result: AnalysisResult;
  onBack: () => void;
}

const SEVERITY_COLORS: Record<Severity, string> = {
  critical: "bg-red-600 text-white",
  error: "bg-red-500 text-white",
  warning: "bg-amber-500 text-white",
  info: "bg-blue-500 text-white",
};

const ERRORS_PER_PAGE = 50;

export function ErrorsView({ result, onBack }: ErrorsViewProps) {
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("warning+");
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [selectedFixes, setSelectedFixes] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [page, setPage] = useState(0);

  const sections = useMemo(
    () => [...new Set(result.errors.map((e) => e.section))].sort(),
    [result.errors],
  );

  const WARNING_PLUS: Set<string> = useMemo(() => new Set(["critical", "error", "warning"]), []);

  const filtered = useMemo(() => {
    return result.errors.filter((e) => {
      if (severityFilter === "warning+") {
        if (!WARNING_PLUS.has(e.severity)) return false;
      } else if (severityFilter !== "all" && e.severity !== severityFilter) {
        return false;
      }
      if (sectionFilter !== "all" && e.section !== sectionFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          e.code.toLowerCase().includes(q) ||
          e.message.toLowerCase().includes(q) ||
          e.path.toLowerCase().includes(q) ||
          (e.documentId ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [result.errors, severityFilter, sectionFilter, search, WARNING_PLUS]);

  const fixableErrors = filtered.filter((e) => e.autoFixable);

  const toggleFix = (err: ValidationError) => {
    const key = `${err.code}|${err.path}`;
    setSelectedFixes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAllFixable = () => {
    setSelectedFixes(
      new Set(fixableErrors.map((e) => `${e.code}|${e.path}`)),
    );
  };

  const handleGenerateFixes = async () => {
    if (selectedFixes.size === 0) return;
    setGenerating(true);

    try {
      const response = await fetch("/api/fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: result.fileName,
          saftData: result.saftData,
          selectedErrorCodes: [...selectedFixes],
          errors: result.errors,
        }),
      });

      if (!response.ok) throw new Error("Erro ao gerar correções");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        response.headers
          .get("Content-Disposition")
          ?.match(/filename="(.+)"/)?.[1] ?? "correcoes.json";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Documento de correções gerado");
    } catch {
      toast.error("Erro ao gerar documento de correções");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="size-4" />
          Voltar
        </Button>
        <h2 className="text-xl font-semibold">Erros e correções</h2>
        <Badge variant="secondary">
          {result.errors.filter((e) => e.severity !== "info").length} erros
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar erros…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-9"
          />
        </div>
        <Select value={severityFilter} onValueChange={(v) => { setSeverityFilter(v); setPage(0); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Severidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="warning+">Aviso e superior</SelectItem>
            <SelectItem value="all">Todas (inclui Info)</SelectItem>
            <SelectItem value="critical">Crítico</SelectItem>
            <SelectItem value="error">Erro</SelectItem>
            <SelectItem value="warning">Aviso</SelectItem>
            <SelectItem value="info">Informação</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sectionFilter} onValueChange={(v) => { setSectionFilter(v); setPage(0); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Secção" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as secções</SelectItem>
            {sections.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        {fixableErrors.length > 0 && (
          <>
            <Button variant="outline" size="sm" onClick={selectAllFixable}>
              Selecionar todas ({fixableErrors.length})
            </Button>
            <Button
              size="sm"
              disabled={selectedFixes.size === 0 || generating}
              onClick={handleGenerateFixes}
            >
              <Download className="size-4" />
              Gerar correções ({selectedFixes.size})
            </Button>
          </>
        )}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhum erro encontrado com os filtros selecionados.
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
            {filtered.length > ERRORS_PER_PAGE && ` — página ${page + 1} de ${Math.ceil(filtered.length / ERRORS_PER_PAGE)}`}
          </p>
          <div className="space-y-2">
            {filtered
              .slice(page * ERRORS_PER_PAGE, (page + 1) * ERRORS_PER_PAGE)
              .map((err, i) => {
                const fixKey = `${err.code}|${err.path}`;
                const isSelected = selectedFixes.has(fixKey);
                return (
                  <Card
                    key={page * ERRORS_PER_PAGE + i}
                    className={cn(isSelected && "ring-2 ring-primary")}
                  >
                    <CardContent className="flex gap-3 py-3">
                      <div className="flex flex-col items-center gap-2 pt-0.5">
                        <Badge
                          className={cn(
                            "text-xs",
                            SEVERITY_COLORS[err.severity],
                          )}
                        >
                          {SEVERITY_LABELS[err.severity]}
                        </Badge>
                        {err.autoFixable && (
                          <Button
                            variant={isSelected ? "default" : "outline"}
                            size="icon-xs"
                            onClick={() => toggleFix(err)}
                            title="Selecionar para correção"
                          >
                            <Wrench className="size-3" />
                          </Button>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-medium">{err.code}</code>
                          <span className="text-xs text-muted-foreground">
                            {err.section}
                          </span>
                        </div>
                        <p className="text-sm">{err.message}</p>
                        <p className="text-xs text-muted-foreground">
                          {err.explanation}
                        </p>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>
                            caminho: <code>{err.path}</code>
                          </span>
                          {err.documentId && (
                            <span>
                              Doc: <code>{err.documentId}</code>
                            </span>
                          )}
                          {err.originalValue && (
                            <span>
                              Valor: <code>{err.originalValue}</code>
                            </span>
                          )}
                          {err.suggestedFix && (
                            <span className="text-primary">
                              Sugestão: {err.suggestedFix}
                            </span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </div>
          {Math.ceil(filtered.length / ERRORS_PER_PAGE) > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Página {page + 1} de {Math.ceil(filtered.length / ERRORS_PER_PAGE)}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(Math.ceil(filtered.length / ERRORS_PER_PAGE) - 1, p + 1))}
                  disabled={page >= Math.ceil(filtered.length / ERRORS_PER_PAGE) - 1}
                >
                  Seguinte
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
