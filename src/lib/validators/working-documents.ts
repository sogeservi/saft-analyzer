import type { ValidationError } from "../types/errors";
import type { SaftFile } from "../types/saft";

const VALID_WORK_TYPES = [
  "CM","CC","FC","FO","NE","OU","OR","PF","DC","RP","RE","CS","LD","RA",
];
const VALID_WORK_STATUSES = ["N", "A", "F"];
const ATCUD_RE = /^[A-Z0-9]{8,}-[0-9]+$/;
const DOC_TOLERANCE = 0.20;
const GLOBAL_TOLERANCE = 1.00;

function e(
  code: string, severity: "critical" | "error" | "warning" | "info",
  message: string, path: string, docId?: string, autoFixable = false,
): ValidationError {
  return { code, severity, message, explanation: message, path, section: "WorkingDocuments", documentId: docId, autoFixable };
}

export function validateWorkingDocuments(saftData: SaftFile): ValidationError[] {
  const errors: ValidationError[] = [];
  const wd = saftData.sourceDocuments.workingDocuments;
  if (!wd) return errors;

  const base = "SourceDocuments.WorkingDocuments";
  const customerIds = new Set(saftData.masterFiles.customers.map((c) => c.customerID));
  const docNumbers = new Set<string>();

  // WRK_001
  if (wd.numberOfEntries !== wd.workDocuments.length) {
    errors.push(e("WRK_001", "error",
      `NumberOfEntries declarado (${wd.numberOfEntries}) difere do real (${wd.workDocuments.length}).`,
      `${base}.NumberOfEntries`, undefined, true));
  }

  // WRK_002
  let sumD = 0, sumC = 0;
  for (const doc of wd.workDocuments) {
    if (doc.documentStatus.workStatus === "A") continue;
    for (const l of doc.lines) {
      sumD += l.debitAmount ?? 0;
      sumC += l.creditAmount ?? 0;
    }
  }
  if (Math.abs(wd.totalDebit - sumD) > GLOBAL_TOLERANCE) {
    errors.push(e("WRK_002", "error", `TotalDebit declarado (${wd.totalDebit.toFixed(2)}) difere da soma (${sumD.toFixed(2)}).`, `${base}.TotalDebit`, undefined, true));
  }
  if (Math.abs(wd.totalCredit - sumC) > GLOBAL_TOLERANCE) {
    errors.push(e("WRK_002", "error", `TotalCredit declarado (${wd.totalCredit.toFixed(2)}) difere da soma (${sumC.toFixed(2)}).`, `${base}.TotalCredit`, undefined, true));
  }

  for (const doc of wd.workDocuments) {
    const dp = `${base}.WorkDocument[${doc.documentNumber}]`;

    // WRK_003
    if (!doc.documentNumber) {
      errors.push(e("WRK_003", "critical", "DocumentNumber em falta.", dp));
      continue;
    }

    // WRK_011
    if (docNumbers.has(doc.documentNumber)) {
      errors.push(e("WRK_011", "error", `DocumentNumber '${doc.documentNumber}' duplicado.`, `${dp}.DocumentNumber`, doc.documentNumber));
    }
    docNumbers.add(doc.documentNumber);

    // WRK_004
    if (!VALID_WORK_TYPES.includes(doc.workType)) {
      errors.push(e("WRK_004", "error",
        `WorkType '${doc.workType}' inválido. Valores válidos: ${VALID_WORK_TYPES.join(", ")}.`,
        `${dp}.WorkType`, doc.documentNumber));
    }

    // WRK_005
    if (doc.workDate) {
      const h = saftData.header;
      if (h.startDate && doc.workDate < h.startDate) {
        errors.push(e("WRK_005", "error", `WorkDate '${doc.workDate}' anterior a StartDate.`, `${dp}.WorkDate`, doc.documentNumber));
      }
      if (h.endDate && doc.workDate > h.endDate) {
        errors.push(e("WRK_005", "error", `WorkDate '${doc.workDate}' posterior a EndDate.`, `${dp}.WorkDate`, doc.documentNumber));
      }
    }

    // WRK_006
    if (!doc.atcud) {
      errors.push(e("WRK_006", "critical", `ATCUD em falta no documento '${doc.documentNumber}'.`, `${dp}.ATCUD`, doc.documentNumber));
    } else if (!ATCUD_RE.test(doc.atcud)) {
      errors.push(e("WRK_006", "critical", `ATCUD '${doc.atcud}' com formato inválido.`, `${dp}.ATCUD`, doc.documentNumber));
    }

    // WRK_007
    if (!VALID_WORK_STATUSES.includes(doc.documentStatus.workStatus)) {
      errors.push(e("WRK_007", "error", `WorkStatus '${doc.documentStatus.workStatus}' inválido.`, `${dp}.DocumentStatus.WorkStatus`, doc.documentNumber));
    }

    // WRK_008
    for (const l of doc.lines) {
      if (l.creditAmount !== undefined && l.creditAmount < 0) {
        errors.push(e("WRK_008", "error", `CreditAmount negativo na linha ${l.lineNumber}.`, `${dp}.Line[${l.lineNumber}].CreditAmount`, doc.documentNumber));
      }
      if (l.debitAmount !== undefined && l.debitAmount < 0) {
        errors.push(e("WRK_008", "error", `DebitAmount negativo na linha ${l.lineNumber}.`, `${dp}.Line[${l.lineNumber}].DebitAmount`, doc.documentNumber));
      }
    }

    // WRK_009
    if (doc.customerID && !customerIds.has(doc.customerID)) {
      errors.push(e("WRK_009", "error", `CustomerID '${doc.customerID}' não existe nos MasterFiles.`, `${dp}.CustomerID`, doc.documentNumber));
    }

    // WRK_010
    if (doc.documentStatus.workStatus !== "A") {
      const calcTax = doc.documentTotals.grossTotal - doc.documentTotals.netTotal;
      if (Math.abs(doc.documentTotals.taxPayable - calcTax) > DOC_TOLERANCE) {
        errors.push(e("WRK_010", "error",
          `TaxPayable (${doc.documentTotals.taxPayable.toFixed(2)}) difere de GrossTotal-NetTotal (${calcTax.toFixed(2)}).`,
          `${dp}.DocumentTotals`, doc.documentNumber, true));
      }
    }
  }

  return errors;
}
