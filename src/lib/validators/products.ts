import type { ValidationError } from "../types/errors";
import type { SaftFile } from "../types/saft";

const VALID_PRODUCT_TYPES = ["P", "S", "O", "E", "I"];

export function validateProducts(saftData: SaftFile): ValidationError[] {
  const errors: ValidationError[] = [];
  const products = saftData.masterFiles.products;
  const seenCodes = new Set<string>();

  const referencedCodes = new Set<string>();
  for (const inv of saftData.sourceDocuments.salesInvoices?.invoices ?? []) {
    for (const line of inv.lines) referencedCodes.add(line.productCode);
  }
  for (const pay of saftData.sourceDocuments.payments?.payments ?? []) {
    for (const line of pay.lines) {
      if (line.sourceDocumentID) referencedCodes.add(line.sourceDocumentID.originatingON);
    }
  }
  for (const mov of saftData.sourceDocuments.movementOfGoods?.stockMovements ?? []) {
    for (const line of mov.lines) referencedCodes.add(line.productCode);
  }
  for (const wrk of saftData.sourceDocuments.workingDocuments?.workDocuments ?? []) {
    for (const line of wrk.lines) referencedCodes.add(line.productCode);
  }

  for (const prod of products) {
    const path = `MasterFiles.Product[${prod.productCode}]`;

    // PROD_001: ProductCode unique
    if (seenCodes.has(prod.productCode)) {
      errors.push({
        code: "PROD_001",
        severity: "critical",
        message: `ProductCode '${prod.productCode}' duplicado.`,
        explanation: "Cada ProductCode deve ser único no ficheiro.",
        path: `${path}.ProductCode`,
        section: "Products",
        documentId: prod.productCode,
        autoFixable: false,
      });
    }
    seenCodes.add(prod.productCode);

    // PROD_002: ProductType valid
    if (!prod.productType) {
      errors.push({
        code: "PROD_002",
        severity: "error",
        message: `ProductType em falta para o produto '${prod.productCode}'.`,
        explanation: `ProductType deve ser um de: ${VALID_PRODUCT_TYPES.join(", ")}`,
        path: `${path}.ProductType`,
        section: "Products",
        documentId: prod.productCode,
        autoFixable: false,
      });
    } else if (!VALID_PRODUCT_TYPES.includes(prod.productType)) {
      errors.push({
        code: "PROD_002",
        severity: "error",
        message: `ProductType '${prod.productType}' inválido para o produto '${prod.productCode}'.`,
        explanation: `Valores válidos: P (Produto), S (Serviço), O (Outro), E (Imposto especial), I (Imposto).`,
        path: `${path}.ProductType`,
        section: "Products",
        documentId: prod.productCode,
        autoFixable: false,
      });
    }

    // PROD_003: ProductDescription present
    if (!prod.productDescription || !prod.productDescription.trim()) {
      errors.push({
        code: "PROD_003",
        severity: "error",
        message: `ProductDescription em falta ou vazia para o produto '${prod.productCode}'.`,
        explanation: "O campo ProductDescription é obrigatório e não pode estar vazio.",
        path: `${path}.ProductDescription`,
        section: "Products",
        documentId: prod.productCode,
        autoFixable: false,
      });
    }

    // PROD_004: ProductNumberCode present
    if (!prod.productNumberCode) {
      errors.push({
        code: "PROD_004",
        severity: "warning",
        message: `ProductNumberCode em falta para o produto '${prod.productCode}'.`,
        explanation: "O ProductNumberCode deve estar presente. Se for EAN/GTIN, o dígito de controlo deve ser válido.",
        path: `${path}.ProductNumberCode`,
        section: "Products",
        documentId: prod.productCode,
        autoFixable: false,
      });
    }

    // PROD_005: Product with no references
    if (!referencedCodes.has(prod.productCode)) {
      errors.push({
        code: "PROD_005",
        severity: "info",
        message: `Produto '${prod.productCode}' não é referenciado em nenhum documento.`,
        explanation: "O produto existe nos MasterFiles mas não aparece em nenhuma linha de documento.",
        path: `${path}`,
        section: "Products",
        documentId: prod.productCode,
        autoFixable: false,
      });
    }

    // PROD_006: ProductGroup consistency
    if (prod.productGroup) {
      const sameCodeDiffGroup = products.filter(
        (p) =>
          p.productCode === prod.productCode &&
          p.productGroup &&
          p.productGroup !== prod.productGroup,
      );
      if (sameCodeDiffGroup.length > 0) {
        errors.push({
          code: "PROD_006",
          severity: "warning",
          message: `Produto '${prod.productCode}' aparece em grupos diferentes.`,
          explanation: "O mesmo produto não deve pertencer a grupos conflitantes.",
          path: `${path}.ProductGroup`,
          section: "Products",
          documentId: prod.productCode,
          autoFixable: false,
        });
      }
    }
  }

  return errors;
}
