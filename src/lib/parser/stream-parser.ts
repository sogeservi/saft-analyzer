import sax from "sax";
import type {
  SaftFile,
  SaftHeader,
  SaftAddress,
  SaftCustomer,
  SaftSupplier,
  SaftProduct,
  SaftTaxTableEntry,
  SaftGeneralLedgerAccount,
  SaftGeneralLedgerEntries,
  SaftJournal,
  SaftTransaction,
  SaftGLTransactionLines,
  SaftGLDebitLine,
  SaftGLCreditLine,
  SaftSourceDocuments,
  SaftSalesInvoices,
  SaftInvoice,
  SaftInvoiceLine,
  SaftPayments,
  SaftPayment,
  SaftPaymentLine,
  SaftPaymentMethod,
  SaftMovementOfGoods,
  SaftStockMovement,
  SaftMovementLine,
  SaftWorkingDocuments,
  SaftWorkDocument,
  SaftWorkDocumentLine,
  SaftDocumentStatus,
  SaftPaymentDocumentStatus,
  SaftMovementDocumentStatus,
  SaftWorkDocumentStatus,
  SaftDocumentTotals,
  SaftLineTax,
  SaftSpecialRegimes,
  SaftMasterFiles,
  SaftWithholdingTax,
  SaftCurrency,
  SaftSettlement,
  SaftDocumentReference,
  SaftShipInfo,
} from "../types/saft";
import type { AnalysisProgress, SectionCounts } from "../types/analysis";

const NUMERIC_FIELDS = new Set([
  "openingDebitBalance",
  "openingCreditBalance",
  "closingDebitBalance",
  "closingCreditBalance",
  "numberOfEntries",
  "totalDebit",
  "totalCredit",
  "numberOfMovementLines",
  "totalQuantityIssued",
  "quantity",
  "unitPrice",
  "creditAmount",
  "debitAmount",
  "taxPayable",
  "netTotal",
  "grossTotal",
  "taxPercentage",
  "taxAmount",
  "settlementAmount",
  "withholdingTaxAmount",
  "currencyAmount",
  "exchangeRate",
  "paymentAmount",
  "lineNumber",
]);

interface Frame {
  name: string;
  properties: Record<string, unknown>;
  text: string;
  hasChildElements: boolean;
}

type Raw = Record<string, unknown>;

function toCamelCase(name: string): string {
  if (!name) return name;
  return name.charAt(0).toLowerCase() + name.slice(1);
}

function ensureArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function str(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === undefined || value === null) return "";
  return String(value);
}

function num(value: unknown): number {
  if (typeof value === "number") return value;
  const n = parseFloat(String(value));
  return isNaN(n) ? 0 : n;
}

function obj(value: unknown): Raw {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Raw;
  }
  return {};
}

export type ProgressCallback = (progress: AnalysisProgress) => void;

export class XmlParseError extends Error {
  readonly line: number;
  readonly column: number;

  constructor(message: string, line: number, column: number) {
    super(message);
    this.name = "XmlParseError";
    this.line = line;
    this.column = column;
  }
}

