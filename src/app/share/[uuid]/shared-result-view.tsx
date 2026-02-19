"use client";

import { useState } from "react";
import type { AnalysisResult } from "@/lib/types/analysis";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { SectionView } from "@/components/sections/section-view";
import { ErrorsView } from "@/components/errors/errors-view";
import { Badge } from "@/components/ui/badge";

interface SharedResultViewProps {
  result: AnalysisResult;
  expiresAt: number;
}

export function SharedResultView({
  result,
  expiresAt,
}: SharedResultViewProps) {
  const [section, setSection] = useState<string | null>(null);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center gap-4 px-6">
          <h1 className="text-lg font-semibold">SAF-T Analyzer</h1>
          <Badge variant="secondary">Partilha</Badge>
          <div className="flex-1" />
          <span className="text-xs text-muted-foreground">
            Expira em {new Date(expiresAt).toLocaleString("pt-PT")}
          </span>
        </div>
      </header>

      <main className="px-6 py-6">
        {section === null ? (
          <DashboardView result={result} onSectionSelect={setSection} />
        ) : section === "errors" ? (
          <ErrorsView result={result} onBack={() => setSection(null)} />
        ) : (
          <SectionView
            result={result}
            section={section}
            onBack={() => setSection(null)}
          />
        )}
      </main>
    </div>
  );
}
