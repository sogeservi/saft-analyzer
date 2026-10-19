import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { join } from "node:path";
import test from "node:test";

const requireFromBuild = createRequire(import.meta.url);
const { validateAccountingBasis } = requireFromBuild(join(process.env.SAFT_TEST_BUILD_DIR, "accounting-basis.cjs"));
const { validateSalesInvoices } = requireFromBuild(join(process.env.SAFT_TEST_BUILD_DIR, "sales-invoices.cjs"));
const { processSaftFile, UnsupportedSaftBasisError } = requireFromBuild(join(process.env.SAFT_TEST_BUILD_DIR, "process-saft.cjs"));

function fixture(basis = "S") {
  return {
    header: {
      auditFileVersion: "1.04_01", taxAccountingBasis: basis,
      taxRegistrationNumber: "501964843", startDate: "2025-01-01", endDate: "2025-01-31",
      headerComment: "Emitente: Exemplo, NIF 509442794. Base de dados: Lisboa.",
    },
    masterFiles: {
      customers: [{ customerID: "C1", customerTaxID: "509442794", selfBillingIndicator: "1" }],
      products: [{ productCode: "P1" }], taxTable: [{ taxType: "IVA", taxCountryRegion: "PT", taxCode: "NOR" }],
      suppliers: [], generalLedgerAccounts: [],
    },
    sourceDocuments: {
      salesInvoices: { numberOfEntries: 1, totalDebit: 0, totalCredit: 0, invoices: [{
        invoiceNo: "FT A/1", invoiceDate: "2025-01-01", invoiceType: "FT", atcud: "ABCDEFGH-1",
        hash: "0", hashControl: "0", customerID: "C1", systemEntryDate: "2025-01-01T10:00:00",
        documentStatus: { invoiceStatus: basis === "S" ? "S" : "N", sourceBilling: "P" },
        specialRegimes: { selfBillingIndicator: basis === "S" ? "1" : "0", thirdPartiesBillingIndicator: basis === "E" ? "1" : "0", cashVATSchemeIndicator: "0" },
        lines: [], documentTotals: { netTotal: 0, grossTotal: 0, taxPayable: 0 },
      }] },
    },
  };
}

test("E accepts third-party documents and leaves free-text identity for manual review", () => {
  const errors = validateAccountingBasis(fixture("E"));
  assert.deepEqual(errors.map(({ code, severity }) => ({ code, severity })), [{ code: "BASIS_E_003", severity: "info" }]);
});

for (const comment of [undefined, "", "   "]) {
  test(`E rejects missing or blank issuer comment: ${JSON.stringify(comment)}`, () => {
    const data = fixture("E");
    data.header.headerComment = comment;
    assert.equal(validateAccountingBasis(data)[0].code, "BASIS_E_001");
  });
}

test("E warns when issuer comment has no standalone nine-digit NIF", () => {
  const data = fixture("E");
  data.header.headerComment = "Emitente: Exemplo 1234567890, Lisboa";
  assert.equal(validateAccountingBasis(data)[0].code, "BASIS_E_002");
});

test("E checks third-party billing indicator without requiring self-billing", () => {
  const data = fixture("E");
  data.sourceDocuments.salesInvoices.invoices[0].specialRegimes.thirdPartiesBillingIndicator = "0";
  assert.ok(validateAccountingBasis(data).some(({ code }) => code === "BASIS_E_004"));
});

test("S accepts consistent self-billing data without HeaderComment", () => {
  const data = fixture();
  delete data.header.headerComment;
  assert.deepEqual(validateAccountingBasis(data), []);
});

for (const [field, value, expected] of [
  ["status", "N", "BASIS_S_001"],
  ["indicator", "0", "BASIS_S_002"],
  ["agreement", "0", "BASIS_S_003"],
  ["customerTaxID", "501964843", "BASIS_S_004"],
]) {
  test(`S reports inconsistent ${field}`, () => {
    const data = fixture();
    const invoice = data.sourceDocuments.salesInvoices.invoices[0];
    if (field === "status") invoice.documentStatus.invoiceStatus = value;
    if (field === "indicator") invoice.specialRegimes.selfBillingIndicator = value;
    if (field === "agreement") data.masterFiles.customers[0].selfBillingIndicator = value;
    if (field === "customerTaxID") data.masterFiles.customers[0].customerTaxID = value;
    assert.deepEqual(validateAccountingBasis(data).map(({ code }) => code), [expected]);
  });
}

