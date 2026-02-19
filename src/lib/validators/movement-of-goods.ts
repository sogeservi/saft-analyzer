import type { ValidationError } from "../types/errors";
import type { SaftFile } from "../types/saft";

const VALID_MOVEMENT_TYPES = ["GR", "GT", "GA", "GC", "GD"];
const VALID_MOVEMENT_STATUSES = ["N", "T", "A", "F"];
const ATCUD_RE = /^[A-Z0-9]{8,}-[0-9]+$/;

function e(
  code: string, severity: "critical" | "error" | "warning" | "info",
  message: string, path: string, docId?: string,
): ValidationError {
  return { code, severity, message, explanation: message, path, section: "MovementOfGoods", documentId: docId, autoFixable: false };
}

export function validateMovementOfGoods(saftData: SaftFile): ValidationError[] {
  const errors: ValidationError[] = [];
  const mov = saftData.sourceDocuments.movementOfGoods;
  if (!mov) return errors;

  const base = "SourceDocuments.MovementOfGoods";
  const productCodes = new Set(saftData.masterFiles.products.map((p) => p.productCode));
  const customerIds = new Set(saftData.masterFiles.customers.map((c) => c.customerID));
  const supplierIds = new Set(saftData.masterFiles.suppliers.map((s) => s.supplierID));
  const docNumbers = new Set<string>();

  // MOV_001
  if (mov.numberOfMovementLines !== mov.stockMovements.length) {
    errors.push(e("MOV_001", "error",
      `NumberOfMovementLines declarado (${mov.numberOfMovementLines}) difere do real (${mov.stockMovements.length}).`,
      `${base}.NumberOfMovementLines`));
  }

  // MOV_002
  let totalQty = 0;
  for (const sm of mov.stockMovements) {
    if (sm.documentStatus.movementStatus === "A") continue;
    for (const l of sm.lines) totalQty += l.quantity;
  }
  if (Math.abs(mov.totalQuantityIssued - totalQty) > 0.01) {
    errors.push(e("MOV_002", "error",
      `TotalQuantityIssued declarado (${mov.totalQuantityIssued}) difere da soma (${totalQty.toFixed(2)}).`,
      `${base}.TotalQuantityIssued`));
  }

  for (const sm of mov.stockMovements) {
    const sp = `${base}.StockMovement[${sm.documentNumber}]`;

    // MOV_003
    if (!sm.documentNumber) {
      errors.push(e("MOV_003", "critical", "DocumentNumber em falta.", sp));
      continue;
    }

    // MOV_014
    if (docNumbers.has(sm.documentNumber)) {
      errors.push(e("MOV_014", "error", `DocumentNumber '${sm.documentNumber}' duplicado.`, `${sp}.DocumentNumber`, sm.documentNumber));
    }
    docNumbers.add(sm.documentNumber);

    // MOV_004
    if (!VALID_MOVEMENT_TYPES.includes(sm.movementType)) {
      errors.push(e("MOV_004", "error",
        `MovementType '${sm.movementType}' inválido. Valores válidos: ${VALID_MOVEMENT_TYPES.join(", ")}.`,
        `${sp}.MovementType`, sm.documentNumber));
    }

    // MOV_005
    if (sm.movementDate) {
      const h = saftData.header;
      if (h.startDate && sm.movementDate < h.startDate) {
        errors.push(e("MOV_005", "error", `MovementDate '${sm.movementDate}' anterior a StartDate.`, `${sp}.MovementDate`, sm.documentNumber));
      }
      if (h.endDate && sm.movementDate > h.endDate) {
        errors.push(e("MOV_005", "error", `MovementDate '${sm.movementDate}' posterior a EndDate.`, `${sp}.MovementDate`, sm.documentNumber));
      }
    }

    // MOV_006
    if (!sm.atcud) {
      errors.push(e("MOV_006", "critical", `ATCUD em falta no movimento '${sm.documentNumber}'.`, `${sp}.ATCUD`, sm.documentNumber));
    } else if (!ATCUD_RE.test(sm.atcud)) {
      errors.push(e("MOV_006", "critical", `ATCUD '${sm.atcud}' com formato inválido.`, `${sp}.ATCUD`, sm.documentNumber));
    }

    // MOV_007
    if (!VALID_MOVEMENT_STATUSES.includes(sm.documentStatus.movementStatus)) {
      errors.push(e("MOV_007", "error",
        `MovementStatus '${sm.documentStatus.movementStatus}' inválido.`,
        `${sp}.DocumentStatus.MovementStatus`, sm.documentNumber));
    }

    // MOV_008
    if (!sm.shipFrom && !sm.shipTo) {
      errors.push(e("MOV_008", "error",
        `Movimento '${sm.documentNumber}' sem ShipFrom/ShipTo.`,
        sp, sm.documentNumber));
    }

    // MOV_009
    if (sm.movementType === "GT" && !sm.movementStartTime) {
      errors.push(e("MOV_009", "warning",
        `Guia de transporte '${sm.documentNumber}' sem MovementStartTime.`,
        `${sp}.MovementStartTime`, sm.documentNumber));
    }

    if (sm.lines.length === 0) {
      errors.push(e("MOV_010", "error", `Movimento '${sm.documentNumber}' sem linhas.`, sp, sm.documentNumber));
    }

    for (const l of sm.lines) {
      // MOV_010
      if (l.quantity <= 0) {
        errors.push(e("MOV_010", "error",
          `Quantidade <= 0 (${l.quantity}) na linha ${l.lineNumber} do movimento '${sm.documentNumber}'.`,
          `${sp}.Line[${l.lineNumber}].Quantity`, sm.documentNumber));
      }

      // MOV_011
      if (l.productCode && !productCodes.has(l.productCode)) {
        errors.push(e("MOV_011", "error",
          `ProductCode '${l.productCode}' não existe nos MasterFiles.`,
          `${sp}.Line[${l.lineNumber}].ProductCode`, sm.documentNumber));
      }
    }

    // MOV_012
    if (sm.customerID && !customerIds.has(sm.customerID)) {
      errors.push(e("MOV_012", "error",
        `CustomerID '${sm.customerID}' não existe nos MasterFiles.`,
        `${sp}.CustomerID`, sm.documentNumber));
    }
    if (sm.supplierID && !supplierIds.has(sm.supplierID)) {
      errors.push(e("MOV_012", "error",
        `SupplierID '${sm.supplierID}' não existe nos MasterFiles.`,
        `${sp}.SupplierID`, sm.documentNumber));
    }
  }

  return errors;
}
