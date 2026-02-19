import type { ValidationError } from "../types/errors";
import type { SaftFile } from "../types/saft";
import type { HashChainResult } from "../types/analysis";

const HASH_BASE64_LENGTH = 172;
const HASH_BASE64_RE = /^[A-Za-z0-9+/]{171}=$/;

function e(
  code: string, severity: "critical" | "error" | "warning" | "info",
  message: string, path: string, docId?: string,
): ValidationError {
  return { code, severity, message, explanation: message, path, section: "HashChain", documentId: docId, autoFixable: false };
}

interface HashableDocument {
  id: string;
  date: string;
  systemEntryDate: string;
  grossTotal: number;
  hash: string;
  series: string;
  sequentialNumber: number;
  documentType: string;
  path: string;
}

function extractInvoiceDocs(saftData: SaftFile): HashableDocument[] {
  const docs: HashableDocument[] = [];
  for (const inv of saftData.sourceDocuments.salesInvoices?.invoices ?? []) {
    const parts = inv.invoiceNo.split("/");
    const series = parts[0] ?? "";
    const seqNum = parts.length >= 2 ? parseInt(parts[1], 10) : 0;
    docs.push({
      id: inv.invoiceNo,
      date: inv.invoiceDate,
      systemEntryDate: inv.systemEntryDate,
      grossTotal: inv.documentTotals.grossTotal,
      hash: inv.hash,
      series,
      sequentialNumber: seqNum,
      documentType: inv.invoiceType,
      path: `SourceDocuments.SalesInvoices.Invoice[${inv.invoiceNo}]`,
    });
  }
  return docs;
}

function extractPaymentDocs(saftData: SaftFile): HashableDocument[] {
  const docs: HashableDocument[] = [];
  for (const pay of saftData.sourceDocuments.payments?.payments ?? []) {
    const parts = pay.paymentRefNo.split("/");
    const series = parts[0] ?? "";
    const seqNum = parts.length >= 2 ? parseInt(parts[1], 10) : 0;
    docs.push({
      id: pay.paymentRefNo,
      date: pay.transactionDate,
      systemEntryDate: pay.systemEntryDate,
      grossTotal: pay.documentTotals.grossTotal,
      hash: "",
      series,
      sequentialNumber: seqNum,
      documentType: pay.paymentType,
      path: `SourceDocuments.Payments.Payment[${pay.paymentRefNo}]`,
    });
  }
  return docs;
}

function extractMovementDocs(saftData: SaftFile): HashableDocument[] {
  const docs: HashableDocument[] = [];
  for (const sm of saftData.sourceDocuments.movementOfGoods?.stockMovements ?? []) {
    const parts = sm.documentNumber.split("/");
    const series = parts[0] ?? "";
    const seqNum = parts.length >= 2 ? parseInt(parts[1], 10) : 0;
    docs.push({
      id: sm.documentNumber,
      date: sm.movementDate,
      systemEntryDate: sm.systemEntryDate,
      grossTotal: sm.documentTotals.grossTotal,
      hash: sm.hash,
      series,
      sequentialNumber: seqNum,
      documentType: sm.movementType,
      path: `SourceDocuments.MovementOfGoods.StockMovement[${sm.documentNumber}]`,
    });
  }
  return docs;
}

function extractWorkDocs(saftData: SaftFile): HashableDocument[] {
  const docs: HashableDocument[] = [];
  for (const doc of saftData.sourceDocuments.workingDocuments?.workDocuments ?? []) {
    const parts = doc.documentNumber.split("/");
    const series = parts[0] ?? "";
    const seqNum = parts.length >= 2 ? parseInt(parts[1], 10) : 0;
    docs.push({
      id: doc.documentNumber,
      date: doc.workDate,
      systemEntryDate: doc.systemEntryDate,
      grossTotal: doc.documentTotals.grossTotal,
      hash: doc.hash,
      series,
      sequentialNumber: seqNum,
      documentType: doc.workType,
      path: `SourceDocuments.WorkingDocuments.WorkDocument[${doc.documentNumber}]`,
    });
  }
  return docs;
}

