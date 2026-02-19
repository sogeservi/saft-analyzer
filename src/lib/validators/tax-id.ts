import type { ValidationError } from "../types/errors";
import type { SaftFile } from "../types/saft";

const EU_COUNTRIES = new Set([
  "AT","BE","BG","CY","CZ","DE","DK","EE","EL","ES","FI","FR",
  "HR","HU","IE","IT","LT","LU","LV","MT","NL","PL","PT","RO",
  "SE","SI","SK",
]);

export { EU_COUNTRIES };

export function isEuCountry(country: string): boolean {
  return EU_COUNTRIES.has(country);
}

export function validatePtNif(nif: string): { valid: boolean; reason?: string } {
  if (!/^\d{9}$/.test(nif)) {
    return { valid: false, reason: "NIF deve ter exatamente 9 dígitos" };
  }

  const weights = [9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    sum += parseInt(nif[i], 10) * weights[i];
  }
  let checkDigit = 11 - (sum % 11);
  if (checkDigit >= 10) checkDigit = 0;

  if (parseInt(nif[8], 10) !== checkDigit) {
    return { valid: false, reason: `Dígito de controlo inválido (esperado: ${checkDigit})` };
  }

  return { valid: true };
}

interface VatFormatSpec {
  country: string;
  prefix: string;
  pattern: RegExp;
  description: string;
}

const VAT_FORMATS: VatFormatSpec[] = [
  { country: "AT", prefix: "ATU", pattern: /^ATU\d{8}$/, description: "ATU + 8 dígitos" },
  { country: "BE", prefix: "BE", pattern: /^BE[01]\d{9}$/, description: "BE + 10 dígitos (início 0 ou 1)" },
  { country: "BG", prefix: "BG", pattern: /^BG\d{9,10}$/, description: "BG + 9 ou 10 dígitos" },
  { country: "CY", prefix: "CY", pattern: /^CY\d{8}[A-Z]$/, description: "CY + 8 dígitos + 1 letra" },
  { country: "CZ", prefix: "CZ", pattern: /^CZ\d{8,10}$/, description: "CZ + 8, 9 ou 10 dígitos" },
  { country: "DE", prefix: "DE", pattern: /^DE\d{9}$/, description: "DE + 9 dígitos" },
  { country: "DK", prefix: "DK", pattern: /^DK\d{8}$/, description: "DK + 8 dígitos" },
  { country: "EE", prefix: "EE", pattern: /^EE\d{9}$/, description: "EE + 9 dígitos" },
  { country: "EL", prefix: "EL", pattern: /^EL\d{9}$/, description: "EL + 9 dígitos" },
  { country: "ES", prefix: "ES", pattern: /^ES[A-Z0-9]\d{7}[A-Z0-9]$/, description: "ES + letra/dígito + 7 dígitos + letra/dígito" },
  { country: "FI", prefix: "FI", pattern: /^FI\d{8}$/, description: "FI + 8 dígitos" },
  { country: "FR", prefix: "FR", pattern: /^FR[A-Z0-9]{2}\d{9}$/, description: "FR + 2 caracteres + 9 dígitos" },
  { country: "HR", prefix: "HR", pattern: /^HR\d{11}$/, description: "HR + 11 dígitos" },
  { country: "HU", prefix: "HU", pattern: /^HU\d{8}$/, description: "HU + 8 dígitos" },
  { country: "IE", prefix: "IE", pattern: /^IE[A-Z0-9]{8,9}$/, description: "IE + 8 ou 9 caracteres" },
  { country: "IT", prefix: "IT", pattern: /^IT\d{11}$/, description: "IT + 11 dígitos" },
  { country: "LT", prefix: "LT", pattern: /^LT(\d{9}|\d{12})$/, description: "LT + 9 ou 12 dígitos" },
  { country: "LU", prefix: "LU", pattern: /^LU\d{8}$/, description: "LU + 8 dígitos" },
  { country: "LV", prefix: "LV", pattern: /^LV\d{11}$/, description: "LV + 11 dígitos" },
  { country: "MT", prefix: "MT", pattern: /^MT\d{8}$/, description: "MT + 8 dígitos" },
  { country: "NL", prefix: "NL", pattern: /^NL\d{9}B\d{2}$/, description: "NL + 9 dígitos + B + 2 dígitos" },
  { country: "PL", prefix: "PL", pattern: /^PL\d{10}$/, description: "PL + 10 dígitos" },
  { country: "PT", prefix: "PT", pattern: /^PT\d{9}$/, description: "PT + 9 dígitos" },
  { country: "RO", prefix: "RO", pattern: /^RO\d{2,10}$/, description: "RO + 2 a 10 dígitos" },
  { country: "SE", prefix: "SE", pattern: /^SE\d{12}$/, description: "SE + 12 dígitos" },
  { country: "SI", prefix: "SI", pattern: /^SI\d{8}$/, description: "SI + 8 dígitos" },
  { country: "SK", prefix: "SK", pattern: /^SK\d{10}$/, description: "SK + 10 dígitos" },
];

