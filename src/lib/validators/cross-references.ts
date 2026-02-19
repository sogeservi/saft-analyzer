import type { ValidationError } from "../types/errors";
import type { SaftFile } from "../types/saft";

function e(
  code: string, severity: "critical" | "error" | "warning" | "info",
  message: string, path: string, docId?: string,
): ValidationError {
  return { code, severity, message, explanation: message, path, section: "CrossReferences", documentId: docId, autoFixable: false };
}

export function validateCrossReferences(saftData: SaftFile): ValidationError[] {
  const errors: ValidationError[] = [];

  const customerIds = new Set(saftData.masterFiles.customers.map((c) => c.customerID));
  const supplierIds = new Set(saftData.masterFiles.suppliers.map((s) => s.supplierID));
  const productCodes = new Set(saftData.masterFiles.products.map((p) => p.productCode));
  const taxCombos = new Set(
    saftData.masterFiles.taxTable.map((t) => `${t.taxType}|${t.taxCountryRegion}|${t.taxCode}`),
  );
  const accountIds = new Set(
    saftData.masterFiles.generalLedgerAccounts.map((a) => a.accountID),
  );
  const invoiceNos = new Set(
    (saftData.sourceDocuments.salesInvoices?.invoices ?? []).map((i) => i.invoiceNo),
  );

  const referencedCustomers = new Set<string>();
  const referencedSuppliers = new Set<string>();
  const referencedProducts = new Set<string>();

  // Check SalesInvoices references
  for (const inv of saftData.sourceDocuments.salesInvoices?.invoices ?? []) {
    referencedCustomers.add(inv.customerID);
    // XREF_001
    if (inv.customerID && !customerIds.has(inv.customerID)) {
      errors.push(e("XREF_001", "error",
        `CustomerID '${inv.customerID}' na fatura '${inv.invoiceNo}' não existe nos MasterFiles.`,
        `SalesInvoices.Invoice[${inv.invoiceNo}].CustomerID`, inv.invoiceNo));
    }
    for (const line of inv.lines) {
      referencedProducts.add(line.productCode);
      // XREF_003
      if (line.productCode && !productCodes.has(line.productCode)) {
        errors.push(e("XREF_003", "error",
          `ProductCode '${line.productCode}' na fatura '${inv.invoiceNo}' não existe nos MasterFiles.`,
          `SalesInvoices.Invoice[${inv.invoiceNo}].Line[${line.lineNumber}].ProductCode`, inv.invoiceNo));
      }
      // XREF_004
      if (line.tax) {
        const combo = `${line.tax.taxType}|${line.tax.taxCountryRegion}|${line.tax.taxCode}`;
        if (!taxCombos.has(combo)) {
          errors.push(e("XREF_004", "error",
            `Combinação fiscal '${combo}' na fatura '${inv.invoiceNo}' não existe na TaxTable.`,
            `SalesInvoices.Invoice[${inv.invoiceNo}].Line[${line.lineNumber}].Tax`, inv.invoiceNo));
        }
      }
    }
    // XREF_006: NC/ND references
    if ((inv.invoiceType === "NC" || inv.invoiceType === "ND") && inv.lines.length > 0) {
      for (const line of inv.lines) {
        if (line.references) {
          for (const ref of line.references) {
            if (ref.reference && !invoiceNos.has(ref.reference)) {
              errors.push(e("XREF_006", "warning",
                `Referência '${ref.reference}' na ${inv.invoiceType} '${inv.invoiceNo}' não existe em SalesInvoices.`,
                `SalesInvoices.Invoice[${inv.invoiceNo}].Line[${line.lineNumber}].References`, inv.invoiceNo));
            }
          }
        }
      }
    }
  }

  // Check Payments references
  for (const pay of saftData.sourceDocuments.payments?.payments ?? []) {
    referencedCustomers.add(pay.customerID);
    if (pay.customerID && !customerIds.has(pay.customerID)) {
      errors.push(e("XREF_001", "error",
        `CustomerID '${pay.customerID}' no recibo '${pay.paymentRefNo}' não existe nos MasterFiles.`,
        `Payments.Payment[${pay.paymentRefNo}].CustomerID`, pay.paymentRefNo));
    }
  }

  // Check MovementOfGoods references
  for (const sm of saftData.sourceDocuments.movementOfGoods?.stockMovements ?? []) {
    if (sm.customerID) referencedCustomers.add(sm.customerID);
    if (sm.supplierID) referencedSuppliers.add(sm.supplierID);
    if (sm.customerID && !customerIds.has(sm.customerID)) {
      errors.push(e("XREF_001", "error",
        `CustomerID '${sm.customerID}' no movimento '${sm.documentNumber}' não existe nos MasterFiles.`,
        `MovementOfGoods.StockMovement[${sm.documentNumber}].CustomerID`, sm.documentNumber));
    }
    if (sm.supplierID && !supplierIds.has(sm.supplierID)) {
      errors.push(e("XREF_002", "error",
        `SupplierID '${sm.supplierID}' no movimento '${sm.documentNumber}' não existe nos MasterFiles.`,
        `MovementOfGoods.StockMovement[${sm.documentNumber}].SupplierID`, sm.documentNumber));
    }
    for (const line of sm.lines) {
      referencedProducts.add(line.productCode);
    }
  }

  // Check WorkingDocuments references
  for (const doc of saftData.sourceDocuments.workingDocuments?.workDocuments ?? []) {
    referencedCustomers.add(doc.customerID);
    if (doc.customerID && !customerIds.has(doc.customerID)) {
      errors.push(e("XREF_001", "error",
        `CustomerID '${doc.customerID}' no documento '${doc.documentNumber}' não existe nos MasterFiles.`,
        `WorkingDocuments.WorkDocument[${doc.documentNumber}].CustomerID`, doc.documentNumber));
    }
    for (const line of doc.lines) {
      referencedProducts.add(line.productCode);
    }
  }

  // Check GL references
  if (saftData.generalLedgerEntries) {
    for (const journal of saftData.generalLedgerEntries.journals) {
      for (const tx of journal.transactions) {
        for (const dl of tx.lines.debitLines) {
          if (!accountIds.has(dl.accountID)) {
            errors.push(e("XREF_005", "error",
              `AccountID '${dl.accountID}' na transação '${tx.transactionID}' não existe nos GeneralLedgerAccounts.`,
              `GeneralLedgerEntries.Journal[${journal.journalID}].Transaction[${tx.transactionID}]`, tx.transactionID));
          }
        }
        for (const cl of tx.lines.creditLines) {
          if (!accountIds.has(cl.accountID)) {
            errors.push(e("XREF_005", "error",
              `AccountID '${cl.accountID}' na transação '${tx.transactionID}' não existe nos GeneralLedgerAccounts.`,
              `GeneralLedgerEntries.Journal[${journal.journalID}].Transaction[${tx.transactionID}]`, tx.transactionID));
          }
        }
      }
    }
  }

  // XREF_008: Orphaned master data
  for (const cust of saftData.masterFiles.customers) {
    if (!referencedCustomers.has(cust.customerID)) {
      errors.push(e("XREF_008", "info",
        `Cliente '${cust.customerID}' não é referenciado em nenhum documento.`,
        `MasterFiles.Customer[${cust.customerID}]`, cust.customerID));
    }
  }
  for (const supp of saftData.masterFiles.suppliers) {
    if (!referencedSuppliers.has(supp.supplierID)) {
      errors.push(e("XREF_008", "info",
        `Fornecedor '${supp.supplierID}' não é referenciado em nenhum documento.`,
        `MasterFiles.Supplier[${supp.supplierID}]`, supp.supplierID));
    }
  }
  for (const prod of saftData.masterFiles.products) {
    if (!referencedProducts.has(prod.productCode)) {
      errors.push(e("XREF_008", "info",
        `Produto '${prod.productCode}' não é referenciado em nenhum documento.`,
        `MasterFiles.Product[${prod.productCode}]`, prod.productCode));
    }
  }

  return errors;
}