export async function parseSaftStream(
  input: ReadableStream<Uint8Array>,
  onProgress?: ProgressCallback,
  encoding = "utf-8",
): Promise<SaftFile> {
  const parser = sax.parser(true, { trim: true });
  const stack: Frame[] = [];
  let rootResult: Raw | null = null;
  let currentSection = "";
  let parseError: XmlParseError | null = null;
  const counts: SectionCounts = {
    customers: 0,
    suppliers: 0,
    products: 0,
    taxTableEntries: 0,
    glEntries: 0,
    invoices: 0,
    payments: 0,
    stockMovements: 0,
    workDocuments: 0,
  };

  parser.onopentag = (node) => {
    const localName = node.name.includes(":")
      ? node.name.split(":").pop()!
      : node.name;
    const name = toCamelCase(localName);
    if (stack.length > 0) stack[stack.length - 1].hasChildElements = true;
    stack.push({ name, properties: {}, text: "", hasChildElements: false });

    if (stack.length === 2 && localName !== currentSection) {
      currentSection = localName;
      onProgress?.({
        phase: "xml-parse",
        percentage: estimateProgress(localName),
        currentSection: localName,
        counts: { ...counts },
        errorsFound: 0,
      });
    }
  };

  parser.ontext = (text) => {
    if (stack.length > 0) stack[stack.length - 1].text += text;
  };

  parser.oncdata = (cdata) => {
    if (stack.length > 0) stack[stack.length - 1].text += cdata;
  };

  parser.onclosetag = () => {
    const frame = stack.pop();
    if (!frame) return;

    let value: unknown;
    if (!frame.hasChildElements) {
      const text = frame.text.trim();
      if (NUMERIC_FIELDS.has(frame.name)) {
        const n = parseFloat(text);
        value = isNaN(n) ? text : n;
      } else {
        value = text;
      }
    } else {
      value = frame.properties;
    }

    if (stack.length > 0) {
      const parent = stack[stack.length - 1];
      const existing = parent.properties[frame.name];
      if (existing !== undefined) {
        if (Array.isArray(existing)) existing.push(value);
        else parent.properties[frame.name] = [existing, value];
      } else {
        parent.properties[frame.name] = value;
      }
      trackRecordCount(frame.name);
    } else {
      rootResult = frame.hasChildElements ? (frame.properties as Raw) : null;
    }
  };

  function trackRecordCount(elementName: string): void {
    switch (elementName) {
      case "customer": counts.customers++; break;
      case "supplier": counts.suppliers++; break;
      case "product": counts.products++; break;
      case "taxTableEntry": counts.taxTableEntries++; break;
      case "transaction": counts.glEntries++; break;
      case "invoice": counts.invoices++; break;
      case "payment": counts.payments++; break;
      case "stockMovement": counts.stockMovements++; break;
      case "workDocument": counts.workDocuments++; break;
    }
  }

  function estimateProgress(section: string): number {
    switch (section) {
      case "Header": return 5;
      case "MasterFiles": return 15;
      case "GeneralLedgerEntries": return 40;
      case "SourceDocuments": return 70;
      default: return 0;
    }
  }

  parser.onerror = (error) => {
    const { line, column } = parser;
    const message = error.message.split(/\r?\nLine:/, 1)[0].trim();
    parseError = new XmlParseError(message, line + 1, column + 1);
  };

  const isIso885915 = encoding.toUpperCase() === "ISO-8859-15";
  const decoder = new TextDecoder(isIso885915 ? "windows-1252" : encoding);
  const decode = (bytes: Uint8Array, options?: TextDecodeOptions): string => {
    const text = decoder.decode(bytes, options);
    if (!isIso885915) return text;
    const replacements: Record<string, string> = {
      "\u00a4": "\u20ac",
      "\u00a6": "\u0160",
      "\u00a8": "\u0161",
      "\u00b4": "\u017d",
      "\u00b8": "\u017e",
      "\u00bc": "\u0152",
      "\u00bd": "\u0153",
      "\u00be": "\u0178",
    };
    return text.replace(/[\u00a4\u00a6\u00a8\u00b4\u00b8\u00bc\u00bd\u00be]/g, (char) => replacements[char]);
  };
  const reader = input.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      parser.write(decode(value, { stream: true }));
      if (parseError) throw parseError;
    }
    parser.write(decode(new Uint8Array()));
    parser.close();
    if (parseError) throw parseError;
    if (!rootResult) {
      throw new XmlParseError("O ficheiro est\u00e1 vazio ou n\u00e3o cont\u00e9m um elemento XML v\u00e1lido.", 1, 1);
    }
    const saftFile = mapToSaftFile(rootResult);
    onProgress?.({
      phase: "complete",
      percentage: 100,
      counts: { ...counts },
      errorsFound: 0,
    });
    return saftFile;
  } catch (error) {
    await reader.cancel(error).catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
}
function mapAddress(raw: unknown): SaftAddress {
  const r = obj(raw);
  return {
    buildingNumber: str(r.buildingNumber) || undefined,
    streetName: str(r.streetName) || undefined,
    addressDetail: str(r.addressDetail),
    city: str(r.city),
    postalCode: str(r.postalCode),
    region: str(r.region) || undefined,
    country: str(r.country),
  };
}

