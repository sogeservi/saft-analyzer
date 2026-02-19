import type { ValidationError, Severity } from "../types/errors";
import type { SaftFile } from "../types/saft";
import type {
  AnalysisResult,
  FinancialSummary,
  ErrorSummary,
  HealthScore,
  HashChainResult,
  VatBreakdown,
  DocumentTypeCount,
  SeriesStats,
  DayStats,
  AnalysisProgress,
} from "../types/analysis";
import { v4 as uuidv4 } from "uuid";
import { validateHeader } from "./header";
import { validateCustomers } from "./customers";
import { validateSuppliers } from "./suppliers";
import { validateProducts } from "./products";
import { validateTaxTables } from "./tax-tables";
import { validateGeneralLedger } from "./general-ledger";
import { validateSalesInvoices } from "./sales-invoices";
import { validatePayments } from "./payments";
import { validateMovementOfGoods } from "./movement-of-goods";
import { validateWorkingDocuments } from "./working-documents";
import { validateCrossReferences } from "./cross-references";
import { validateHashChains } from "./hash-chain";
import { validateTaxIds } from "./tax-id";

export type ProgressCallback = (progress: AnalysisProgress) => void;

export function runValidation(
  saftData: SaftFile,
  fileName: string,
  fileSize: number,
  onProgress?: ProgressCallback,
): AnalysisResult {
  const startTime = Date.now();
  const errors: ValidationError[] = [];

  onProgress?.({
    phase: "business-rules",
    percentage: 30,
    errorsFound: 0,
    currentSection: "Header",
  });
  errors.push(...validateHeader(saftData));

  onProgress?.({
    phase: "business-rules",
    percentage: 35,
    errorsFound: errors.length,
    currentSection: "MasterFiles",
  });
  errors.push(...validateCustomers(saftData));
  errors.push(...validateSuppliers(saftData));
  errors.push(...validateProducts(saftData));
  errors.push(...validateTaxTables(saftData));

  onProgress?.({
    phase: "business-rules",
    percentage: 45,
    errorsFound: errors.length,
    currentSection: "GeneralLedgerEntries",
  });
  errors.push(...validateGeneralLedger(saftData));

  onProgress?.({
    phase: "business-rules",
    percentage: 55,
    errorsFound: errors.length,
    currentSection: "SalesInvoices",
  });
  errors.push(...validateSalesInvoices(saftData));

  onProgress?.({
    phase: "business-rules",
    percentage: 65,
    errorsFound: errors.length,
    currentSection: "Payments",
  });
  errors.push(...validatePayments(saftData));

  onProgress?.({
    phase: "business-rules",
    percentage: 70,
    errorsFound: errors.length,
    currentSection: "MovementOfGoods",
  });
  errors.push(...validateMovementOfGoods(saftData));

  onProgress?.({
    phase: "business-rules",
    percentage: 75,
    errorsFound: errors.length,
    currentSection: "WorkingDocuments",
  });
  errors.push(...validateWorkingDocuments(saftData));

  onProgress?.({
    phase: "business-rules",
    percentage: 80,
    errorsFound: errors.length,
    currentSection: "CrossReferences",
  });
  errors.push(...validateCrossReferences(saftData));
  errors.push(...validateTaxIds(saftData));

  onProgress?.({
    phase: "hash-chain",
    percentage: 85,
    errorsFound: errors.length,
    currentSection: "HashChain",
  });
  const hashChainResults = validateHashChains(saftData);
  for (const hcr of hashChainResults) {
    errors.push(...hcr.errors);
  }

  const financialSummary = buildFinancialSummary(saftData);
  const errorSummary = buildErrorSummary(errors);
  const healthScore = buildHealthScore(saftData, errors);

  return {
    id: uuidv4(),
    fileName,
    fileSize,
    analyzedAt: new Date().toISOString(),
    duration: Date.now() - startTime,
    saftVersion: saftData.header.auditFileVersion,
    header: saftData.header,
    saftData,
    financialSummary,
    hashChainResults,
    errors,
    errorSummary,
    healthScore,
    xsdValid: true,
    xsdErrors: [],
  };
}

