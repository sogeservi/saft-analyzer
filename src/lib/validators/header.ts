import type { ValidationError } from "../types/errors";
import type { SaftFile } from "../types/saft";
import { isSupportedVersion } from "../parser/version-detector";
import { validatePtNif } from "./tax-id";

const VALID_TAX_ACCOUNTING_BASIS = ["C", "E", "F", "I", "P", "R", "S", "T"];
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PT_POSTAL_RE = /^\d{4}-\d{3}$/;

function err(
  code: string,
  severity: "critical" | "error" | "warning" | "info",
  message: string,
  path: string,
  extra?: Partial<ValidationError>,
): ValidationError {
  return {
    code,
    severity,
    message,
    explanation: message,
    path: `Header.${path}`,
    section: "Header",
    autoFixable: false,
    ...extra,
  };
}

export function validateHeader(saftData: SaftFile): ValidationError[] {
  const errors: ValidationError[] = [];
  const h = saftData.header;

  // HDR_001: AuditFileVersion present and valid
  if (!h.auditFileVersion) {
    errors.push(err("HDR_001", "critical", "Campo AuditFileVersion em falta.", "AuditFileVersion"));
  } else if (!isSupportedVersion(h.auditFileVersion)) {
    errors.push(err("HDR_001", "critical", `Versão '${h.auditFileVersion}' não suportada. Versões válidas: 1.01_01, 1.02_01, 1.03_01, 1.04_01.`, "AuditFileVersion"));
  }

  // HDR_002: TaxRegistrationNumber (NIF) valid
  if (!h.taxRegistrationNumber) {
    errors.push(err("HDR_002", "critical", "Campo TaxRegistrationNumber (NIF) em falta.", "TaxRegistrationNumber"));
  } else {
    const nifResult = validatePtNif(h.taxRegistrationNumber);
    if (!nifResult.valid) {
      errors.push(err("HDR_002", "critical", `NIF '${h.taxRegistrationNumber}' inválido: ${nifResult.reason}`, "TaxRegistrationNumber"));
    }
  }

  // HDR_003: CompanyID format
  if (!h.companyID) {
    errors.push(err("HDR_003", "error", "Campo CompanyID em falta.", "CompanyID"));
  } else if (h.taxRegistrationNumber && !h.companyID.includes(h.taxRegistrationNumber)) {
    errors.push(err("HDR_003", "error", `CompanyID '${h.companyID}' não contém o NIF '${h.taxRegistrationNumber}'.`, "CompanyID"));
  }

  // HDR_004: TaxAccountingBasis valid
  if (!h.taxAccountingBasis) {
    errors.push(err("HDR_004", "error", "Campo TaxAccountingBasis em falta.", "TaxAccountingBasis"));
  } else if (!VALID_TAX_ACCOUNTING_BASIS.includes(h.taxAccountingBasis)) {
    errors.push(err("HDR_004", "error", `TaxAccountingBasis '${h.taxAccountingBasis}' inválido. Valores válidos: ${VALID_TAX_ACCOUNTING_BASIS.join(", ")}.`, "TaxAccountingBasis"));
  }

  // HDR_005: FiscalYear format
  if (!h.fiscalYear) {
    errors.push(err("HDR_005", "error", "Campo FiscalYear em falta.", "FiscalYear"));
  } else if (!/^\d{4}$/.test(h.fiscalYear)) {
    errors.push(err("HDR_005", "error", `FiscalYear '${h.fiscalYear}' deve ser um ano com 4 dígitos.`, "FiscalYear"));
  }

  // HDR_006: StartDate before EndDate
  if (h.startDate && h.endDate) {
    if (!ISO_DATE_RE.test(h.startDate)) {
      errors.push(err("HDR_006", "error", `StartDate '${h.startDate}' não é uma data ISO válida.`, "StartDate"));
    }
    if (!ISO_DATE_RE.test(h.endDate)) {
      errors.push(err("HDR_006", "error", `EndDate '${h.endDate}' não é uma data ISO válida.`, "EndDate"));
    }
    if (h.startDate > h.endDate) {
      errors.push(err("HDR_006", "error", `StartDate '${h.startDate}' é posterior a EndDate '${h.endDate}'.`, "StartDate"));
    }
  }

  // HDR_007: Date period within fiscal year
  if (h.fiscalYear && /^\d{4}$/.test(h.fiscalYear)) {
    const fy = h.fiscalYear;
    if (h.startDate && !h.startDate.startsWith(fy)) {
      errors.push(err("HDR_007", "warning", `StartDate '${h.startDate}' não está dentro do ano fiscal '${fy}'.`, "StartDate"));
    }
    if (h.endDate && !h.endDate.startsWith(fy)) {
      errors.push(err("HDR_007", "warning", `EndDate '${h.endDate}' não está dentro do ano fiscal '${fy}'.`, "EndDate"));
    }
  }

  // HDR_008: DateCreated valid
  if (!h.dateCreated) {
    errors.push(err("HDR_008", "error", "Campo DateCreated em falta.", "DateCreated"));
  } else if (!ISO_DATE_RE.test(h.dateCreated)) {
    errors.push(err("HDR_008", "error", `DateCreated '${h.dateCreated}' não é uma data ISO válida.`, "DateCreated"));
  } else if (h.endDate && h.dateCreated < h.endDate) {
    errors.push(err("HDR_008", "error", `DateCreated '${h.dateCreated}' é anterior a EndDate '${h.endDate}'.`, "DateCreated"));
  }

  // HDR_009: SoftwareCertificateNumber present
  if (!h.softwareCertificateNumber || h.softwareCertificateNumber === "0") {
    errors.push(err("HDR_009", "warning", "SoftwareCertificateNumber ausente ou '0' — software não certificado pela AT.", "SoftwareCertificateNumber"));
  }

  // HDR_010: ProductID present
  if (!h.productID) {
    errors.push(err("HDR_010", "info", "Campo ProductID em falta.", "ProductID"));
  }

  // HDR_011: CurrencyCode valid
  if (!h.currencyCode) {
    errors.push(err("HDR_011", "error", "Campo CurrencyCode em falta.", "CurrencyCode"));
  } else if (h.currencyCode !== "EUR" && !/^[A-Z]{3}$/.test(h.currencyCode)) {
    errors.push(err("HDR_011", "error", `CurrencyCode '${h.currencyCode}' não é um código ISO 4217 válido.`, "CurrencyCode"));
  }

  // HDR_012: CompanyAddress completeness
  const addr = h.companyAddress;
  if (!addr.addressDetail) {
    errors.push(err("HDR_012", "error", "CompanyAddress.AddressDetail em falta.", "CompanyAddress.AddressDetail"));
  }
  if (!addr.city) {
    errors.push(err("HDR_012", "error", "CompanyAddress.City em falta.", "CompanyAddress.City"));
  }
  if (!addr.postalCode) {
    errors.push(err("HDR_012", "error", "CompanyAddress.PostalCode em falta.", "CompanyAddress.PostalCode"));
  } else if (addr.country === "PT" && !PT_POSTAL_RE.test(addr.postalCode)) {
    errors.push(err("HDR_012", "error", `PostalCode '${addr.postalCode}' não corresponde ao formato português (XXXX-XXX).`, "CompanyAddress.PostalCode"));
  }
  if (!addr.country) {
    errors.push(err("HDR_012", "error", "CompanyAddress.Country em falta.", "CompanyAddress.Country"));
  }

  // HDR_013: HeaderComment length (XSD maxLength = 255)
  if (h.headerComment && h.headerComment.length > 255) {
    errors.push(err("HDR_013", "warning", `HeaderComment excede o comprimento máximo de 255 caracteres (atual: ${h.headerComment.length}).`, "HeaderComment"));
  }

  return errors;
}

export function validatePeriodEnd(
  saftData: SaftFile,
  now = new Date(),
): ValidationError[] {
  const endDate = saftData.header.endDate;
  if (!ISO_DATE_RE.test(endDate)) return [];

  const parsedEndDate = new Date(`${endDate}T00:00:00.000Z`);
  if (
    Number.isNaN(parsedEndDate.getTime()) ||
    parsedEndDate.toISOString().slice(0, 10) !== endDate
  ) {
    return [];
  }

  const dateParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Lisbon",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    dateParts.find((datePart) => datePart.type === type)?.value ?? "";
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  if (endDate < today) return [];

  return [
    {
      code: "HDR_014",
      severity: "warning",
      message: "O período deste SAF-T termina hoje ou no futuro.",
      explanation:
        "Podem ser emitidas novas faturas durante este período após a criação do ficheiro, e essas faturas podem não estar incluídas neste SAF-T.",
      path: "Header.EndDate",
      section: "Header",
      autoFixable: false,
    },
  ];
}