function mapHeader(raw: unknown): SaftHeader {
  const r = obj(raw);
  return {
    auditFileVersion: str(r.auditFileVersion),
    companyID: str(r.companyID),
    taxRegistrationNumber: str(r.taxRegistrationNumber),
    taxAccountingBasis: str(r.taxAccountingBasis),
    companyName: str(r.companyName),
    businessName: str(r.businessName) || undefined,
    companyAddress: mapAddress(r.companyAddress),
    fiscalYear: str(r.fiscalYear),
    startDate: str(r.startDate),
    endDate: str(r.endDate),
    currencyCode: str(r.currencyCode),
    dateCreated: str(r.dateCreated),
    taxEntity: str(r.taxEntity),
    productCompanyTaxID: str(r.productCompanyTaxID),
    softwareCertificateNumber: str(r.softwareCertificateNumber),
    productID: str(r.productID),
    productVersion: str(r.productVersion),
    headerComment: str(r.headerComment) || undefined,
    telephone: str(r.telephone) || undefined,
    fax: str(r.fax) || undefined,
    email: str(r.email) || undefined,
    website: str(r.website) || undefined,
  };
}

function mapCustomer(raw: unknown): SaftCustomer {
  const r = obj(raw);
  return {
    customerID: str(r.customerID),
    accountID: str(r.accountID),
    customerTaxID: str(r.customerTaxID),
    companyName: str(r.companyName),
    contact: str(r.contact) || undefined,
    billingAddress: mapAddress(r.billingAddress),
    shipToAddress: r.shipToAddress ? mapAddress(r.shipToAddress) : undefined,
    telephone: str(r.telephone) || undefined,
    fax: str(r.fax) || undefined,
    email: str(r.email) || undefined,
    website: str(r.website) || undefined,
    selfBillingIndicator: str(r.selfBillingIndicator),
  };
}

function mapSupplier(raw: unknown): SaftSupplier {
  const r = obj(raw);
  return {
    supplierID: str(r.supplierID),
    accountID: str(r.accountID),
    supplierTaxID: str(r.supplierTaxID),
    companyName: str(r.companyName),
    contact: str(r.contact) || undefined,
    billingAddress: mapAddress(r.billingAddress),
    shipToAddress: r.shipToAddress ? mapAddress(r.shipToAddress) : undefined,
    telephone: str(r.telephone) || undefined,
    fax: str(r.fax) || undefined,
    email: str(r.email) || undefined,
    website: str(r.website) || undefined,
    selfBillingIndicator: str(r.selfBillingIndicator),
  };
}

function mapProduct(raw: unknown): SaftProduct {
  const r = obj(raw);
  return {
    productType: str(r.productType),
    productCode: str(r.productCode),
    productGroup: str(r.productGroup) || undefined,
    productDescription: str(r.productDescription),
    productNumberCode: str(r.productNumberCode),
  };
}

function mapTaxTableEntry(raw: unknown): SaftTaxTableEntry {
  const r = obj(raw);
  return {
    taxType: str(r.taxType),
    taxCountryRegion: str(r.taxCountryRegion),
    taxCode: str(r.taxCode),
    description: str(r.description) || undefined,
    taxExpirationDate: str(r.taxExpirationDate) || undefined,
    taxPercentage: r.taxPercentage !== undefined ? num(r.taxPercentage) : undefined,
    taxAmount: r.taxAmount !== undefined ? num(r.taxAmount) : undefined,
  };
}

