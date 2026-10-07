"use client";

import type { AnalysisResult } from "@/lib/types/analysis";
import { FinancialPanel } from "./financial-panel";
import { HealthPanel } from "./health-panel";
import { SectionCards } from "./section-cards";
import { ExportMenu } from "@/components/export/export-menu";
import { ShareDialog } from "@/components/export/share-dialog";
import { formatDuration } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  CalendarDays,
  FileCheck2,
  FileWarning,
  MapPin,
  MonitorDown,
} from "lucide-react";
import { APP_BUILD_INFO } from "@/lib/build-info";

interface DashboardViewProps {
  result: AnalysisResult;
  onSectionSelect: (section: string) => void;
}

export function DashboardView({
  result,
  onSectionSelect,
}: DashboardViewProps) {
  const address = result.header.companyAddress;
  const companyDetails = [
    {
      label: result.header.businessName
        ? `Nome comercial: ${result.header.businessName}`
        : "",
      icon: null,
    },
    {
      label: result.header.companyID
        ? `ID da empresa: ${result.header.companyID}`
        : "",
      icon: Building2,
    },
    {
      label: address?.addressDetail || address?.city || address?.country
        ? [
            address.addressDetail,
            address.postalCode,
            address.city,
            address.country,
          ]
            .filter(Boolean)
            .join(", ")
        : "",
      icon: MapPin,
    },
  ].filter(({ label }) => Boolean(label));
  const exporterDetails = [
    {
      label: [result.header.productID, result.header.productVersion]
        .filter(Boolean)
        .join(" "),
      prefix: "Exportado por",
      icon: MonitorDown,
    },
    {
      label: result.header.productCompanyTaxID ?? "",
      prefix: "NIF do produtor",
      icon: null,
    },
    {
      label: result.header.softwareCertificateNumber ?? "",
      prefix: "Certificado",
      icon: null,
    },
  ].filter(({ label }) => Boolean(label));

  return (
    <div className="mx-auto max-w-screen-2xl space-y-6">
      <section className="relative isolate overflow-hidden rounded-2xl border bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 px-6 py-7 text-white shadow-lg sm:px-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-8 -top-16 -z-10 size-72 rounded-full border-[28px] border-white/5" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-36 right-32 -z-10 size-72 rounded-full border border-cyan-300/15" />
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge
                className={
                  result.saftType === "complete"
                    ? "gap-1 border border-emerald-300/30 bg-emerald-400/15 text-emerald-100"
                    : "gap-1 border border-rose-300/30 bg-rose-400/15 text-rose-100"
                }
              >
                {result.saftType === "complete" ? (
                  <FileCheck2 className="size-3.5" />
                ) : (
                  <FileWarning className="size-3.5" />
                )}
                SAF-T {result.saftType === "complete" ? "completo" : "parcial"}
              </Badge>
              <span className="text-xs text-slate-300">SAF-T {result.saftVersion}</span>
              <span
                className="text-xs text-slate-300"
                title={`Atualizado em ${APP_BUILD_INFO.date}`}
              >
                App {APP_BUILD_INFO.version} · {APP_BUILD_INFO.date}
              </span>
            </div>
            <h2 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">
              {result.header.companyName}
            </h2>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="size-4 text-cyan-300" />
                NIF {result.header.taxRegistrationNumber}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-4 text-cyan-300" />
                {result.header.startDate} a {result.header.endDate}
              </span>
              <span>Analisado em {formatDuration(result.duration)}</span>
            </div>
            {companyDetails.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-300">
                {companyDetails.map(({ label, icon: Icon }) => (
                  <span
                    key={label}
                    className="inline-flex items-center gap-1.5"
                  >
                    {Icon && <Icon className="size-3.5 text-cyan-300" />}
                    {label}
                  </span>
                ))}
              </div>
            )}
            {exporterDetails.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-300">
                {exporterDetails.map(({ label, prefix, icon: Icon }) => (
                  <span
                    key={`${prefix}-${label}`}
                    className="inline-flex items-center gap-1.5"
                  >
                    {Icon && <Icon className="size-3.5 text-cyan-300" />}
                    {prefix}: {label}
                  </span>
                ))}
              </div>
            )}
            {result.saftType === "partial" && (
              <p className="mt-4 max-w-2xl text-sm text-rose-100">
                Este ficheiro não inclui a lista de produtos ou a tabela de
                impostos. Exporte um SAF-T completo para validar os restantes
                dados.
              </p>
            )}
          </div>
          <div className="flex shrink-0 gap-2 [&_button]:border-white/30 [&_button]:bg-white/10 [&_button]:text-white [&_button:hover]:bg-white/20 [&_button:hover]:text-white [&_button]:shadow-none [&_button]:focus-visible:ring-white/70">
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