function buildFinancialSummary(saftData: SaftFile): FinancialSummary {
  const vatMap = new Map<string, VatBreakdown>();
  const typeMap = new Map<string, DocumentTypeCount>();
  const seriesMap = new Map<string, SeriesStats>();
  const dayMap = new Map<string, DayStats>();

  const invoices = saftData.sourceDocuments.salesInvoices?.invoices ?? [];

  for (const inv of invoices) {
    if (inv.documentStatus.invoiceStatus === "A") continue;

    const typeKey = inv.invoiceType;
    const existing = typeMap.get(typeKey) ?? {
      type: typeKey,
      count: 0,
      totalCredit: 0,
      totalDebit: 0,
      grossTotal: 0,
    };
    existing.count++;
    existing.grossTotal += inv.documentTotals.grossTotal;
    for (const line of inv.lines) {
      existing.totalCredit += line.creditAmount ?? 0;
      existing.totalDebit += line.debitAmount ?? 0;
    }
    typeMap.set(typeKey, existing);

    const parts = inv.invoiceNo.split("/");
    const seriesKey = parts.length >= 2 ? `${inv.invoiceType} ${parts[0].replace(inv.invoiceType, "").trim()}`.trim() : inv.invoiceType;
    const seqNum = parts.length >= 2 ? parseInt(parts[1], 10) : 0;
    const series = seriesMap.get(seriesKey) ?? {
      series: seriesKey,
      documentType: inv.invoiceType,
      count: 0,
      firstNumber: Infinity,
      lastNumber: 0,
      missingNumbers: [],
      totalCredit: 0,
      totalDebit: 0,
    };
    series.count++;
    if (seqNum < series.firstNumber) series.firstNumber = seqNum;
    if (seqNum > series.lastNumber) series.lastNumber = seqNum;
    seriesMap.set(seriesKey, series);

    const dayKey = inv.invoiceDate;
    const day = dayMap.get(dayKey) ?? {
      date: dayKey,
      documentCount: 0,
      grossTotal: 0,
      netTotal: 0,
      taxTotal: 0,
    };
    day.documentCount++;
    day.grossTotal += inv.documentTotals.grossTotal;
    day.netTotal += inv.documentTotals.netTotal;
    day.taxTotal += inv.documentTotals.taxPayable;
    dayMap.set(dayKey, day);

    for (const line of inv.lines) {
      const amount = line.creditAmount ?? line.debitAmount ?? 0;
      const vatKey = `${line.tax.taxCountryRegion}|${line.tax.taxCode}|${line.tax.taxPercentage ?? 0}`;
      const vat = vatMap.get(vatKey) ?? {
        taxCountryRegion: line.tax.taxCountryRegion,
        taxCode: line.tax.taxCode,
        taxPercentage: line.tax.taxPercentage ?? 0,
        baseAmount: 0,
        taxAmount: 0,
        documentCount: 0,
      };
      vat.baseAmount += amount;
      vat.taxAmount += amount * ((line.tax.taxPercentage ?? 0) / 100);
      vat.documentCount++;
      vatMap.set(vatKey, vat);
    }
  }

  for (const series of seriesMap.values()) {
    if (series.firstNumber === Infinity) series.firstNumber = 0;
    const missing: number[] = [];
    for (let i = series.firstNumber; i <= series.lastNumber; i++) {
      missing.push(i);
    }
    const seenNumbers = new Set<number>();
    for (const inv of invoices) {
      const parts = inv.invoiceNo.split("/");
      const sKey = parts.length >= 2 ? `${inv.invoiceType} ${parts[0].replace(inv.invoiceType, "").trim()}`.trim() : inv.invoiceType;
      if (sKey === series.series) {
        seenNumbers.add(parts.length >= 2 ? parseInt(parts[1], 10) : 0);
      }
    }
    series.missingNumbers = missing.filter((n) => !seenNumbers.has(n));
  }

  const salesInv = saftData.sourceDocuments.salesInvoices;
  return {
    totalRevenue: (salesInv?.totalCredit ?? 0) - (salesInv?.totalDebit ?? 0),
    totalCredit: salesInv?.totalCredit ?? 0,
    totalDebit: salesInv?.totalDebit ?? 0,
    vatBreakdown: Array.from(vatMap.values()),
    documentTypeCounts: Array.from(typeMap.values()),
    seriesStats: Array.from(seriesMap.values()),
    dayStats: Array.from(dayMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date),
    ),
  };
}