function mapGLAccount(raw: unknown): SaftGeneralLedgerAccount {
  const r = obj(raw);
  return {
    accountID: str(r.accountID),
    accountDescription: str(r.accountDescription),
    openingDebitBalance: num(r.openingDebitBalance),
    openingCreditBalance: num(r.openingCreditBalance),
    closingDebitBalance: num(r.closingDebitBalance),
    closingCreditBalance: num(r.closingCreditBalance),
    groupingCategory: str(r.groupingCategory) || undefined,
    groupingCode: str(r.groupingCode) || undefined,
    taxonomyCode: str(r.taxonomyCode) || undefined,
  };
}

function mapGLDebitLine(raw: unknown): SaftGLDebitLine {
  const r = obj(raw);
  return {
    recordID: str(r.recordID),
    accountID: str(r.accountID),
    systemEntryDate: str(r.systemEntryDate),
    description: str(r.description),
    debitAmount: num(r.debitAmount),
    sourceDocumentID: str(r.sourceDocumentID) || undefined,
  };
}

function mapGLCreditLine(raw: unknown): SaftGLCreditLine {
  const r = obj(raw);
  return {
    recordID: str(r.recordID),
    accountID: str(r.accountID),
    systemEntryDate: str(r.systemEntryDate),
    description: str(r.description),
    creditAmount: num(r.creditAmount),
    sourceDocumentID: str(r.sourceDocumentID) || undefined,
  };
}

function mapGLTransactionLines(raw: unknown): SaftGLTransactionLines {
  const r = obj(raw);
  return {
    debitLines: ensureArray(r.debitLine).map(mapGLDebitLine),
    creditLines: ensureArray(r.creditLine).map(mapGLCreditLine),
  };
}

function mapTransaction(raw: unknown): SaftTransaction {
  const r = obj(raw);
  return {
    transactionID: str(r.transactionID),
    period: str(r.period),
    transactionDate: str(r.transactionDate),
    sourceID: str(r.sourceID),
    description: str(r.description),
    docArchivalNumber: str(r.docArchivalNumber) || undefined,
    transactionType: str(r.transactionType),
    glPostingDate: str(r.gLPostingDate) || undefined,
    customerID: str(r.customerID) || undefined,
    supplierID: str(r.supplierID) || undefined,
    systemEntryDate: str(r.systemEntryDate),
    lines: mapGLTransactionLines(r.lines),
  };
}

function mapJournal(raw: unknown): SaftJournal {
  const r = obj(raw);
  return {
    journalID: str(r.journalID),
    description: str(r.description),
    transactions: ensureArray(r.transaction).map(mapTransaction),
  };
}

function mapGeneralLedgerEntries(
  raw: unknown,
): SaftGeneralLedgerEntries {
  const r = obj(raw);
  return {
    numberOfEntries: num(r.numberOfEntries),
    totalDebit: num(r.totalDebit),
    totalCredit: num(r.totalCredit),
    journals: ensureArray(r.journal).map(mapJournal),
  };
}

function mapLineTax(raw: unknown): SaftLineTax {
  const r = obj(raw);
  return {
    taxType: str(r.taxType),
    taxCountryRegion: str(r.taxCountryRegion),
    taxCode: str(r.taxCode),
    taxPercentage: r.taxPercentage !== undefined ? num(r.taxPercentage) : undefined,
    taxAmount: r.taxAmount !== undefined ? num(r.taxAmount) : undefined,
    taxExemptionReason: str(r.taxExemptionReason) || undefined,
    taxExemptionCode: str(r.taxExemptionCode) || undefined,
  };
}

function mapDocumentReference(raw: unknown): SaftDocumentReference {
  const r = obj(raw);
  return {
    reference: str(r.reference),
    reason: str(r.reason) || undefined,
  };
}

