import type { ValidationError, Fix, PatchDocument } from "../types/errors";
import type { SaftFile } from "../types/saft";
import { isEuCountry } from "../validators/tax-id";

export function generateFixes(
  saftData: SaftFile,
  errors: ValidationError[],
): Fix[] {
  const fixes: Fix[] = [];

  for (const error of errors) {
    if (!error.autoFixable) continue;

    const fix = generateFixForError(saftData, error);
    if (fix) fixes.push(fix);
  }

  return fixes;
}

function generateFixForError(
  saftData: SaftFile,
  error: ValidationError,
): Fix | null {
  switch (error.code) {
    case "CUST_004":
    case "SUPP_004":
      return fixMissingVatPrefix(saftData, error);
    case "INV_001":
    case "PAY_001":
    case "WRK_001":
    case "GL_001":
      return fixEntryCount(error);
    case "INV_002":
    case "INV_003":
    case "PAY_002":
    case "PAY_003":
    case "GL_002":
    case "GL_003":
      return fixDeclaredTotal(error);
    case "INV_020":
    case "INV_021":
    case "INV_022":
    case "INV_023":
      return fixDocumentTotals(error);
    default:
      return null;
  }
}

function fixMissingVatPrefix(
  saftData: SaftFile,
  error: ValidationError,
): Fix | null {
  if (!error.originalValue || !error.documentId) return null;

  let country = "";
  if (error.code === "CUST_004") {
    const cust = saftData.masterFiles.customers.find(
      (c) => c.customerID === error.documentId,
    );
    country = cust?.billingAddress.country ?? "";
  } else {
    const supp = saftData.masterFiles.suppliers.find(
      (s) => s.supplierID === error.documentId,
    );
    country = supp?.billingAddress.country ?? "";
  }

  if (!country || !isEuCountry(country)) return null;

  return {
    errorCode: error.code,
    path: error.path,
    originalValue: error.originalValue,
    correctedValue: `${country}${error.originalValue}`,
    description: `Adicionado prefixo '${country}' ao NIF`,
  };
}

function fixEntryCount(error: ValidationError): Fix | null {
  if (!error.originalValue || !error.suggestedFix) return null;
  const match = error.suggestedFix.match(/(\d+)/);
  if (!match) return null;

  return {
    errorCode: error.code,
    path: error.path,
    originalValue: error.originalValue,
    correctedValue: match[1],
    description: error.suggestedFix,
  };
}

function fixDeclaredTotal(error: ValidationError): Fix | null {
  if (!error.originalValue || !error.suggestedFix) return null;
  const match = error.suggestedFix.match(/([\d.]+)/);
  if (!match) return null;

  return {
    errorCode: error.code,
    path: error.path,
    originalValue: error.originalValue,
    correctedValue: match[1],
    description: error.suggestedFix,
  };
}

function fixDocumentTotals(error: ValidationError): Fix | null {
  if (!error.originalValue || !error.suggestedFix) return null;
  const match = error.suggestedFix.match(/([\d.]+)/);
  if (!match) return null;

  return {
    errorCode: error.code,
    path: error.path,
    originalValue: error.originalValue,
    correctedValue: match[1],
    description: error.suggestedFix,
  };
}

export function buildPatchDocument(
  fileName: string,
  selectedFixes: Fix[],
): PatchDocument {
  return {
    sourceFile: fileName,
    analyzedAt: new Date().toISOString(),
    fixes: selectedFixes,
  };
}