function buildErrorSummary(errors: ValidationError[]): ErrorSummary {
  const bySeverity: Record<Severity, number> = {
    critical: 0,
    error: 0,
    warning: 0,
    info: 0,
  };
  const bySection: Record<string, number> = {};
  const byCode: Record<string, number> = {};

  for (const err of errors) {
    bySeverity[err.severity]++;
    bySection[err.section] = (bySection[err.section] ?? 0) + 1;
    byCode[err.code] = (byCode[err.code] ?? 0) + 1;
  }

  const nonInfoCodes = new Set(
    errors.filter((e) => e.severity !== "info").map((e) => e.code),
  );
  const topErrors = Object.entries(byCode)
    .filter(([code]) => nonInfoCodes.has(code))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([code, count]) => ({
      code,
      count,
      message: errors.find((e) => e.code === code)?.message ?? "",
    }));

  return {
    total: errors.length,
    bySeverity,
    bySection,
    byCode,
    topErrors,
  };
}

function buildHealthScore(
  saftData: SaftFile,
  errors: ValidationError[],
): HealthScore {
  const SEVERITY_WEIGHTS: Record<string, number> = {
    critical: 10,
    error: 3,
    warning: 0.5,
    info: 0,
  };

  const totalDocs = Math.max(1, countTotalDocuments(saftData));

  let weightedPenalty = 0;
  for (const err of errors) {
    weightedPenalty += SEVERITY_WEIGHTS[err.severity] ?? 0;
  }

  const maxPenalty = totalDocs * 10;
  const penaltyRatio = Math.min(weightedPenalty / maxPenalty, 1);
  const overall = Math.max(0, Math.round((1 - penaltyRatio) * 100));

  const bySection: Record<string, number> = {};
  const sectionDocCounts: Record<string, number> = {
    Header: 1,
    Customers: saftData.masterFiles.customers.length,
    Suppliers: saftData.masterFiles.suppliers.length,
    Products: saftData.masterFiles.products.length,
    SalesInvoices:
      saftData.sourceDocuments.salesInvoices?.invoices.length ?? 0,
    Payments: saftData.sourceDocuments.payments?.payments.length ?? 0,
    MovementOfGoods:
      saftData.sourceDocuments.movementOfGoods?.stockMovements.length ?? 0,
    WorkingDocuments:
      saftData.sourceDocuments.workingDocuments?.workDocuments.length ?? 0,
  };

  for (const [section, total] of Object.entries(sectionDocCounts)) {
    const sectionErrs = errors.filter(
      (e) => e.section === section,
    );
    if (total === 0 && sectionErrs.length === 0) {
      bySection[section] = 100;
      continue;
    }
    let sectionPenalty = 0;
    for (const err of sectionErrs) {
      sectionPenalty += SEVERITY_WEIGHTS[err.severity] ?? 0;
    }
    const sectionMax = Math.max(1, total) * 10;
    const sectionRatio = Math.min(sectionPenalty / sectionMax, 1);
    bySection[section] = Math.max(0, Math.round((1 - sectionRatio) * 100));
  }

  return { overall, bySection };
}

function countTotalDocuments(saftData: SaftFile): number {
  let total = 1; // Header
  total += saftData.masterFiles.customers.length;
  total += saftData.masterFiles.suppliers.length;
  total += saftData.masterFiles.products.length;
  total += saftData.sourceDocuments.salesInvoices?.invoices.length ?? 0;
  total += saftData.sourceDocuments.payments?.payments.length ?? 0;
  total +=
    saftData.sourceDocuments.movementOfGoods?.stockMovements.length ?? 0;
  total +=
    saftData.sourceDocuments.workingDocuments?.workDocuments.length ?? 0;
  return total;
}