function mapWithholdingTax(raw: unknown): SaftWithholdingTax {
  const r = obj(raw);
  return {
    withholdingTaxType: str(r.withholdingTaxType) || undefined,
    withholdingTaxDescription: str(r.withholdingTaxDescription) || undefined,
    withholdingTaxAmount: num(r.withholdingTaxAmount),
  };
}

function mapCurrency(raw: unknown): SaftCurrency {
  const r = obj(raw);
  return {
    currencyCode: str(r.currencyCode),
    currencyAmount: num(r.currencyAmount),
    exchangeRate: num(r.exchangeRate),
  };
}

function mapSettlement(raw: unknown): SaftSettlement {
  const r = obj(raw);
  return {
    settlementDiscount: str(r.settlementDiscount) || undefined,
    settlementAmount: r.settlementAmount !== undefined ? num(r.settlementAmount) : undefined,
    settlementDate: str(r.settlementDate) || undefined,
    paymentTerms: str(r.paymentTerms) || undefined,
  };
}

function mapDocumentTotals(raw: unknown): SaftDocumentTotals {
  const r = obj(raw);
  return {
    taxPayable: num(r.taxPayable),
    netTotal: num(r.netTotal),
    grossTotal: num(r.grossTotal),
    currency: r.currency ? mapCurrency(r.currency) : undefined,
    settlement: r.settlement ? mapSettlement(r.settlement) : undefined,
    withholdingTax: r.withholdingTax
      ? ensureArray(r.withholdingTax).map(mapWithholdingTax)
      : undefined,
  };
}

function mapSpecialRegimes(raw: unknown): SaftSpecialRegimes {
  const r = obj(raw);
  return {
    selfBillingIndicator: str(r.selfBillingIndicator),
    cashVATSchemeIndicator: str(r.cashVATSchemeIndicator),
    thirdPartiesBillingIndicator: str(r.thirdPartiesBillingIndicator),
  };
}

function mapDocumentStatus(raw: unknown): SaftDocumentStatus {
  const r = obj(raw);
  return {
    invoiceStatus: str(r.invoiceStatus),
    invoiceStatusDate: str(r.invoiceStatusDate),
    reason: str(r.reason) || undefined,
    sourceID: str(r.sourceID),
    sourceBilling: str(r.sourceBilling),
  };
}

function mapInvoiceLine(raw: unknown): SaftInvoiceLine {
  const r = obj(raw);
  return {
    lineNumber: num(r.lineNumber),
    orderReferences: r.orderReferences
      ? ensureArray(r.orderReferences).map(mapDocumentReference)
      : undefined,
    productCode: str(r.productCode),
    productDescription: str(r.productDescription) || undefined,
    quantity: num(r.quantity),
    unitOfMeasure: str(r.unitOfMeasure),
    unitPrice: num(r.unitPrice),
    taxPointDate: str(r.taxPointDate) || undefined,
    references: r.references
      ? ensureArray(r.references).map(mapDocumentReference)
      : undefined,
    description: str(r.description),
    creditAmount: r.creditAmount !== undefined ? num(r.creditAmount) : undefined,
    debitAmount: r.debitAmount !== undefined ? num(r.debitAmount) : undefined,
    tax: mapLineTax(r.tax),
    taxExemptionReason: str(r.taxExemptionReason) || undefined,
    taxExemptionCode: str(r.taxExemptionCode) || undefined,
    settlementAmount: r.settlementAmount !== undefined
      ? num(r.settlementAmount)
      : undefined,
  };
}

