import type { Severity } from "./errors";

export interface RuleFixDefinition {
  type: "prefix" | "replace" | "recalculate" | "populate" | "normalize";
  value?: string;
  source?: string;
}

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  severity: Severity;
  section: string;
  enabled: boolean;
  fix?: RuleFixDefinition;
}

export interface RuleFile {
  rules: ValidationRule[];
}

export interface RuleIndex {
  byId: Map<string, ValidationRule>;
  bySection: Map<string, ValidationRule[]>;
  bySeverity: Map<Severity, ValidationRule[]>;
}
