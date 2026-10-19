import type { ValidationError } from "../types/errors";
import type { SaftFile } from "../types/saft";

function issue(
  code: string,
  severity: ValidationError["severity"],
  message: string,
  explanation: string,
  path: string,
  documentId?: string,
): ValidationError {
  return { code, severity, message, explanation, path, section: documentId ? "SalesInvoices" : "Header", documentId, autoFixable: false };
}

export function validateAccountingBasis(saftData: SaftFile): ValidationError[] {
  const basis = saftData.header.taxAccountingBasis;
  if (basis !== "E" && basis !== "S") return [];

  const errors: ValidationError[] = [];
  if (basis === "E") {
    const comment = saftData.header.headerComment?.trim();
    const explanation = "Em ficheiros E, HeaderComment deve identificar o efetivo emitente (NIF e nome) e o local das bases de dados. O nome e a localização exigem confirmação manual, pois este campo é texto livre.";
    if (!comment) {
      errors.push(issue("BASIS_E_001", "error", "Faturação por terceiros: HeaderComment em falta.", explanation, "Header.HeaderComment"));
    } else {
      if (!/(?<!\d)\d{9}(?!\d)/.test(comment)) {
        errors.push(issue("BASIS_E_002", "warning", "Faturação por terceiros: não foi identificado um NIF de 9 dígitos em HeaderComment.", explanation, "Header.HeaderComment"));
      }
      errors.push(issue("BASIS_E_003", "info", "Confirme o nome do emitente e o local das bases de dados em HeaderComment.", explanation, "Header.HeaderComment"));
    }
  }

  const customers = new Map(saftData.masterFiles.customers.map((customer) => [customer.customerID, customer]));
  const checkedCustomers = new Set<string>();
  for (const invoice of saftData.sourceDocuments.salesInvoices?.invoices ?? []) {
    const path = `SourceDocuments.SalesInvoices.Invoice[${invoice.invoiceNo}]`;
    if (basis === "E") {
      if (invoice.specialRegimes?.thirdPartiesBillingIndicator !== "1") {
        errors.push(issue("BASIS_E_004", "error", `Fatura '${invoice.invoiceNo}': ThirdPartiesBillingIndicator deve ser 1 num ficheiro E.`, "Os documentos emitidos em nome e por conta de terceiros devem estar identificados nos regimes especiais.", `${path}.SpecialRegimes.ThirdPartiesBillingIndicator`, invoice.invoiceNo));
      }
      continue;
    }

    // Cancelled self-billed documents retain their cancellation status.
    if (!["S", "A"].includes(invoice.documentStatus.invoiceStatus)) {
      errors.push(issue("BASIS_S_001", "error", `Fatura '${invoice.invoiceNo}': InvoiceStatus deve ser S num ficheiro de autofaturação.`, "Os documentos de autofaturação usam o estado S; os documentos anulados mantêm o estado A.", `${path}.DocumentStatus.InvoiceStatus`, invoice.invoiceNo));
    }
    if (invoice.specialRegimes?.selfBillingIndicator !== "1") {
      errors.push(issue("BASIS_S_002", "error", `Fatura '${invoice.invoiceNo}': SelfBillingIndicator deve ser 1 num ficheiro S.`, "O regime especial de autofaturação deve estar identificado em cada documento, incluindo os anulados.", `${path}.SpecialRegimes.SelfBillingIndicator`, invoice.invoiceNo));
    }

    const customer = customers.get(invoice.customerID);
    // Missing customer references are reported by the existing invoice validators.
    if (!customer || checkedCustomers.has(customer.customerID)) continue;
    checkedCustomers.add(customer.customerID);
    if (customer.selfBillingIndicator !== "1") {
      errors.push(issue("BASIS_S_003", "error", `Cliente '${customer.customerID}': acordo de autofaturação não assinalado.`, "No ficheiro S, o cliente é o emitente das autofaturas e Customer.SelfBillingIndicator deve indicar a existência de acordo de autofaturação.", `MasterFiles.Customer[${customer.customerID}].SelfBillingIndicator`, invoice.invoiceNo));
    }
    if (customer.customerTaxID === saftData.header.taxRegistrationNumber) {
      errors.push(issue("BASIS_S_004", "error", `Cliente '${customer.customerID}': o NIF do emitente coincide com o NIF do fornecedor no cabeçalho.`, "No ficheiro S, o cabeçalho identifica o fornecedor e a tabela de clientes identifica o adquirente que emite as autofaturas.", `MasterFiles.Customer[${customer.customerID}].CustomerTaxID`, invoice.invoiceNo));
    }
  }

  return errors;
}
