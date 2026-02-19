export type Severity = "critical" | "error" | "warning" | "info";

export const SEVERITY_LABELS: Record<Severity, string> = {
  critical: "Crítico",
  error: "Erro",
  warning: "Aviso",
  info: "Informação",
};

export const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  error: 1,
  warning: 2,
  info: 3,
};

export interface ValidationError {
  code: string;
  severity: Severity;
  message: string;
  explanation: string;
  path: string;
  section: string;
  documentId?: string;
  lineNumber?: number;
  originalValue?: string;
  suggestedFix?: string;
  autoFixable: boolean;
}

export interface Fix {
  errorCode: string;
  path: string;
  originalValue: string;
  correctedValue: string;
  description: string;
}

export interface PatchDocument {
  sourceFile: string;
  analyzedAt: string;
  fixes: Fix[];
}