const VAT_FORMAT_MAP = new Map(VAT_FORMATS.map((f) => [f.country, f]));

const TID_CODES: Record<string, string> = {
  AT: "TID_001", BE: "TID_002", BG: "TID_003", CY: "TID_004",
  CZ: "TID_005", DE: "TID_006", DK: "TID_007", EE: "TID_008",
  EL: "TID_009", ES: "TID_010", FI: "TID_011", FR: "TID_012",
  HR: "TID_013", HU: "TID_014", IE: "TID_015", IT: "TID_016",
  LT: "TID_017", LU: "TID_018", LV: "TID_019", MT: "TID_020",
  NL: "TID_021", PL: "TID_022", PT: "TID_023", RO: "TID_024",
  SE: "TID_025", SI: "TID_026", SK: "TID_027",
};

export function validateEuVatNumber(
  taxId: string,
  country: string,
): { valid: boolean; code: string; reason?: string } {
  const code = TID_CODES[country] ?? "TID_001";
  const format = VAT_FORMAT_MAP.get(country);

  if (!format) {
    return { valid: true, code };
  }

  const hasPrefix = taxId.startsWith(format.prefix);
  const fullId = hasPrefix ? taxId : format.prefix + taxId;

  if (!format.pattern.test(fullId)) {
    return {
      valid: false,
      code,
      reason: `NIF do país ${country} deve ter o formato: ${format.description}. Valor: '${taxId}'`,
    };
  }

  if (country === "PT") {
    const digits = fullId.replace("PT", "");
    const nifResult = validatePtNif(digits);
    if (!nifResult.valid) {
      return { valid: false, code: "TID_100", reason: nifResult.reason };
    }
  }

  return { valid: true, code };
}

export function validateTaxIds(saftData: SaftFile): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const cust of saftData.masterFiles.customers) {
    const country = cust.billingAddress.country;
    if (!isEuCountry(country) || country === "PT") continue;

    const result = validateEuVatNumber(cust.customerTaxID, country);
    if (!result.valid) {
      errors.push({
        code: result.code,
        severity: "error",
        message: result.reason ?? `NIF inválido para ${country}`,
        explanation: `O NIF '${cust.customerTaxID}' do cliente '${cust.customerID}' não tem o formato válido para o país ${country}.`,
        path: `MasterFiles.Customer[${cust.customerID}].CustomerTaxID`,
        section: "TaxID",
        documentId: cust.customerID,
        autoFixable: false,
      });
    }
  }

  for (const supp of saftData.masterFiles.suppliers) {
    const country = supp.billingAddress.country;
    if (!isEuCountry(country) || country === "PT") continue;

    const result = validateEuVatNumber(supp.supplierTaxID, country);
    if (!result.valid) {
      errors.push({
        code: result.code,
        severity: "error",
        message: result.reason ?? `NIF inválido para ${country}`,
        explanation: `O NIF '${supp.supplierTaxID}' do fornecedor '${supp.supplierID}' não tem o formato válido para o país ${country}.`,
        path: `MasterFiles.Supplier[${supp.supplierID}].SupplierTaxID`,
        section: "TaxID",
        documentId: supp.supplierID,
        autoFixable: false,
      });
    }
  }

  return errors;
}
