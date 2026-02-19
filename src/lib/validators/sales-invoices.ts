import type { ValidationError } from "../types/errors";
import type { SaftFile, SaftInvoice } from "../types/saft";

const VALID_INVOICE_TYPES = ["FT", "FS", "FR", "ND", "NC", "VD", "TV", "TD", "AA", "DA"];
const VALID_INVOICE_STATUSES = ["N", "S", "A", "R", "F"];
const VALID_SOURCE_BILLING = ["P", "I", "M"];
const ATCUD_RE = /^[A-Z0-9]{8,}-[0-9]+$/;
const DOC_TOLERANCE = 0.20;
const LINE_TOLERANCE = 0.01;
const GLOBAL_TOLERANCE = 1.00;
const VALID_EXEMPTION_CODES = new Set([
  "M01","M02","M04","M05","M06","M07","M09","M10","M11","M12","M13","M14","M15","M16",
  "M19","M20","M21","M25","M26","M30","M31","M32","M33","M34","M40","M41","M42","M43","M99",
]);

export function validateSalesInvoices(saftData: SaftFile): ValidationError[] {
  const errors: ValidationError[] = [];
  const si = saftData.sourceDocuments.salesInvoices;
  if (!si) return errors;

  const basePath = "SourceDocuments.SalesInvoices";
  const customerIds = new Set(saftData.masterFiles.customers.map((c) => c.customerID));
  const productCodes = new Set(saftData.masterFiles.products.map((p) => p.productCode));
  const taxCombos = new Set(
    saftData.masterFiles.taxTable.map(
      (t) => `${t.taxType}|${t.taxCountryRegion}|${t.taxCode}`,
    ),
  );
  const invoiceNos = new Set<string>();
  const seriesAtcud = new Map<string, string>();

  // INV_001: NumberOfEntries matches actual
  if (si.numberOfEntries !== si.invoices.length) {
    errors.push(e("INV_001", "error",
      `NumberOfEntries declarado (${si.numberOfEntries}) difere do real (${si.invoices.length}).`,
      `${basePath}.NumberOfEntries`, undefined, true, String(si.numberOfEntries),
      `Corrigir para ${si.invoices.length}`));
  }

  // INV_002 & INV_003: TotalDebit/TotalCredit matches sum
  let sumDebit = 0;
  let sumCredit = 0;
  for (const inv of si.invoices) {
    if (inv.documentStatus.invoiceStatus === "A") continue;
    for (const line of inv.lines) {
      sumDebit += line.debitAmount ?? 0;
      sumCredit += line.creditAmount ?? 0;
    }
  }
  if (Math.abs(si.totalDebit - sumDebit) > GLOBAL_TOLERANCE) {
    errors.push(e("INV_002", "error",
      `TotalDebit declarado (${si.totalDebit.toFixed(2)}) difere da soma (${sumDebit.toFixed(2)}).`,
      `${basePath}.TotalDebit`, undefined, true));
  }
  if (Math.abs(si.totalCredit - sumCredit) > GLOBAL_TOLERANCE) {
    errors.push(e("INV_003", "error",
      `TotalCredit declarado (${si.totalCredit.toFixed(2)}) difere da soma (${sumCredit.toFixed(2)}).`,
      `${basePath}.TotalCredit`, undefined, true));
  }

  // INV_024: Global file total vs signed sum of document line amounts
  let signedDocSum = 0;
  for (const inv of si.invoices) {
    if (inv.documentStatus.invoiceStatus === "A") continue;
    for (const line of inv.lines) {
      signedDocSum += (line.creditAmount ?? 0) - (line.debitAmount ?? 0);
    }
  }
  const declaredNet = si.totalCredit - si.totalDebit;
  if (Math.abs(declaredNet - signedDocSum) > GLOBAL_TOLERANCE) {
    errors.push(e("INV_024", "error",
      `Soma líquida dos documentos (${signedDocSum.toFixed(2)}) difere do total global (${declaredNet.toFixed(2)}).`,
      `${basePath}`, undefined, false));
  }

  for (const inv of si.invoices) {
    const path = `${basePath}.Invoice[${inv.invoiceNo}]`;
    validateSingleInvoice(inv, path, errors, saftData, customerIds, productCodes, taxCombos, invoiceNos, seriesAtcud);
  }

  // INV_027: Sequential numbering gaps (per series)
  const seriesNumbers = new Map<string, number[]>();
  for (const inv of si.invoices) {
    const parts = inv.invoiceNo.split("/");
    if (parts.length < 2) continue;
    const series = parts[0];
    const seqNum = parseInt(parts[1], 10);
    if (isNaN(seqNum)) continue;
    const existing = seriesNumbers.get(series) ?? [];
    existing.push(seqNum);
    seriesNumbers.set(series, existing);
  }
  for (const [series, numbers] of seriesNumbers) {
    numbers.sort((a, b) => a - b);
    for (let i = 1; i < numbers.length; i++) {
      if (numbers[i] - numbers[i - 1] > 1) {
        const missing = [];
        for (let n = numbers[i - 1] + 1; n < numbers[i]; n++) missing.push(n);
        errors.push(e("INV_027", "warning",
          `Lacuna na numeração da série '${series}': números ${missing.join(", ")} em falta.`,
          `${basePath}`, series, false));
      }
    }
  }

  return errors;
}

