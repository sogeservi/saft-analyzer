import type { ValidationError } from "../types/errors";
import type { SaftFile } from "../types/saft";
import { validatePtNif, isEuCountry } from "./tax-id";

export function validateSuppliers(saftData: SaftFile): ValidationError[] {
  const errors: ValidationError[] = [];
  const suppliers = saftData.masterFiles.suppliers;
  const seenIds = new Set<string>();

  const referencedIds = new Set<string>();
  for (const mov of saftData.sourceDocuments.movementOfGoods?.stockMovements ?? []) {
    if (mov.supplierID) referencedIds.add(mov.supplierID);
  }

  for (const supp of suppliers) {
    const path = `MasterFiles.Supplier[${supp.supplierID}]`;

    // SUPP_001: SupplierID unique
    if (seenIds.has(supp.supplierID)) {
      errors.push({
        code: "SUPP_001",
        severity: "critical",
        message: `SupplierID '${supp.supplierID}' duplicado.`,
        explanation: "Cada SupplierID deve ser único no ficheiro.",
        path: `${path}.SupplierID`,
        section: "Suppliers",
        documentId: supp.supplierID,
        autoFixable: false,
      });
    }
    seenIds.add(supp.supplierID);

    // SUPP_002: SupplierTaxID present
    if (!supp.supplierTaxID) {
      errors.push({
        code: "SUPP_002",
        severity: "critical",
        message: `SupplierTaxID em falta para o fornecedor '${supp.supplierID}'.`,
        explanation: "O campo SupplierTaxID é obrigatório.",
        path: `${path}.SupplierTaxID`,
        section: "Suppliers",
        documentId: supp.supplierID,
        autoFixable: false,
      });
      continue;
    }

    const country = supp.billingAddress.country;

    // SUPP_003: Portuguese NIF check digit
    if (country === "PT") {
      const nifResult = validatePtNif(supp.supplierTaxID);
      if (!nifResult.valid) {
        errors.push({
          code: "SUPP_003",
          severity: "error",
          message: `NIF '${supp.supplierTaxID}' do fornecedor '${supp.supplierID}' inválido: ${nifResult.reason}`,
          explanation: "O NIF português deve passar na validação Módulo 11.",
          path: `${path}.SupplierTaxID`,
          section: "Suppliers",
          documentId: supp.supplierID,
          autoFixable: false,
        });
      }
    }

    // SUPP_004: EU VAT prefix required
    if (isEuCountry(country) && country !== "PT") {
      if (!supp.supplierTaxID.startsWith(country)) {
        errors.push({
          code: "SUPP_004",
          severity: "error",
          message: `NIF '${supp.supplierTaxID}' do fornecedor '${supp.supplierID}' (${country}) não contém o prefixo '${country}'.`,
          explanation: "NIFs de fornecedores da UE (exceto PT) devem ter o prefixo do país.",
          path: `${path}.SupplierTaxID`,
          section: "Suppliers",
          documentId: supp.supplierID,
          suggestedFix: `Adicionar prefixo '${country}' → '${country}${supp.supplierTaxID}'`,
          autoFixable: true,
          originalValue: supp.supplierTaxID,
        });
      }
    }

    // SUPP_006: BillingAddress completeness
    const addr = supp.billingAddress;
    if (!addr.addressDetail || !addr.city || !addr.postalCode || !addr.country) {
      errors.push({
        code: "SUPP_006",
        severity: "warning",
        message: `Morada de faturação incompleta para o fornecedor '${supp.supplierID}'.`,
        explanation: "BillingAddress deve conter AddressDetail, City, PostalCode e Country.",
        path: `${path}.BillingAddress`,
        section: "Suppliers",
        documentId: supp.supplierID,
        autoFixable: false,
      });
    }

    // SUPP_007: Supplier with no references
    if (!referencedIds.has(supp.supplierID)) {
      errors.push({
        code: "SUPP_007",
        severity: "info",
        message: `Fornecedor '${supp.supplierID}' não é referenciado em nenhum documento.`,
        explanation: "O fornecedor existe nos MasterFiles mas não aparece em nenhum movimento.",
        path: `${path}`,
        section: "Suppliers",
        documentId: supp.supplierID,
        autoFixable: false,
      });
    }
  }

  return errors;
}
