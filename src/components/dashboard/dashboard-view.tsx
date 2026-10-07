"use client";

import type { AnalysisResult } from "@/lib/types/analysis";
import { FinancialPanel } from "./financial-panel";
import { HealthPanel } from "./health-panel";
import { SectionCards } from "./section-cards";
import { ExportMenu } from "@/components/export/export-menu";
import { ShareDialog } from "@/components/export/share-dialog";
import { formatDuration } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Building2, CalendarDays, FileCheck2, FileWarning } from "lucide-react";

const appVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0-dev";
const buildDate = process.env.NEXT_PUBLIC_BUILD_DATE ?? "local build";

interface DashboardViewProps {
  result: AnalysisResult;
  onSectionSelect: (section: string) => void;
}

export function DashboardView({
  result,
  onSectionSelect,
}: DashboardViewProps) {
  return (
    <div className="mx-auto max-w-screen-2xl space-y-6">
      <section className="relative isolate overflow-hidden rounded-2xl border bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-6 py-7 text-white shadow-lg sm:px-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-16 -z-10 size-72 rounded-full border-[28px] border-white/5" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-36 right-32 -z-10 size-72 rounded-full border border-cyan-300/15" />
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge className={result.saftType === "complete" ? "gap-1 border border-emerald-300/30 bg-emerald-400/15 text-emerald-100" : "gap-1 border border-rose-300/30 bg-rose-400/15 text-rose-100"}>
                {result.saftType === "complete" ? <FileCheck2 className="size-3.5" /> : <FileWarning className="size-3.5" />}
                SAF-T {result.saftType === "complete" ? "completo" : "parcial"}
              </Badge>
              <span className="text-xs text-slate-300">SAF-T {result.saftVersion}</span>
              <span
                className="text-xs text-slate-400"
                title={`Atualizado em ${buildDate}`}
              >
                App {appVersion} · {buildDate}
              </span>
            </div>
            <h2 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">{result.header.companyName}</h2>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-300">
              <span className="inline-flex items-center gap-1.5"><Building2 className="size-4 text-cyan-300" /> NIF {result.header.taxRegistrationNumber}</span>
              <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-4 text-cyan-300" /> {result.header.startDate} a {result.header.endDate}</span>
              <span>Analisado em {formatDuration(result.duration)}</span>
            </div>
            {result.saftType === "partial" && (
              <p className="mt-4 max-w-2xl text-sm text-rose-100">Este ficheiro não inclui a lista de produtos ou a tabela de impostos. Exporte um SAF-T completo para validar os restantes dados.</p>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            <ExportMenu result={result} />
            <ShareDialog result={result} />
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <FinancialPanel summary={result.financialSummary} />
        <HealthPanel
          healthScore={result.healthScore}
          errorSummary={result.errorSummary}
          hashChainResults={result.hashChainResults}
          xsdValid={result.xsdValid}
        />
      </div>

      <SectionCards result={result} onSelect={onSectionSelect} />
    </div>
  );
}
