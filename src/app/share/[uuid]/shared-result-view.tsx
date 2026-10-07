"use client";

import { useState } from "react";
import type { AnalysisResult } from "@/lib/types/analysis";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { SectionView } from "@/components/sections/section-view";
import { ErrorsView } from "@/components/errors/errors-view";
import { Badge } from "@/components/ui/badge";
import { useLocale } from "@/lib/i18n";

export function SharedResultView({
  result,
  expiresAt,
}: {
  result: AnalysisResult;
  expiresAt: number;
}) {
  const [section, setSection] = useState<string | null>(null);
  const { t, languageTag } = useLocale();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center gap-4 px-6">
          <h1 className="text-lg font-semibold">SAF-T Analyzer</h1>
          <Badge variant="secondary">{t("Partilha")}</Badge>
          <div className="flex-1" />
          <span className="text-xs text-muted-foreground">
            {t("Expira em")} {new Date(expiresAt).toLocaleString(languageTag)}
          </span>
        </div>
      </header>
      <main className="px-6 py-6">
        {section === null ? (
          <DashboardView result={result} onSectionSelect={setSection} />
        ) : section === "errors" ? (
          <ErrorsView result={result} onBack={() => setSection(null)} />
        ) : (
          <SectionView result={result} section={section} onBack={() => setSection(null)} />
        )}
      </main>
    </div>
  );
}
