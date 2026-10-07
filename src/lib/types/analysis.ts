import type { ValidationError, Severity } from "./errors";
import type { SaftHeader, SaftFile } from "./saft";

export type AnalysisPhase =
  | "upload"
  | "encoding"
  | "xml-parse"
  | "xsd-validation"
  | "business-rules"
  | "hash-chain"
  | "complete"
  | "failed";

export interface AnalysisProgress {
  phase: AnalysisPhase;
  percentage: number;
  currentSection?: string;
  counts?: SectionCounts;
  errorsFound: number;
}

export interface SectionCounts {
  customers: number;
  suppliers: number;
  products: number;
  taxTableEntries: number;
  glEntries: number;
  invoices: number;
  payments: number;
  stockMovements: number;
  workDocuments: number;
}

export interface VatBreakdown {
  taxCountryRegion: string;
  taxCode: string;
  taxPercentage: number;
  baseAmount: number;
  taxAmount: number;
  documentCount: number;
}

export interface DocumentTypeCount {
  type: string;
  count: number;
  totalCredit: number;
  totalDebit: number;
  grossTotal: number;
}

export interface SeriesStats {
  series: string;
  documentType: string;
  count: number;
  firstNumber: number;
  lastNumber: number;
  missingNumbers: number[];
  totalCredit: number;
  totalDebit: number;
}

export interface DayStats {
  date: string;
  documentCount: number;
  grossTotal: number;
  netTotal: number;
  taxTotal: number;
}

export interface FinancialSummary {
  totalRevenue: number;
  totalCredit: number;
  totalDebit: number;
  vatBreakdown: VatBreakdown[];
  documentTypeCounts: DocumentTypeCount[];
  seriesStats: SeriesStats[];
  dayStats: DayStats[];
}

export interface HashChainResult {
  series: string;
  documentType: string;
  totalDocuments: number;
  valid: boolean;
  firstBreakAt?: string;
  errors: ValidationError[];
}

export interface HealthScore {
  overall: number;
  bySection: Record<string, number>;
}

export interface ErrorSummary {
  total: number;
  bySeverity: Record<Severity, number>;
  bySection: Record<string, number>;
  byCode: Record<string, number>;
  topErrors: Array<{ code: string; count: number; message: string }>;
}

export interface AnalysisResult {
  id: string;
  fileName: string;
  fileSize: number;
  analyzedAt: string;
  duration: number;
  saftVersion: string;
  saftType: "complete" | "partial";
  header: SaftHeader;
  saftData: SaftFile;
  financialSummary: FinancialSummary;
  hashChainResults: HashChainResult[];
  errors: ValidationError[];
  errorSummary: ErrorSummary;
  healthScore: HealthScore;
  xsdValid: boolean;
  xsdErrors: ValidationError[];
}