function mapInvoice(raw: unknown): SaftInvoice {
  const r = obj(raw);
  return {
    invoiceNo: str(r.invoiceNo),
    atcud: str(r.aTCUD),
    documentStatus: mapDocumentStatus(r.documentStatus),
    hash: str(r.hash),
    hashControl: str(r.hashControl),
    period: str(r.period) || undefined,
    invoiceDate: str(r.invoiceDate),
    invoiceType: str(r.invoiceType),
    specialRegimes: mapSpecialRegimes(r.specialRegimes),
    sourceID: str(r.sourceID),
    eacCode: str(r.eACCode) || undefined,
    systemEntryDate: str(r.systemEntryDate),
    transactionID: str(r.transactionID) || undefined,
    customerID: str(r.customerID),
    shipTo: r.shipTo ? mapAddress(r.shipTo) : undefined,
    shipFrom: r.shipFrom ? mapAddress(r.shipFrom) : undefined,
    lines: ensureArray(r.line).map(mapInvoiceLine),
    documentTotals: mapDocumentTotals(r.documentTotals),
  };
}

function mapSalesInvoices(raw: unknown): SaftSalesInvoices {
  const r = obj(raw);
  return {
    numberOfEntries: num(r.numberOfEntries),
    totalDebit: num(r.totalDebit),
    totalCredit: num(r.totalCredit),
    invoices: ensureArray(r.invoice).map(mapInvoice),
  };
}

function mapPaymentDocumentStatus(
  raw: unknown,
): SaftPaymentDocumentStatus {
  const r = obj(raw);
  return {
    paymentStatus: str(r.paymentStatus),
    paymentStatusDate: str(r.paymentStatusDate),
    reason: str(r.reason) || undefined,
    sourceID: str(r.sourceID),
    sourceBilling: str(r.sourceBilling),
    sourcePayment: str(r.sourcePayment),
  };
}

function mapPaymentLine(raw: unknown): SaftPaymentLine {
  const r = obj(raw);
  const sourceDoc = r.sourceDocumentID
    ? obj(r.sourceDocumentID)
    : undefined;
  return {
    lineNumber: num(r.lineNumber),
    sourceDocumentID: sourceDoc
      ? {
          originatingON: str(sourceDoc.originatingON),
          invoiceDate: str(sourceDoc.invoiceDate),
          description: str(sourceDoc.description) || undefined,
        }
      : undefined,
    creditAmount: r.creditAmount !== undefined ? num(r.creditAmount) : undefined,
    debitAmount: r.debitAmount !== undefined ? num(r.debitAmount) : undefined,
    tax: r.tax ? mapLineTax(r.tax) : undefined,
    taxExemptionReason: str(r.taxExemptionReason) || undefined,
    taxExemptionCode: str(r.taxExemptionCode) || undefined,
    settlementAmount: r.settlementAmount !== undefined
      ? num(r.settlementAmount)
      : undefined,
  };
}

function mapPaymentMethod(raw: unknown): SaftPaymentMethod {
  const r = obj(raw);
  return {
    paymentMechanism: str(r.paymentMechanism),
    paymentAmount: num(r.paymentAmount),
    paymentDate: str(r.paymentDate),
  };
}

function mapPayment(raw: unknown): SaftPayment {
  const r = obj(raw);
  return {
    paymentRefNo: str(r.paymentRefNo),
    atcud: str(r.aTCUD),
    period: str(r.period) || undefined,
    transactionID: str(r.transactionID) || undefined,
    transactionDate: str(r.transactionDate),
    paymentType: str(r.paymentType),
    description: str(r.description) || undefined,
    systemID: str(r.systemID) || undefined,
    documentStatus: mapPaymentDocumentStatus(r.documentStatus),
    paymentMethods: ensureArray(r.paymentMethod).map(mapPaymentMethod),
    sourceID: str(r.sourceID),
    systemEntryDate: str(r.systemEntryDate),
    customerID: str(r.customerID),
    lines: ensureArray(r.line).map(mapPaymentLine),
    documentTotals: mapDocumentTotals(r.documentTotals),
    withholdingTax: r.withholdingTax
      ? ensureArray(r.withholdingTax).map(mapWithholdingTax)
      : undefined,
  };
}

