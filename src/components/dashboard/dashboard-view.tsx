"use client";

import type { AnalysisResult } from "@/lib/types/analysis";
import { FinancialPanel } from "./financial-panel";
import { HealthPanel } from "./health-panel";
import { SectionCards } from "./section-cards";
import { ExportMenu } from "@/components/export/export-menu";
import { ShareDialog } from "@/components/export/share-dialog";
import { formatDuration } from "@/lib/format";

interface DashboardViewProps {
  result: AnalysisResult;
  onSectionSelect: (section: string) => void;
}

export function DashboardView({
  result,
  onSectionSelect,
}: DashboardViewProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">{result.header.companyName}</h2>
          <p className="text-muted-foreground">
            NIF {result.header.taxRegistrationNumber} &middot;{" "}
            {result.header.startDate} a {result.header.endDate} &middot; SAF-T
            v{result.saftVersion} &middot; {formatDuration(result.duration)}
          </p>
        </div>
        <div className="flex gap-2">
          <ExportMenu result={result} />
          <ShareDialog result={result} />
        </div>
      </div>

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