test("S preserves cancelled status A", () => {
  const data = fixture();
  data.sourceDocuments.salesInvoices.invoices[0].documentStatus.invoiceStatus = "A";
  assert.deepEqual(validateAccountingBasis(data), []);
});

test("S reports a customer agreement once for multiple invoices", () => {
  const data = fixture();
  data.masterFiles.customers[0].selfBillingIndicator = "0";
  data.sourceDocuments.salesInvoices.invoices.push({ ...data.sourceDocuments.salesInvoices.invoices[0], invoiceNo: "FT A/2" });
  assert.equal(validateAccountingBasis(data).filter(({ code }) => code === "BASIS_S_003").length, 1);
});

test("ordinary F files do not receive E/S-specific errors", () => {
  assert.deepEqual(validateAccountingBasis(fixture("F")), []);
});

for (const basis of ["S", "F"]) {
  test(`${basis}: numbering gaps are checked only for ordinary exports`, () => {
    const data = fixture(basis);
    const invoice = data.sourceDocuments.salesInvoices.invoices[0];
    data.sourceDocuments.salesInvoices.invoices.push({ ...invoice, invoiceNo: "FT A/3", atcud: "ABCDEFGH-3" });
    data.sourceDocuments.salesInvoices.numberOfEntries = 2;
    assert.equal(validateSalesInvoices(data).some(({ code }) => code === "INV_027"), basis === "F");
  });
}

function xmlFile(basis, complete = false) {
  return new File([`<?xml version="1.0" encoding="UTF-8"?>
    <AuditFile xmlns="urn:OECD:StandardAuditFile-Tax:PT_1.04_01">
      <Header><AuditFileVersion>1.04_01</AuditFileVersion><TaxAccountingBasis>${basis}</TaxAccountingBasis>
        <TaxRegistrationNumber>501964843</TaxRegistrationNumber><CompanyID>501964843</CompanyID><CompanyName>Exemplo</CompanyName>
        <CompanyAddress><AddressDetail>Rua Um</AddressDetail><City>Lisboa</City><PostalCode>1000-001</PostalCode><Country>PT</Country></CompanyAddress>
        <FiscalYear>2025</FiscalYear><StartDate>2025-01-01</StartDate><EndDate>2025-01-31</EndDate><DateCreated>2025-02-01</DateCreated><CurrencyCode>EUR</CurrencyCode>
      </Header>
      <MasterFiles>${complete ? `<Product><ProductCode>P1</ProductCode><ProductType>S</ProductType><ProductDescription>Serviço</ProductDescription><ProductNumberCode>P1</ProductNumberCode></Product>
        <TaxTable><TaxTableEntry><TaxType>IVA</TaxType><TaxCountryRegion>PT</TaxCountryRegion><TaxCode>NOR</TaxCode><TaxPercentage>23</TaxPercentage></TaxTableEntry></TaxTable>` : ""}</MasterFiles>
    </AuditFile>`], `${basis}.xml`, { type: "application/xml" });
}

for (const basis of ["E", "S", "F"]) {
  test(`upload accepts ${basis} and preserves partial classification`, async () => {
    const result = await processSaftFile(xmlFile(basis));
    assert.deepEqual({ basis: result.header.taxAccountingBasis, type: result.saftType, codes: result.errors.map(({ code }) => code) },
      { basis, type: "partial", codes: ["SAFT_PARTIAL"] });
  });
}

test("complete E upload executes type-specific validation", async () => {
  const result = await processSaftFile(xmlFile("E", true));
  assert.ok(result.saftType === "complete" && result.errors.some(({ code }) => code === "BASIS_E_001"));
});

for (const basis of ["C", "I"]) {
  test(`upload still rejects unsupported accounting basis ${basis}`, async () => {
    await assert.rejects(processSaftFile(xmlFile(basis)), (error) => error instanceof UnsupportedSaftBasisError && error.basis === basis);
  });
}