function validateSingleInvoice(
  inv: SaftInvoice,
  path: string,
  errors: ValidationError[],
  saftData: SaftFile,
  customerIds: Set<string>,
  productCodes: Set<string>,
  taxCombos: Set<string>,
  invoiceNos: Set<string>,
  seriesAtcud: Map<string, string>,
): void {
  // INV_004: InvoiceNo present
  if (!inv.invoiceNo) {
    errors.push(e("INV_004", "critical", "InvoiceNo em falta.", `${path}.InvoiceNo`, inv.invoiceNo, false));
    return;
  }

  // INV_028: Duplicate InvoiceNo
  if (invoiceNos.has(inv.invoiceNo)) {
    errors.push(e("INV_028", "error",
      `InvoiceNo '${inv.invoiceNo}' duplicado.`,
      `${path}.InvoiceNo`, inv.invoiceNo, false));
  }
  invoiceNos.add(inv.invoiceNo);

  // INV_005: InvoiceDate present
  if (!inv.invoiceDate) {
    errors.push(e("INV_005", "critical", "InvoiceDate em falta.", `${path}.InvoiceDate`, inv.invoiceNo, false));
  }

  // INV_006: InvoiceType present and valid
  if (!inv.invoiceType) {
    errors.push(e("INV_006", "critical", "InvoiceType em falta.", `${path}.InvoiceType`, inv.invoiceNo, false));
  } else if (!VALID_INVOICE_TYPES.includes(inv.invoiceType)) {
    errors.push(e("INV_006", "critical",
      `InvoiceType '${inv.invoiceType}' inválido. Valores válidos: ${VALID_INVOICE_TYPES.join(", ")}.`,
      `${path}.InvoiceType`, inv.invoiceNo, false));
  }

  // INV_007: Hash present
  if (!inv.hash) {
    errors.push(e("INV_007", "critical", `Hash em falta na fatura '${inv.invoiceNo}'.`, `${path}.Hash`, inv.invoiceNo, false));
  }

  // INV_008: ATCUD present and valid format
  if (!inv.atcud) {
    errors.push(e("INV_008", "critical", `ATCUD em falta na fatura '${inv.invoiceNo}'.`, `${path}.ATCUD`, inv.invoiceNo, false));
  } else if (!ATCUD_RE.test(inv.atcud)) {
    errors.push(e("INV_008", "critical",
      `ATCUD '${inv.atcud}' com formato inválido. Esperado: código alfanumérico (mín. 8 chars) + hífen + número sequencial.`,
      `${path}.ATCUD`, inv.invoiceNo, false));
  } else {
    const atcudParts = inv.atcud.split("-");
    const atcudCode = atcudParts[0];
    const atcudSeq = atcudParts[1];

    // INV_009: ATCUD series consistency
    const parts = inv.invoiceNo.split("/");
    const series = parts[0] ?? "";
    const existingCode = seriesAtcud.get(series);
    if (existingCode && existingCode !== atcudCode) {
      errors.push(e("INV_009", "error",
        `ATCUD inconsistente na série '${series}': esperado código '${existingCode}', encontrado '${atcudCode}'.`,
        `${path}.ATCUD`, inv.invoiceNo, false));
    }
    seriesAtcud.set(series, atcudCode);

    // INV_010: ATCUD number matches invoice number
    if (parts.length >= 2) {
      const invoiceSeq = parts[1];
      if (atcudSeq !== invoiceSeq) {
        errors.push(e("INV_010", "error",
          `Número sequencial do ATCUD (${atcudSeq}) difere do número da fatura (${invoiceSeq}).`,
          `${path}.ATCUD`, inv.invoiceNo, false));
      }
    }
  }

  // INV_011: SystemEntryDate present
  if (!inv.systemEntryDate) {
    errors.push(e("INV_011", "critical", `SystemEntryDate em falta na fatura '${inv.invoiceNo}'.`, `${path}.SystemEntryDate`, inv.invoiceNo, false));
  }

  // INV_012: DocumentStatus present
  if (!inv.documentStatus) {
    errors.push(e("INV_012", "error", `DocumentStatus em falta na fatura '${inv.invoiceNo}'.`, `${path}.DocumentStatus`, inv.invoiceNo, false));
  } else {
    // INV_013: InvoiceStatus valid
    if (!VALID_INVOICE_STATUSES.includes(inv.documentStatus.invoiceStatus)) {
      errors.push(e("INV_013", "error",
        `InvoiceStatus '${inv.documentStatus.invoiceStatus}' inválido. Valores válidos: ${VALID_INVOICE_STATUSES.join(", ")}.`,
        `${path}.DocumentStatus.InvoiceStatus`, inv.invoiceNo, false));
    }
  }

  // INV_014: Invoice has lines
  if (inv.lines.length === 0) {
    errors.push(e("INV_014", "error", `Fatura '${inv.invoiceNo}' sem linhas.`, `${path}.Line`, inv.invoiceNo, false));
  }

  let linesCreditSum = 0;
  let linesDebitSum = 0;
  let linesNetSum = 0;

  for (const line of inv.lines) {
    const lp = `${path}.Line[${line.lineNumber}]`;

    // INV_015: Line quantity positive
    if (line.quantity <= 0) {
      errors.push(e("INV_015", "error", `Quantidade <= 0 (${line.quantity}) na linha ${line.lineNumber} da fatura '${inv.invoiceNo}'.`, `${lp}.Quantity`, inv.invoiceNo, false));
    }

    // INV_016: Line CreditAmount positive
    if (line.creditAmount !== undefined && line.creditAmount < 0) {
      errors.push(e("INV_016", "error", `CreditAmount negativo (${line.creditAmount}) na linha ${line.lineNumber}.`, `${lp}.CreditAmount`, inv.invoiceNo, false));
    }

    // INV_017: Line DebitAmount positive
    if (line.debitAmount !== undefined && line.debitAmount < 0) {
      errors.push(e("INV_017", "error", `DebitAmount negativo (${line.debitAmount}) na linha ${line.lineNumber}.`, `${lp}.DebitAmount`, inv.invoiceNo, false));
    }

    // INV_018: Line has Credit or Debit
    const hasCredit = line.creditAmount !== undefined && line.creditAmount > 0;
    const hasDebit = line.debitAmount !== undefined && line.debitAmount > 0;
    if (!hasCredit && !hasDebit) {
      errors.push(e("INV_018", "error", `Linha ${line.lineNumber} sem CreditAmount nem DebitAmount.`, lp, inv.invoiceNo, false));
    }
    if (hasCredit && hasDebit) {
      errors.push(e("INV_018", "error", `Linha ${line.lineNumber} com CreditAmount E DebitAmount — deve ter apenas um.`, lp, inv.invoiceNo, false));
    }

    linesCreditSum += line.creditAmount ?? 0;
    linesDebitSum += line.debitAmount ?? 0;
    const lineAmount = (line.creditAmount ?? 0) - (line.debitAmount ?? 0);
    linesNetSum += lineAmount;

    // INV_019: Tax information present on lines
    if (!line.tax || !line.tax.taxType || !line.tax.taxCountryRegion || !line.tax.taxCode) {
      errors.push(e("INV_019", "error", `Informação fiscal incompleta na linha ${line.lineNumber} da fatura '${inv.invoiceNo}'.`, `${lp}.Tax`, inv.invoiceNo, false));
    } else {
      // INV_031: Tax code references TaxTable
      const combo = `${line.tax.taxType}|${line.tax.taxCountryRegion}|${line.tax.taxCode}`;
      if (!taxCombos.has(combo)) {
        errors.push(e("INV_031", "error",
          `Combinação fiscal '${combo}' na linha ${line.lineNumber} não existe na TaxTable.`,
          `${lp}.Tax`, inv.invoiceNo, false));
      }

      // INV_032 & INV_033 & INV_046: Tax exemption
      if (line.tax.taxPercentage === 0) {
        if (!line.taxExemptionReason && !line.tax.taxExemptionReason) {
          errors.push(e("INV_032", "error",
            `Linha ${line.lineNumber} com IVA 0% sem TaxExemptionReason.`,
            `${lp}.TaxExemptionReason`, inv.invoiceNo, false));
        }
        if (!line.taxExemptionCode && !line.tax.taxExemptionCode) {
          errors.push(e("INV_032", "error",
            `Linha ${line.lineNumber} com IVA 0% sem TaxExemptionCode.`,
            `${lp}.TaxExemptionCode`, inv.invoiceNo, false));
        }
        const exemptionCode = line.taxExemptionCode ?? line.tax.taxExemptionCode;
        if (exemptionCode && !VALID_EXEMPTION_CODES.has(exemptionCode)) {
          errors.push(e("INV_046", "error",
            `TaxExemptionCode '${exemptionCode}' inválido na linha ${line.lineNumber}.`,
            `${lp}.TaxExemptionCode`, inv.invoiceNo, false));
        }
      }
    }

    // INV_030: ProductCode references valid product
    if (line.productCode && !productCodes.has(line.productCode)) {
      errors.push(e("INV_030", "error",
        `ProductCode '${line.productCode}' na linha ${line.lineNumber} não existe nos MasterFiles.`,
        `${lp}.ProductCode`, inv.invoiceNo, false));
    }

    // INV_037: UnitPrice consistency
    if (line.unitPrice > 0 && line.quantity > 0) {
      const expectedAmount = line.unitPrice * line.quantity;
      const actualAmount = (line.creditAmount ?? 0) + (line.debitAmount ?? 0);
      if (actualAmount > 0 && Math.abs(expectedAmount - actualAmount) > actualAmount * 0.5) {
        errors.push(e("INV_037", "warning",
          `UnitPrice*Quantity (${expectedAmount.toFixed(2)}) diverge significativamente do montante (${actualAmount.toFixed(2)}) na linha ${line.lineNumber}.`,
          `${lp}.UnitPrice`, inv.invoiceNo, false));
      }
    }
  }

  if (inv.documentStatus.invoiceStatus === "A") return;

  // INV_020: GrossTotal = NetTotal + TaxPayable
  const expectedGross = inv.documentTotals.netTotal + inv.documentTotals.taxPayable;
  if (Math.abs(inv.documentTotals.grossTotal - expectedGross) > DOC_TOLERANCE && inv.documentTotals.grossTotal > 0) {
    errors.push(e("INV_020", "error",
      `GrossTotal declarado (${inv.documentTotals.grossTotal.toFixed(2)}) difere de NetTotal+TaxPayable (${expectedGross.toFixed(2)}).`,
      `${path}.DocumentTotals.GrossTotal`, inv.invoiceNo, true,
      String(inv.documentTotals.grossTotal), `Corrigir para ${expectedGross.toFixed(2)}`));
  }

  // INV_021: NetTotal vs line sum (use absolute values for NC/ND which have negative lines)
  const calcNet = Math.abs(linesCreditSum - linesDebitSum);
  if (inv.documentTotals.netTotal > 0 && Math.abs(inv.documentTotals.netTotal - calcNet) > DOC_TOLERANCE) {
    errors.push(e("INV_021", "error",
      `NetTotal declarado (${inv.documentTotals.netTotal.toFixed(2)}) difere da soma das linhas (${calcNet.toFixed(2)}).`,
      `${path}.DocumentTotals.NetTotal`, inv.invoiceNo, true));
  }

  // INV_022: TaxPayable vs calculated
  const calcTax = inv.documentTotals.grossTotal - inv.documentTotals.netTotal;
  if (Math.abs(inv.documentTotals.taxPayable - calcTax) > DOC_TOLERANCE) {
    errors.push(e("INV_022", "error",
      `TaxPayable declarado (${inv.documentTotals.taxPayable.toFixed(2)}) difere de GrossTotal-NetTotal (${calcTax.toFixed(2)}).`,
      `${path}.DocumentTotals.TaxPayable`, inv.invoiceNo, true));
  }

  // INV_023: GrossTotal zero with non-zero lines
  if (inv.documentTotals.grossTotal === 0 && calcNet > LINE_TOLERANCE) {
    errors.push(e("INV_023", "error",
      `GrossTotal é 0 mas as linhas somam ${calcNet.toFixed(2)} na fatura '${inv.invoiceNo}'.`,
      `${path}.DocumentTotals.GrossTotal`, inv.invoiceNo, true));
  }

  // INV_025: InvoiceDate within period
  if (inv.invoiceDate) {
    const h = saftData.header;
    if (h.startDate && inv.invoiceDate < h.startDate) {
      errors.push(e("INV_025", "error",
        `InvoiceDate '${inv.invoiceDate}' anterior a StartDate '${h.startDate}'.`,
        `${path}.InvoiceDate`, inv.invoiceNo, false));
    }
    if (h.endDate && inv.invoiceDate > h.endDate) {
      errors.push(e("INV_025", "error",
        `InvoiceDate '${inv.invoiceDate}' posterior a EndDate '${h.endDate}'.`,
        `${path}.InvoiceDate`, inv.invoiceNo, false));
    }
  }

  // INV_026: SystemEntryDate >= InvoiceDate
  if (inv.systemEntryDate && inv.invoiceDate) {
    if (inv.systemEntryDate.substring(0, 10) < inv.invoiceDate) {
      errors.push(e("INV_026", "error",
        `SystemEntryDate '${inv.systemEntryDate}' anterior a InvoiceDate '${inv.invoiceDate}'.`,
        `${path}.SystemEntryDate`, inv.invoiceNo, false));
    }
  }

  // INV_029: CustomerID references valid customer
  if (inv.customerID && !customerIds.has(inv.customerID)) {
    errors.push(e("INV_029", "error",
      `CustomerID '${inv.customerID}' na fatura '${inv.invoiceNo}' não existe nos MasterFiles.`,
      `${path}.CustomerID`, inv.invoiceNo, false));
  }

  // INV_034: SourceBilling valid
  if (inv.documentStatus.sourceBilling && !VALID_SOURCE_BILLING.includes(inv.documentStatus.sourceBilling)) {
    errors.push(e("INV_034", "warning",
      `SourceBilling '${inv.documentStatus.sourceBilling}' inválido. Valores válidos: P, I, M.`,
      `${path}.DocumentStatus.SourceBilling`, inv.invoiceNo, false));
  }

  // INV_035: EACCode valid
  if (inv.eacCode && !/^\d{5}$/.test(inv.eacCode)) {
    errors.push(e("INV_035", "warning",
      `EACCode '${inv.eacCode}' inválido — deve ter 5 dígitos (código CAE).`,
      `${path}.EACCode`, inv.invoiceNo, false));
  }

  // INV_036: NC/ND must reference original
  if (inv.invoiceType === "NC" || inv.invoiceType === "ND") {
    const hasRef = inv.lines.some((l) => l.references && l.references.length > 0);
    if (!hasRef) {
      errors.push(e("INV_036", "error",
        `${inv.invoiceType} '${inv.invoiceNo}' sem referência ao documento original.`,
        `${path}.Line.References`, inv.invoiceNo, false));
    }
  }

  // INV_041: Period matches InvoiceDate month
  if (inv.period && inv.invoiceDate) {
    const month = parseInt(inv.invoiceDate.substring(5, 7), 10);
    const period = parseInt(inv.period, 10);
    if (!isNaN(month) && !isNaN(period) && month !== period) {
      errors.push(e("INV_041", "error",
        `Period (${inv.period}) não corresponde ao mês de InvoiceDate (${month}).`,
        `${path}.Period`, inv.invoiceNo, false));
    }
  }

  // INV_042: HashControl present
  if (!inv.hashControl) {
    errors.push(e("INV_042", "error",
      `HashControl em falta na fatura '${inv.invoiceNo}'.`,
      `${path}.HashControl`, inv.invoiceNo, false));
  }

  // INV_043: SpecialRegimes completeness
  if (inv.specialRegimes) {
    const sr = inv.specialRegimes;
    if (!["0", "1"].includes(sr.selfBillingIndicator) ||
        !["0", "1"].includes(sr.cashVATSchemeIndicator) ||
        !["0", "1"].includes(sr.thirdPartiesBillingIndicator)) {
      errors.push(e("INV_043", "error",
        `SpecialRegimes incompleto ou com valores inválidos na fatura '${inv.invoiceNo}'.`,
        `${path}.SpecialRegimes`, inv.invoiceNo, false));
    }
  }

  // INV_044: FS simplified invoice GrossTotal limit
  if (inv.invoiceType === "FS" && inv.documentTotals.grossTotal > 1000) {
    errors.push(e("INV_044", "warning",
      `Fatura simplificada (FS) '${inv.invoiceNo}' com GrossTotal ${inv.documentTotals.grossTotal.toFixed(2)} > 1000.00 EUR.`,
      `${path}.DocumentTotals.GrossTotal`, inv.invoiceNo, false));
  }

  // INV_045: FS consumer NIF
  if (inv.invoiceType !== "FS" && inv.invoiceType !== "VD" && inv.invoiceType !== "TV") {
    const customer = saftData.masterFiles.customers.find((c) => c.customerID === inv.customerID);
    if (customer?.customerTaxID === "999999990") {
      errors.push(e("INV_045", "error",
        `Fatura '${inv.invoiceNo}' (tipo ${inv.invoiceType}) com NIF genérico '999999990'.`,
        `${path}.CustomerID`, inv.invoiceNo, false));
    }
  }
}

function e(
  code: string,
  severity: "critical" | "error" | "warning" | "info",
  message: string,
  path: string,
  documentId?: string,
  autoFixable?: boolean,
  originalValue?: string,
  suggestedFix?: string,
): ValidationError {
  return {
    code,
    severity,
    message,
    explanation: message,
    path,
    section: "SalesInvoices",
    documentId: documentId ?? undefined,
    autoFixable: autoFixable ?? false,
    originalValue,
    suggestedFix,
  };
}
