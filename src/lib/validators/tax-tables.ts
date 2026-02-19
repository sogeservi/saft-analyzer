import type { ValidationError } from "../types/errors";
import type { SaftFile } from "../types/saft";

const VALID_TAX_TYPES = ["IVA", "IS", "NS"];
const VALID_PT_REGIONS = ["PT", "PT-AC", "PT-MA"];
const VALID_IVA_CODES = ["RED", "INT", "NOR", "ISE", "OUT"];

// Current rates (2024+): PT=23/13/6, PT-AC=16/9/4, PT-MA=22/12/4
// Historical rates included to avoid false positives on older files
const KNOWN_PT_RATES: Record<string, number[]> = {
  // Standard: 16→17→19→21→20→21→23 | Intermediate: 12→13 | Reduced: 8→5→6
  "PT": [0, 5, 6, 8, 12, 13, 16, 17, 19, 20, 21, 23],
  // Standard: 8→12→15→18→16 | Intermediate: 5→9→10 | Reduced: 4→5→4
  "PT-AC": [0, 4, 5, 8, 9, 10, 12, 15, 16, 18],
  // Standard: 8→12→15→22 | Intermediate: 5→9→12 | Reduced: 4→5→4
  "PT-MA": [0, 4, 5, 8, 9, 12, 15, 22],
};

const CURRENT_PT_RATES: Record<string, { standard: number; intermediate: number; reduced: number }> = {
  "PT": { standard: 23, intermediate: 13, reduced: 6 },
  "PT-AC": { standard: 16, intermediate: 9, reduced: 4 },
  "PT-MA": { standard: 22, intermediate: 12, reduced: 4 },
};

export function validateTaxTables(saftData: SaftFile): ValidationError[] {
  const errors: ValidationError[] = [];
  const entries = saftData.masterFiles.taxTable;

  // TAX_001: TaxTable present
  if (entries.length === 0) {
    errors.push({
      code: "TAX_001",
      severity: "critical",
      message: "TaxTable ausente ou vazia. Deve existir pelo menos uma TaxTableEntry.",
      explanation: "A secção TaxTable é obrigatória e deve conter pelo menos uma entrada.",
      path: "MasterFiles.TaxTable",
      section: "TaxTables",
      autoFixable: false,
    });
    return errors;
  }

  const seenCombinations = new Set<string>();

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const path = `MasterFiles.TaxTable.TaxTableEntry[${i}]`;
    const entryId = `${entry.taxType}/${entry.taxCountryRegion}/${entry.taxCode}`;

    // TAX_002: TaxType valid
    if (!VALID_TAX_TYPES.includes(entry.taxType)) {
      errors.push({
        code: "TAX_002",
        severity: "error",
        message: `TaxType '${entry.taxType}' inválido. Valores válidos: ${VALID_TAX_TYPES.join(", ")}.`,
        explanation: "TaxType deve ser IVA (Imposto sobre o Valor Acrescentado), IS (Imposto de Selo) ou NS (Não sujeito).",
        path: `${path}.TaxType`,
        section: "TaxTables",
        documentId: entryId,
        autoFixable: false,
      });
    }

    // TAX_003: TaxCountryRegion valid
    if (entry.taxCountryRegion.startsWith("PT") && !VALID_PT_REGIONS.includes(entry.taxCountryRegion)) {
      errors.push({
        code: "TAX_003",
        severity: "error",
        message: `TaxCountryRegion '${entry.taxCountryRegion}' inválido. Regiões portuguesas válidas: ${VALID_PT_REGIONS.join(", ")}.`,
        explanation: "Para impostos portugueses, deve ser PT (Continental), PT-AC (Açores) ou PT-MA (Madeira).",
        path: `${path}.TaxCountryRegion`,
        section: "TaxTables",
        documentId: entryId,
        autoFixable: false,
      });
    }

    // TAX_004: TaxCode valid
    if (entry.taxType === "IVA" && entry.taxCountryRegion.startsWith("PT")) {
      if (!VALID_IVA_CODES.includes(entry.taxCode)) {
        errors.push({
          code: "TAX_004",
          severity: "error",
          message: `TaxCode '${entry.taxCode}' inválido para IVA. Códigos válidos: ${VALID_IVA_CODES.join(", ")}.`,
          explanation: "RED (Reduzida), INT (Intermédia), NOR (Normal), ISE (Isenta), OUT (Outros).",
          path: `${path}.TaxCode`,
          section: "TaxTables",
          documentId: entryId,
          autoFixable: false,
        });
      }
    }

    // TAX_005: TaxPercentage/TaxAmount consistency
    const hasPercentage = entry.taxPercentage !== undefined;
    const hasAmount = entry.taxAmount !== undefined;
    if (!hasPercentage && !hasAmount) {
      errors.push({
        code: "TAX_005",
        severity: "error",
        message: `Entrada de imposto '${entryId}' sem TaxPercentage nem TaxAmount.`,
        explanation: "Cada TaxTableEntry deve ter TaxPercentage ou TaxAmount (pelo menos um).",
        path: `${path}`,
        section: "TaxTables",
        documentId: entryId,
        autoFixable: false,
      });
    }
    if (hasPercentage && entry.taxPercentage! < 0) {
      errors.push({
        code: "TAX_005",
        severity: "error",
        message: `TaxPercentage negativa (${entry.taxPercentage}) na entrada '${entryId}'.`,
        explanation: "A percentagem de imposto deve ser >= 0.",
        path: `${path}.TaxPercentage`,
        section: "TaxTables",
        documentId: entryId,
        autoFixable: false,
      });
    }

    // TAX_006: Tax rate matches known PT rates
    if (
      entry.taxType === "IVA" &&
      hasPercentage &&
      entry.taxCountryRegion.startsWith("PT")
    ) {
      const knownRates = KNOWN_PT_RATES[entry.taxCountryRegion];
      const currentRates = CURRENT_PT_RATES[entry.taxCountryRegion];
      if (knownRates && !knownRates.includes(entry.taxPercentage!)) {
        const currentStr = currentRates
          ? `Taxas atuais: ${currentRates.reduced}% (RED), ${currentRates.intermediate}% (INT), ${currentRates.standard}% (NOR)`
          : "";
        errors.push({
          code: "TAX_006",
          severity: "warning",
          message: `Taxa IVA ${entry.taxPercentage}% para ${entry.taxCountryRegion} não corresponde a nenhuma taxa portuguesa conhecida (atual ou histórica).`,
          explanation: `${currentStr}. Taxas conhecidas (atuais + históricas): ${knownRates.join(", ")}%.`,
          path: `${path}.TaxPercentage`,
          section: "TaxTables",
          documentId: entryId,
          autoFixable: false,
        });
      }
    }

    // TAX_007: Duplicate tax entries
    const comboKey = `${entry.taxType}|${entry.taxCountryRegion}|${entry.taxCode}`;
    if (seenCombinations.has(comboKey)) {
      errors.push({
        code: "TAX_007",
        severity: "error",
        message: `Entrada de imposto duplicada: ${entryId}.`,
        explanation: "A mesma combinação de TaxType + TaxCountryRegion + TaxCode não deve aparecer duas vezes.",
        path: `${path}`,
        section: "TaxTables",
        documentId: entryId,
        autoFixable: false,
      });
    }
    seenCombinations.add(comboKey);

    // TAX_008: Exemption reason required when TaxPercentage is 0%
    if (hasPercentage && entry.taxPercentage === 0 && entry.taxCode === "ISE") {
      // The exemption reason check is done at the document line level (INV_032, INV_033)
      // Here we just note that this is an exempt rate
    }
  }

  return errors;
}