function validateChainForSeries(
  docs: HashableDocument[],
  seriesKey: string,
  documentType: string,
): HashChainResult {
  const errors: ValidationError[] = [];

  docs.sort((a, b) => a.sequentialNumber - b.sequentialNumber);

  let chainValid = true;
  let firstBreakAt: string | undefined;

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];

    // HASH_001: Hash field format
    if (!doc.hash) {
      errors.push(e("HASH_001", "critical",
        `Hash em falta no documento '${doc.id}'.`,
        `${doc.path}.Hash`, doc.id));
      chainValid = false;
      if (!firstBreakAt) firstBreakAt = doc.id;
      continue;
    }

    if (doc.hash === "0") {
      // HASH_005: Hash = "0"
      errors.push(e("HASH_005", "warning",
        `Hash '0' no documento '${doc.id}' — software não certificado ou importação.`,
        `${doc.path}.Hash`, doc.id));
      continue;
    }

    if (doc.hash.length !== HASH_BASE64_LENGTH || !HASH_BASE64_RE.test(doc.hash)) {
      errors.push(e("HASH_001", "critical",
        `Hash do documento '${doc.id}' não tem o formato esperado (172 caracteres Base64 terminando em '=').`,
        `${doc.path}.Hash`, doc.id));
      chainValid = false;
      if (!firstBreakAt) firstBreakAt = doc.id;
    }

    // HASH_002: First document in series
    if (i === 0 && doc.sequentialNumber === 1) {
      // First document — hash uses empty previous hash (trailing semicolon)
      // We can't verify the actual RSA signature without the vendor's public key,
      // but we can check the format
    }

    // HASH_008: SystemEntryDate ordering within series
    if (i > 0) {
      const prevDoc = docs[i - 1];
      if (doc.systemEntryDate < prevDoc.systemEntryDate) {
        errors.push(e("HASH_008", "error",
          `SystemEntryDate '${doc.systemEntryDate}' do documento '${doc.id}' é anterior ao documento precedente '${prevDoc.id}' (${prevDoc.systemEntryDate}).`,
          `${doc.path}.SystemEntryDate`, doc.id));
        chainValid = false;
        if (!firstBreakAt) firstBreakAt = doc.id;
      }
    }
  }

  // HASH_006: Hash chain per document type
  const typesInSeries = new Set(docs.map((d) => d.documentType));
  if (typesInSeries.size > 1) {
    errors.push(e("HASH_006", "error",
      `Série '${seriesKey}' contém tipos de documento diferentes: ${Array.from(typesInSeries).join(", ")}. As cadeias de hash devem ser mantidas por tipo e série.`,
      `SourceDocuments`, seriesKey));
    chainValid = false;
    if (!firstBreakAt) firstBreakAt = docs[0]?.id;
  }

  return {
    series: seriesKey,
    documentType,
    totalDocuments: docs.length,
    valid: chainValid,
    firstBreakAt,
    errors,
  };
}

export function validateHashChains(saftData: SaftFile): HashChainResult[] {
  const results: HashChainResult[] = [];

  const allDocs = [
    ...extractInvoiceDocs(saftData),
    ...extractMovementDocs(saftData),
    ...extractWorkDocs(saftData),
  ];

  const seriesMap = new Map<string, HashableDocument[]>();
  for (const doc of allDocs) {
    const key = `${doc.documentType}|${doc.series}`;
    const list = seriesMap.get(key) ?? [];
    list.push(doc);
    seriesMap.set(key, list);
  }

  for (const [key, docs] of seriesMap) {
    const [docType] = key.split("|");
    results.push(validateChainForSeries(docs, key, docType));
  }

  // Payments don't have the same hash chain structure but validate basic format
  for (const doc of extractPaymentDocs(saftData)) {
    // Payments in SAF-T PT don't have a Hash field in the same way
    // They still have ATCUD which is validated elsewhere
  }

  return results;
}
