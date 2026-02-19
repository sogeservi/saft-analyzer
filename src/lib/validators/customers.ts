import type { ValidationError } from "../types/errors";
import type { SaftFile } from "../types/saft";
import { validatePtNif, isEuCountry } from "./tax-id";

const ISO_COUNTRIES_RE = /^[A-Z]{2}$/;
const GENERIC_CONSUMER_NIF = "999999990";

export function validateCustomers(saftData: SaftFile): ValidationError[] {
  const errors: ValidationError[] = [];
  const customers = saftData.masterFiles.customers;
  const seenIds = new Set<string>();

  const referencedCustomerIds = new Set<string>();
  for (const inv of saftData.sourceDocuments.salesInvoices?.invoices ?? []) {
    referencedCustomerIds.add(inv.customerID);
  }
  for (const pay of saftData.sourceDocuments.payments?.payments ?? []) {
    referencedCustomerIds.add(pay.customerID);
  }
  for (const mov of saftData.sourceDocuments.movementOfGoods?.stockMovements ?? []) {
    if (mov.customerID) referencedCustomerIds.add(mov.customerID);
  }
  for (const wrk of saftData.sourceDocuments.workingDocuments?.workDocuments ?? []) {
    referencedCustomerIds.add(wrk.customerID);
  }

  for (const cust of customers) {
    const path = `MasterFiles.Customer[${cust.customerID}]`;

    // CUST_001: CustomerID unique
    if (seenIds.has(cust.customerID)) {
      errors.push({
        code: "CUST_001",
        severity: "critical",
        message: `CustomerID '${cust.customerID}' duplicado.`,
        explanation: "Cada CustomerID deve ser único no ficheiro. IDs duplicados causam referências ambíguas.",
        path: `${path}.CustomerID`,
        section: "Customers",
        documentId: cust.customerID,
        autoFixable: false,
      });
    }
    seenIds.add(cust.customerID);

    // CUST_002: CustomerTaxID present
    if (!cust.customerTaxID) {
      errors.push({
        code: "CUST_002",
        severity: "critical",
        message: `CustomerTaxID em falta para o cliente '${cust.customerID}'.`,
        explanation: "O campo CustomerTaxID é obrigatório.",
        path: `${path}.CustomerTaxID`,
        section: "Customers",
        documentId: cust.customerID,
        autoFixable: false,
      });
      continue;
    }

    const country = cust.billingAddress.country;

    // CUST_003: Portuguese NIF check digit
    if (country === "PT" && cust.customerTaxID !== GENERIC_CONSUMER_NIF) {
      const nifResult = validatePtNif(cust.customerTaxID);
      if (!nifResult.valid) {
        errors.push({
          code: "CUST_003",
          severity: "error",
          message: `NIF '${cust.customerTaxID}' do cliente '${cust.customerID}' inválido: ${nifResult.reason}`,
          explanation: "O NIF português deve passar na validação Módulo 11.",
          path: `${path}.CustomerTaxID`,
          section: "Customers",
          documentId: cust.customerID,
          autoFixable: false,
        });
      }
    }

    // CUST_004: EU VAT prefix required
    if (isEuCountry(country) && country !== "PT") {
      if (!cust.customerTaxID.startsWith(country)) {
        errors.push({
          code: "CUST_004",
          severity: "error",
          message: `NIF '${cust.customerTaxID}' do cliente '${cust.customerID}' (${country}) não contém o prefixo '${country}'.`,
          explanation: "NIFs de clientes da UE (exceto PT) devem ter o prefixo do país de 2 letras.",
          path: `${path}.CustomerTaxID`,
          section: "Customers",
          documentId: cust.customerID,
          suggestedFix: `Adicionar prefixo '${country}' → '${country}${cust.customerTaxID}'`,
          autoFixable: true,
          originalValue: cust.customerTaxID,
        });
      }
    }

    // CUST_006: Non-EU customer tax ID
    if (country && !isEuCountry(country)) {
      errors.push({
        code: "CUST_006",
        severity: "warning",
        message: `Cliente '${cust.customerID}' com país '${country}' fora da UE — NIF não validável automaticamente.`,
        explanation: "Para países fora da UE, o formato do NIF não pode ser validado. Verificação manual recomendada.",
        path: `${path}.CustomerTaxID`,
        section: "Customers",
        documentId: cust.customerID,
        autoFixable: false,
      });
    }

    // CUST_008: SelfBillingIndicator consistency
    if (cust.selfBillingIndicator === "1") {
      const hasFS = (saftData.sourceDocuments.salesInvoices?.invoices ?? []).some(
        (inv) => inv.customerID === cust.customerID && inv.invoiceType === "FS",
      );
      if (!hasFS) {
        errors.push({
          code: "CUST_008",
          severity: "error",
          message: `Cliente '${cust.customerID}' tem SelfBillingIndicator=1 mas não existem faturas simplificadas (FS) associadas.`,
          explanation: "Se SelfBillingIndicator é 1, devem existir autofaturas correspondentes.",
          path: `${path}.SelfBillingIndicator`,
          section: "Customers",
          documentId: cust.customerID,
          autoFixable: false,
        });
      }
    }

    // CUST_009: BillingAddress completeness
    const addr = cust.billingAddress;
    if (!addr.addressDetail || !addr.city || !addr.postalCode || !addr.country) {
      errors.push({
        code: "CUST_009",
        severity: "warning",
        message: `Morada de faturação incompleta para o cliente '${cust.customerID}'.`,
        explanation: "BillingAddress deve conter AddressDetail, City, PostalCode e Country.",
        path: `${path}.BillingAddress`,
        section: "Customers",
        documentId: cust.customerID,
        autoFixable: false,
      });
    }

    // CUST_010: Country code ISO 3166
    if (addr.country && !ISO_COUNTRIES_RE.test(addr.country)) {
      errors.push({
        code: "CUST_010",
        severity: "warning",
        message: `Código de país '${addr.country}' do cliente '${cust.customerID}' não é um código ISO 3166-1 alpha-2 válido.`,
        explanation: "O código de país deve ser exatamente 2 letras maiúsculas (ex: PT, ES, DE).",
        path: `${path}.BillingAddress.Country`,
        section: "Customers",
        documentId: cust.customerID,
        autoFixable: false,
      });
    }

    // CUST_011: Customer with no invoices
    if (!referencedCustomerIds.has(cust.customerID)) {
      errors.push({
        code: "CUST_011",
        severity: "info",
        message: `Cliente '${cust.customerID}' não é referenciado em nenhum documento.`,
        explanation: "O cliente existe nos MasterFiles mas não aparece em nenhuma secção de SourceDocuments.",
        path: `${path}`,
        section: "Customers",
        documentId: cust.customerID,
        autoFixable: false,
      });
    }
  }

  return errors;
}
