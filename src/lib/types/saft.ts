export interface SaftAddress {
  buildingNumber?: string;
  streetName?: string;
  addressDetail: string;
  city: string;
  postalCode: string;
  region?: string;
  country: string;
}

export interface SaftHeader {
  auditFileVersion: string;
  companyID: string;
  taxRegistrationNumber: string;
  taxAccountingBasis: string;
  companyName: string;
  businessName?: string;
  companyAddress: SaftAddress;
  fiscalYear: string;
  startDate: string;
  endDate: string;
  currencyCode: string;
  dateCreated: string;
  taxEntity: string;
  productCompanyTaxID: string;
  softwareCertificateNumber: string;
  productID: string;
  productVersion: string;
  headerComment?: string;
  telephone?: string;
  fax?: string;
  email?: string;
  website?: string;
}

export interface SaftCustomer {
  customerID: string;
  accountID: string;
  customerTaxID: string;
  companyName: string;
  contact?: string;
  billingAddress: SaftAddress;
  shipToAddress?: SaftAddress;
  telephone?: string;
  fax?: string;
  email?: string;
  website?: string;
  selfBillingIndicator: string;
}

export interface SaftSupplier {
  supplierID: string;
  accountID: string;
  supplierTaxID: string;
  companyName: string;
  contact?: string;
  billingAddress: SaftAddress;
  shipToAddress?: SaftAddress;
  telephone?: string;
  fax?: string;
  email?: string;
  website?: string;
  selfBillingIndicator: string;
}

export interface SaftProduct {
  productType: string;
  productCode: string;
  productGroup?: string;
  productDescription: string;
  productNumberCode: string;
}

export interface SaftTaxTableEntry {
  taxType: string;
  taxCountryRegion: string;
  taxCode: string;
  description?: string;
  taxExpirationDate?: string;
  taxPercentage?: number;
  taxAmount?: number;
}

export interface SaftGeneralLedgerAccount {
  accountID: string;
  accountDescription: string;
  openingDebitBalance: number;
  openingCreditBalance: number;
  closingDebitBalance: number;
  closingCreditBalance: number;
  groupingCategory?: string;
  groupingCode?: string;
  taxonomyCode?: string;
}

export interface SaftGLDebitLine {
  recordID: string;
  accountID: string;
  systemEntryDate: string;
  description: string;
  debitAmount: number;
  sourceDocumentID?: string;
}

export interface SaftGLCreditLine {
  recordID: string;
  accountID: string;
  systemEntryDate: string;
  description: string;
  creditAmount: number;
  sourceDocumentID?: string;
}

export interface SaftGLTransactionLines {
  debitLines: SaftGLDebitLine[];
  creditLines: SaftGLCreditLine[];
}

export interface SaftTransaction {
  transactionID: string;
  period: string;
  transactionDate: string;
  sourceID: string;
  description: string;
  docArchivalNumber?: string;
  transactionType: string;
  glPostingDate?: string;
  customerID?: string;
  supplierID?: string;
  systemEntryDate: string;
  lines: SaftGLTransactionLines;
}

export interface SaftJournal {
  journalID: string;
  description: string;
  transactions: SaftTransaction[];
}

export interface SaftGeneralLedgerEntries {
  numberOfEntries: number;
  totalDebit: number;
  totalCredit: number;
  journals: SaftJournal[];
}

export interface SaftLineTax {
  taxType: string;
  taxCountryRegion: string;
  taxCode: string;
  taxPercentage?: number;
  taxAmount?: number;
  taxExemptionReason?: string;
  taxExemptionCode?: string;
}

export interface SaftDocumentReference {
  reference: string;
  reason?: string;
}

export interface SaftInvoiceLine {
  lineNumber: number;
  orderReferences?: SaftDocumentReference[];
  productCode: string;
  productDescription?: string;
  quantity: number;
  unitOfMeasure: string;
  unitPrice: number;
  taxPointDate?: string;
  references?: SaftDocumentReference[];
  description: string;
  creditAmount?: number;
  debitAmount?: number;
  tax: SaftLineTax;
  taxExemptionReason?: string;
  taxExemptionCode?: string;
  settlementAmount?: number;
}

export interface SaftDocumentStatus {
  invoiceStatus: string;
  invoiceStatusDate: string;
  reason?: string;
  sourceID: string;
  sourceBilling: string;
}

export interface SaftSpecialRegimes {
  selfBillingIndicator: string;
  cashVATSchemeIndicator: string;
  thirdPartiesBillingIndicator: string;
}

export interface SaftWithholdingTax {
  withholdingTaxType?: string;
  withholdingTaxDescription?: string;
  withholdingTaxAmount: number;
}

export interface SaftCurrency {
  currencyCode: string;
  currencyAmount: number;
  exchangeRate: number;
}

export interface SaftSettlement {
  settlementDiscount?: string;
  settlementAmount?: number;
  settlementDate?: string;
  paymentTerms?: string;
}

export interface SaftDocumentTotals {
  taxPayable: number;
  netTotal: number;
  grossTotal: number;
  currency?: SaftCurrency;
  settlement?: SaftSettlement;
  withholdingTax?: SaftWithholdingTax[];
}

