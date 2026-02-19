import type { ValidationError } from "../types/errors";
import type { SaftFile } from "../types/saft";

const VALID_PAYMENT_TYPES = ["RC", "RG"];
const VALID_PAYMENT_STATUSES = ["N", "A"];
const VALID_PAYMENT_MECHANISMS = [
  "CC","CD","CH","CI","CO","CS","DE","LC","MB","NU","OU","PR","TB","TR",
];
const ATCUD_RE = /^[A-Z0-9]{8,}-[0-9]+$/;
const DOC_TOLERANCE = 0.20;
const GLOBAL_TOLERANCE = 1.00;

function e(
  code: string, severity: "critical" | "error" | "warning" | "info",
  message: string, path: string, docId?: string, autoFixable = false,
): ValidationError {
  return { code, severity, message, explanation: message, path, section: "Payments", documentId: docId, autoFixable };
}

export function validatePayments(saftData: SaftFile): ValidationError[] {
  const errors: ValidationError[] = [];
  const pays = saftData.sourceDocuments.payments;
  if (!pays) return errors;

  const base = "SourceDocuments.Payments";
  const customerIds = new Set(saftData.masterFiles.customers.map((c) => c.customerID));
  const paymentRefNos = new Set<string>();

  // PAY_001
  if (pays.numberOfEntries !== pays.payments.length) {
    errors.push(e("PAY_001", "error",
      `NumberOfEntries declarado (${pays.numberOfEntries}) difere do real (${pays.payments.length}).`,
      `${base}.NumberOfEntries`, undefined, true));
  }

  // PAY_002 & PAY_003
  let sumD = 0, sumC = 0;
  for (const p of pays.payments) {
    if (p.documentStatus.paymentStatus === "A") continue;
    for (const l of p.lines) {
      sumD += l.debitAmount ?? 0;
      sumC += l.creditAmount ?? 0;
    }
  }
  if (Math.abs(pays.totalDebit - sumD) > GLOBAL_TOLERANCE) {
    errors.push(e("PAY_002", "error", `TotalDebit declarado (${pays.totalDebit.toFixed(2)}) difere da soma (${sumD.toFixed(2)}).`, `${base}.TotalDebit`, undefined, true));
  }
  if (Math.abs(pays.totalCredit - sumC) > GLOBAL_TOLERANCE) {
    errors.push(e("PAY_003", "error", `TotalCredit declarado (${pays.totalCredit.toFixed(2)}) difere da soma (${sumC.toFixed(2)}).`, `${base}.TotalCredit`, undefined, true));
  }

  for (const pay of pays.payments) {
    const pp = `${base}.Payment[${pay.paymentRefNo}]`;

    // PAY_004
    if (!pay.paymentRefNo) {
      errors.push(e("PAY_004", "critical", "PaymentRefNo em falta.", pp, pay.paymentRefNo));
      continue;
    }

    // PAY_018
    if (paymentRefNos.has(pay.paymentRefNo)) {
      errors.push(e("PAY_018", "error", `PaymentRefNo '${pay.paymentRefNo}' duplicado.`, `${pp}.PaymentRefNo`, pay.paymentRefNo));
    }
    paymentRefNos.add(pay.paymentRefNo);

    // PAY_005
    if (!VALID_PAYMENT_TYPES.includes(pay.paymentType)) {
      errors.push(e("PAY_005", "error", `PaymentType '${pay.paymentType}' inválido. Valores válidos: ${VALID_PAYMENT_TYPES.join(", ")}.`, `${pp}.PaymentType`, pay.paymentRefNo));
    }

    // PAY_006
    if (pay.transactionDate) {
      const h = saftData.header;
      if (h.startDate && pay.transactionDate < h.startDate) {
        errors.push(e("PAY_006", "error", `TransactionDate '${pay.transactionDate}' anterior a StartDate.`, `${pp}.TransactionDate`, pay.paymentRefNo));
      }
      if (h.endDate && pay.transactionDate > h.endDate) {
        errors.push(e("PAY_006", "error", `TransactionDate '${pay.transactionDate}' posterior a EndDate.`, `${pp}.TransactionDate`, pay.paymentRefNo));
      }
    }

    // PAY_007
    if (pay.systemEntryDate && pay.transactionDate) {
      if (pay.systemEntryDate.substring(0, 10) < pay.transactionDate) {
        errors.push(e("PAY_007", "error", `SystemEntryDate anterior a TransactionDate.`, `${pp}.SystemEntryDate`, pay.paymentRefNo));
      }
    }

    // PAY_008
    if (!pay.atcud) {
      errors.push(e("PAY_008", "critical", `ATCUD em falta no recibo '${pay.paymentRefNo}'.`, `${pp}.ATCUD`, pay.paymentRefNo));
    } else if (!ATCUD_RE.test(pay.atcud)) {
      errors.push(e("PAY_008", "critical", `ATCUD '${pay.atcud}' com formato inválido.`, `${pp}.ATCUD`, pay.paymentRefNo));
    }

    // PAY_009
    if (!VALID_PAYMENT_STATUSES.includes(pay.documentStatus.paymentStatus)) {
      errors.push(e("PAY_009", "error", `PaymentStatus '${pay.documentStatus.paymentStatus}' inválido. Valores: N, A.`, `${pp}.DocumentStatus.PaymentStatus`, pay.paymentRefNo));
    }

    // PAY_010
    if (pay.lines.length === 0) {
      errors.push(e("PAY_010", "error", `Recibo '${pay.paymentRefNo}' sem linhas.`, `${pp}.Line`, pay.paymentRefNo));
    }

    // PAY_011
    for (const l of pay.lines) {
      if (l.creditAmount !== undefined && l.creditAmount < 0) {
        errors.push(e("PAY_011", "error", `CreditAmount negativo na linha ${l.lineNumber}.`, `${pp}.Line[${l.lineNumber}].CreditAmount`, pay.paymentRefNo));
      }
      if (l.debitAmount !== undefined && l.debitAmount < 0) {
        errors.push(e("PAY_011", "error", `DebitAmount negativo na linha ${l.lineNumber}.`, `${pp}.Line[${l.lineNumber}].DebitAmount`, pay.paymentRefNo));
      }
    }

    // PAY_012
    if (pay.paymentMethods.length === 0) {
      errors.push(e("PAY_012", "error", `PaymentMethod em falta no recibo '${pay.paymentRefNo}'.`, `${pp}.PaymentMethod`, pay.paymentRefNo));
    }
    for (const pm of pay.paymentMethods) {
      if (!VALID_PAYMENT_MECHANISMS.includes(pm.paymentMechanism)) {
        errors.push(e("PAY_012", "error", `PaymentMechanism '${pm.paymentMechanism}' inválido.`, `${pp}.PaymentMethod.PaymentMechanism`, pay.paymentRefNo));
      }
    }

    // PAY_014
    if (pay.documentStatus.paymentStatus !== "A") {
      const calcTax = pay.documentTotals.grossTotal - pay.documentTotals.netTotal;
      if (Math.abs(pay.documentTotals.taxPayable - calcTax) > DOC_TOLERANCE) {
        errors.push(e("PAY_014", "error",
          `TaxPayable (${pay.documentTotals.taxPayable.toFixed(2)}) difere de GrossTotal-NetTotal (${calcTax.toFixed(2)}).`,
          `${pp}.DocumentTotals`, pay.paymentRefNo, true));
      }
    }

    // PAY_016
    if (pay.customerID && !customerIds.has(pay.customerID)) {
      errors.push(e("PAY_016", "error",
        `CustomerID '${pay.customerID}' não existe nos MasterFiles.`,
        `${pp}.CustomerID`, pay.paymentRefNo));
    }
  }

  return errors;
}
