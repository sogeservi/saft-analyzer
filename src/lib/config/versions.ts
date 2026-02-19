export interface VersionConfig {
  version: string;
  namespace: string;
  xsdFile: string;
  requiredSections: string[];
}

export const VERSION_CONFIGS: Record<string, VersionConfig> = {
  "1.01_01": {
    version: "1.01_01",
    namespace: "urn:OECD:StandardAuditFile-Tax:PT_1.01_01",
    xsdFile: "1.01_01.xsd",
    requiredSections: ["Header", "MasterFiles"],
  },
  "1.02_01": {
    version: "1.02_01",
    namespace: "urn:OECD:StandardAuditFile-Tax:PT_1.02_01",
    xsdFile: "1.02_01.xsd",
    requiredSections: ["Header", "MasterFiles"],
  },
  "1.03_01": {
    version: "1.03_01",
    namespace: "urn:OECD:StandardAuditFile-Tax:PT_1.03_01",
    xsdFile: "1.03_01.xsd",
    requiredSections: ["Header", "MasterFiles"],
  },
  "1.04_01": {
    version: "1.04_01",
    namespace: "urn:OECD:StandardAuditFile-Tax:PT_1.04_01",
    xsdFile: "1.04_01.xsd",
    requiredSections: ["Header", "MasterFiles"],
  },
};

export const TAX_ACCOUNTING_BASIS_REQUIRED_SECTIONS: Record<string, string[]> = {
  C: ["GeneralLedgerEntries", "SourceDocuments"],
  E: ["SourceDocuments"],
  F: ["SourceDocuments"],
  I: ["GeneralLedgerEntries", "SourceDocuments"],
  P: ["SourceDocuments"],
  R: ["SourceDocuments"],
  S: ["SourceDocuments"],
  T: ["SourceDocuments"],
};