export interface SaftInvoice {
  invoiceNo: string;
  atcud: string;
  documentStatus: SaftDocumentStatus;
  hash: string;
  hashControl: string;
  period?: string;
  invoiceDate: string;
  invoiceType: string;
  specialRegimes: SaftSpecialRegimes;
  sourceID: string;
  eacCode?: string;
  systemEntryDate: string;
  transactionID?: string;
  customerID: string;
  shipTo?: SaftAddress;
  shipFrom?: SaftAddress;
  lines: SaftInvoiceLine[];
  documentTotals: SaftDocumentTotals;
}

export interface SaftSalesInvoices {
  numberOfEntries: number;
  totalDebit: number;
  totalCredit: number;
  invoices: SaftInvoice[];
}

export interface SaftPaymentDocumentStatus {
  paymentStatus: string;
  paymentStatusDate: string;
  reason?: string;
  sourceID: string;
  sourceBilling: string;
  sourcePayment: string;
}

export interface SaftPaymentLine {
  lineNumber: number;
  sourceDocumentID?: {
    originatingON: string;
    invoiceDate: string;
    description?: string;
  };
  creditAmount?: number;
  debitAmount?: number;
  tax?: SaftLineTax;
  taxExemptionReason?: string;
  taxExemptionCode?: string;
  settlementAmount?: number;
}

export interface SaftPaymentMethod {
  paymentMechanism: string;
  paymentAmount: number;
  paymentDate: string;
}

export interface SaftPayment {
  paymentRefNo: string;
  atcud: string;
  period?: string;
  transactionID?: string;
  transactionDate: string;
  paymentType: string;
  description?: string;
  systemID?: string;
  documentStatus: SaftPaymentDocumentStatus;
  paymentMethods: SaftPaymentMethod[];
  sourceID: string;
  systemEntryDate: string;
  customerID: string;
  lines: SaftPaymentLine[];
  documentTotals: SaftDocumentTotals;
  withholdingTax?: SaftWithholdingTax[];
}

export interface SaftPayments {
  numberOfEntries: number;
  totalDebit: number;
  totalCredit: number;
  payments: SaftPayment[];
}

export interface SaftMovementDocumentStatus {
  movementStatus: string;
  movementStatusDate: string;
  reason?: string;
  sourceID: string;
  sourceBilling: string;
}

export interface SaftShipInfo {
  deliveryID?: string;
  deliveryDate?: string;
  warehouseID?: string;
  locationID?: string;
  address?: SaftAddress;
}

export interface SaftMovementLine {
  lineNumber: number;
  productCode: string;
  productDescription?: string;
  quantity: number;
  unitOfMeasure: string;
  unitPrice: number;
  description: string;
  creditAmount?: number;
  debitAmount?: number;
  tax?: SaftLineTax;
  taxExemptionReason?: string;
  taxExemptionCode?: string;
  settlementAmount?: number;
}

export interface SaftStockMovement {
  documentNumber: string;
  atcud: string;
  documentStatus: SaftMovementDocumentStatus;
  hash: string;
  hashControl: string;
  period?: string;
  movementDate: string;
  movementType: string;
  systemEntryDate: string;
  transactionID?: string;
  customerID?: string;
  supplierID?: string;
  sourceID: string;
  eacCode?: string;
  movementComments?: string;
  shipTo?: SaftShipInfo;
  shipFrom?: SaftShipInfo;
  movementStartTime?: string;
  atDocCodeID?: string;
  lines: SaftMovementLine[];
  documentTotals: SaftDocumentTotals;
}

export interface SaftMovementOfGoods {
  numberOfMovementLines: number;
  totalQuantityIssued: number;
  stockMovements: SaftStockMovement[];
}

export interface SaftWorkDocumentStatus {
  workStatus: string;
  workStatusDate: string;
  reason?: string;
  sourceID: string;
  sourceBilling: string;
}

export interface SaftWorkDocumentLine {
  lineNumber: number;
  orderReferences?: SaftDocumentReference[];
  productCode: string;
  productDescription?: string;
  quantity: number;
  unitOfMeasure: string;
  unitPrice: number;
  description: string;
  creditAmount?: number;
  debitAmount?: number;
  tax: SaftLineTax;
  taxExemptionReason?: string;
  taxExemptionCode?: string;
  settlementAmount?: number;
}

export interface SaftWorkDocument {
  documentNumber: string;
  atcud: string;
  documentStatus: SaftWorkDocumentStatus;
  hash: string;
  hashControl: string;
  period?: string;
  workDate: string;
  workType: string;
  sourceID: string;
  eacCode?: string;
  systemEntryDate: string;
  transactionID?: string;
  customerID: string;
  lines: SaftWorkDocumentLine[];
  documentTotals: SaftDocumentTotals;
}

export interface SaftWorkingDocuments {
  numberOfEntries: number;
  totalDebit: number;
  totalCredit: number;
  workDocuments: SaftWorkDocument[];
}

export interface SaftSourceDocuments {
  salesInvoices?: SaftSalesInvoices;
  movementOfGoods?: SaftMovementOfGoods;
  workingDocuments?: SaftWorkingDocuments;
  payments?: SaftPayments;
}

export interface SaftMasterFiles {
  generalLedgerAccounts: SaftGeneralLedgerAccount[];
  customers: SaftCustomer[];
  suppliers: SaftSupplier[];
  products: SaftProduct[];
  taxTable: SaftTaxTableEntry[];
}

export interface SaftFile {
  header: SaftHeader;
  masterFiles: SaftMasterFiles;
  generalLedgerEntries?: SaftGeneralLedgerEntries;
  sourceDocuments: SaftSourceDocuments;
}