function mapPayments(raw: unknown): SaftPayments {
  const r = obj(raw);
  return {
    numberOfEntries: num(r.numberOfEntries),
    totalDebit: num(r.totalDebit),
    totalCredit: num(r.totalCredit),
    payments: ensureArray(r.payment).map(mapPayment),
  };
}

function mapMovementDocumentStatus(
  raw: unknown,
): SaftMovementDocumentStatus {
  const r = obj(raw);
  return {
    movementStatus: str(r.movementStatus),
    movementStatusDate: str(r.movementStatusDate),
    reason: str(r.reason) || undefined,
    sourceID: str(r.sourceID),
    sourceBilling: str(r.sourceBilling),
  };
}

function mapShipInfo(raw: unknown): SaftShipInfo {
  const r = obj(raw);
  return {
    deliveryID: str(r.deliveryID) || undefined,
    deliveryDate: str(r.deliveryDate) || undefined,
    warehouseID: str(r.warehouseID) || undefined,
    locationID: str(r.locationID) || undefined,
    address: r.address ? mapAddress(r.address) : undefined,
  };
}

function mapMovementLine(raw: unknown): SaftMovementLine {
  const r = obj(raw);
  return {
    lineNumber: num(r.lineNumber),
    productCode: str(r.productCode),
    productDescription: str(r.productDescription) || undefined,
    quantity: num(r.quantity),
    unitOfMeasure: str(r.unitOfMeasure),
    unitPrice: num(r.unitPrice),
    description: str(r.description),
    creditAmount: r.creditAmount !== undefined ? num(r.creditAmount) : undefined,
    debitAmount: r.debitAmount !== undefined ? num(r.debitAmount) : undefined,
    tax: r.tax ? mapLineTax(r.tax) : undefined,
    taxExemptionReason: str(r.taxExemptionReason) || undefined,
    taxExemptionCode: str(r.taxExemptionCode) || undefined,
    settlementAmount: r.settlementAmount !== undefined
      ? num(r.settlementAmount)
      : undefined,
  };
}

function mapStockMovement(raw: unknown): SaftStockMovement {
  const r = obj(raw);
  return {
    documentNumber: str(r.documentNumber),
    atcud: str(r.aTCUD),
    documentStatus: mapMovementDocumentStatus(r.documentStatus),
    hash: str(r.hash),
    hashControl: str(r.hashControl),
    period: str(r.period) || undefined,
    movementDate: str(r.movementDate),
    movementType: str(r.movementType),
    systemEntryDate: str(r.systemEntryDate),
    transactionID: str(r.transactionID) || undefined,
    customerID: str(r.customerID) || undefined,
    supplierID: str(r.supplierID) || undefined,
    sourceID: str(r.sourceID),
    eacCode: str(r.eACCode) || undefined,
    movementComments: str(r.movementComments) || undefined,
    shipTo: r.shipTo ? mapShipInfo(r.shipTo) : undefined,
    shipFrom: r.shipFrom ? mapShipInfo(r.shipFrom) : undefined,
    movementStartTime: str(r.movementStartTime) || undefined,
    atDocCodeID: str(r.aTDocCodeID) || undefined,
    lines: ensureArray(r.line).map(mapMovementLine),
    documentTotals: mapDocumentTotals(r.documentTotals),
  };
}

function mapMovementOfGoods(raw: unknown): SaftMovementOfGoods {
  const r = obj(raw);
  return {
    numberOfMovementLines: num(r.numberOfMovementLines),
    totalQuantityIssued: num(r.totalQuantityIssued),
    stockMovements: ensureArray(r.stockMovement).map(mapStockMovement),
  };
}

function mapWorkDocumentStatus(raw: unknown): SaftWorkDocumentStatus {
  const r = obj(raw);
  return {
    workStatus: str(r.workStatus),
    workStatusDate: str(r.workStatusDate),
    reason: str(r.reason) || undefined,
    sourceID: str(r.sourceID),
    sourceBilling: str(r.sourceBilling),
  };
}

function mapWorkDocumentLine(raw: unknown): SaftWorkDocumentLine {
  const r = obj(raw);
  return {
    lineNumber: num(r.lineNumber),
    orderReferences: r.orderReferences
      ? ensureArray(r.orderReferences).map(mapDocumentReference)
      : undefined,
    productCode: str(r.productCode),
    productDescription: str(r.productDescription) || undefined,
    quantity: num(r.quantity),
    unitOfMeasure: str(r.unitOfMeasure),
    unitPrice: num(r.unitPrice),
    description: str(r.description),
    creditAmount: r.creditAmount !== undefined ? num(r.creditAmount) : undefined,
    debitAmount: r.debitAmount !== undefined ? num(r.debitAmount) : undefined,
    tax: mapLineTax(r.tax),
    taxExemptionReason: str(r.taxExemptionReason) || undefined,
    taxExemptionCode: str(r.taxExemptionCode) || undefined,
    settlementAmount: r.settlementAmount !== undefined
      ? num(r.settlementAmount)
      : undefined,
  };
}

function mapWorkDocument(raw: unknown): SaftWorkDocument {
  const r = obj(raw);
  return {
    documentNumber: str(r.documentNumber),
    atcud: str(r.aTCUD),
    documentStatus: mapWorkDocumentStatus(r.documentStatus),
    hash: str(r.hash),
    hashControl: str(r.hashControl),
    period: str(r.period) || undefined,
    workDate: str(r.workDate),
    workType: str(r.workType),
    sourceID: str(r.sourceID),
    eacCode: str(r.eACCode) || undefined,
    systemEntryDate: str(r.systemEntryDate),
    transactionID: str(r.transactionID) || undefined,
    customerID: str(r.customerID),
    lines: ensureArray(r.line).map(mapWorkDocumentLine),
    documentTotals: mapDocumentTotals(r.documentTotals),
  };
}

function mapWorkingDocuments(raw: unknown): SaftWorkingDocuments {
  const r = obj(raw);
  return {
    numberOfEntries: num(r.numberOfEntries),
    totalDebit: num(r.totalDebit),
    totalCredit: num(r.totalCredit),
    workDocuments: ensureArray(r.workDocument).map(mapWorkDocument),
  };
}

function mapSourceDocuments(raw: unknown): SaftSourceDocuments {
  const r = obj(raw);
  return {
    salesInvoices: r.salesInvoices
      ? mapSalesInvoices(r.salesInvoices)
      : undefined,
    movementOfGoods: r.movementOfGoods
      ? mapMovementOfGoods(r.movementOfGoods)
      : undefined,
    workingDocuments: r.workingDocuments
      ? mapWorkingDocuments(r.workingDocuments)
      : undefined,
    payments: r.payments ? mapPayments(r.payments) : undefined,
  };
}

function mapMasterFiles(raw: unknown): SaftMasterFiles {
  const r = obj(raw);
  return {
    generalLedgerAccounts: ensureArray(r.account).map(mapGLAccount),
    customers: ensureArray(r.customer).map(mapCustomer),
    suppliers: ensureArray(r.supplier).map(mapSupplier),
    products: ensureArray(r.product).map(mapProduct),
    taxTable: r.taxTable
      ? ensureArray(obj(r.taxTable).taxTableEntry).map(mapTaxTableEntry)
      : [],
  };
}

function mapToSaftFile(root: Raw): SaftFile {
  return {
    header: mapHeader(root.header),
    masterFiles: mapMasterFiles(root.masterFiles),
    generalLedgerEntries: root.generalLedgerEntries
      ? mapGeneralLedgerEntries(root.generalLedgerEntries)
      : undefined,
    sourceDocuments: mapSourceDocuments(root.sourceDocuments),
  };
}
