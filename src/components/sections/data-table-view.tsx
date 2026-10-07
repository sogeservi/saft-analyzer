"use client";

import { Fragment, useState, useMemo, type ReactNode } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AnalysisResult } from "@/lib/types/analysis";
import type { ValidationError } from "@/lib/types/errors";
import { formatCurrency, formatNumber } from "@/lib/format";
import type {
  SaftCustomer,
  SaftSupplier,
  SaftProduct,
  SaftTaxTableEntry,
  SaftInvoice,
  SaftPayment,
  SaftStockMovement,
  SaftWorkDocument,
} from "@/lib/types/saft";
import { useLocale } from "@/lib/i18n";

interface DataTableViewProps {
  result: AnalysisResult;
  section: string;
}

interface Column<T> {
  header: string;
  accessor: (row: T) => ReactNode;
  className?: string;
}

interface TableConfig<T> {
  data: T[];
  sectionCode: string;
  rowKey: (row: T) => string;
  getDetails: (row: T) => unknown;
  columns: Column<T>[];
}

function indexBy<T>(items: T[], getKey: (item: T) => string): Map<string, T> {
  const index = new Map<string, T>();
  for (const item of items) index.set(getKey(item), item);
  return index;
}

function buildCustomersConfig(result: AnalysisResult): TableConfig<SaftCustomer> {
  return {
    data: result.saftData.masterFiles.customers,
    sectionCode: "CUST",
    rowKey: (r) => r.customerID,
    getDetails: (r) => r,
    columns: [
      { header: "ID", accessor: (r) => r.customerID },
      { header: "Nome", accessor: (r) => r.companyName },
      { header: "NIF", accessor: (r) => r.customerTaxID },
      { header: "Conta", accessor: (r) => r.accountID },
      { header: "País", accessor: (r) => r.billingAddress?.country ?? "" },
    ],
  };
}

function buildSuppliersConfig(result: AnalysisResult): TableConfig<SaftSupplier> {
  return {
    data: result.saftData.masterFiles.suppliers,
    sectionCode: "SUPP",
    rowKey: (r) => r.supplierID,
    getDetails: (r) => r,
    columns: [
      { header: "ID", accessor: (r) => r.supplierID },
      { header: "Nome", accessor: (r) => r.companyName },
      { header: "NIF", accessor: (r) => r.supplierTaxID },
      { header: "Conta", accessor: (r) => r.accountID },
      { header: "País", accessor: (r) => r.billingAddress?.country ?? "" },
    ],
  };
}

function buildProductsConfig(result: AnalysisResult): TableConfig<SaftProduct> {
  return {
    data: result.saftData.masterFiles.products,
    sectionCode: "PROD",
    rowKey: (r) => r.productCode,
    getDetails: (r) => r,
    columns: [
      { header: "Código", accessor: (r) => r.productCode },
      { header: "Descrição", accessor: (r) => r.productDescription },
      { header: "Tipo", accessor: (r) => r.productType },
      { header: "Grupo", accessor: (r) => r.productGroup ?? "\u2014" },
      { header: "Código barras", accessor: (r) => r.productNumberCode },
    ],
  };
}

function buildTaxTablesConfig(result: AnalysisResult): TableConfig<SaftTaxTableEntry> {
  return {
    data: result.saftData.masterFiles.taxTable,
    sectionCode: "TAX",
    rowKey: (r) => `${r.taxType}-${r.taxCountryRegion}-${r.taxCode}`,
    getDetails: (r) => r,
    columns: [
      { header: "Tipo", accessor: (r) => r.taxType },
      { header: "Região", accessor: (r) => r.taxCountryRegion },
      { header: "Código", accessor: (r) => r.taxCode },
      {
        header: "Percentagem (%)",
        accessor: (r) =>
          r.taxPercentage != null ? `${r.taxPercentage}%` : "\u2014",
      },
      {
        header: "Montante",
        accessor: (r) =>
          r.taxAmount != null ? formatCurrency(r.taxAmount) : "\u2014",
      },
    ],
  };
}

interface GLRow {
  transactionID: string;
  journalID: string;
  transactionDate: string;
  transactionType: string;
  description: string;
  details: unknown;
}

function buildGLConfig(result: AnalysisResult): TableConfig<GLRow> {
  const journals = result.saftData.generalLedgerEntries?.journals ?? [];
  const rows: GLRow[] = journals.flatMap((j) =>
    (j.transactions ?? []).map((t) => ({
      transactionID: t.transactionID,
      journalID: j.journalID,
      transactionDate: t.transactionDate,
      transactionType: t.transactionType,
      description: t.description,
      details: { ...t, journalID: j.journalID, journalDescription: j.description },
    })),
  );
  return {
    data: rows,
    sectionCode: "GL",
    rowKey: (r) => r.transactionID,
    getDetails: (r) => r.details,
    columns: [
      { header: "ID transação", accessor: (r) => r.transactionID },
      { header: "Diário", accessor: (r) => r.journalID },
      { header: "Data", accessor: (r) => r.transactionDate },
      { header: "Tipo", accessor: (r) => r.transactionType },
      { header: "Descrição", accessor: (r) => r.description },
    ],
  };
}

interface InvoiceRow {
  invoiceNo: string;
  invoiceType: string;
  invoiceDate: string;
  customerID: string;
  status: string;
  grossTotal: number;
  details: SaftInvoice;
}

function buildInvoicesConfig(result: AnalysisResult, locale: string): TableConfig<InvoiceRow> {
  const invoices =
    result.saftData.sourceDocuments.salesInvoices?.invoices ?? [];
  const customers = indexBy(result.saftData.masterFiles.customers, (customer) => customer.customerID);
  const products = indexBy(result.saftData.masterFiles.products, (product) => product.productCode);
  return {
    data: invoices.map((inv) => ({
      invoiceNo: inv.invoiceNo,
      invoiceType: inv.invoiceType,
      invoiceDate: inv.invoiceDate,
      customerID: inv.customerID,
      status: inv.documentStatus.invoiceStatus,
      grossTotal: inv.documentTotals.grossTotal,
      details: inv,
    })),
    sectionCode: "INV",
    rowKey: (r) => r.invoiceNo,
    getDetails: (r) => {
      const invoice = r.details;
      return {
        invoice,
        customer: customers.get(invoice.customerID),
        products: [...new Set(invoice.lines.map((line) => line.productCode))]
          .map((productCode) => products.get(productCode))
          .filter((product): product is SaftProduct => product !== undefined),
      };
    },
    columns: [
      { header: "N.º fatura", accessor: (r) => r.invoiceNo },
      { header: "Tipo", accessor: (r) => r.invoiceType },
      { header: "Data", accessor: (r) => r.invoiceDate },
      { header: "Cliente", accessor: (r) => r.customerID },
      { header: "Estado", accessor: (r) => r.status },
      {
        header: "Total bruto",
        accessor: (r) => formatCurrency(r.grossTotal, locale),
        className: "text-right",
      },
    ],
  };
}

interface PaymentRow {
  paymentRefNo: string;
  paymentType: string;
  transactionDate: string;
  customerID: string;
  status: string;
  grossTotal: number;
  details: SaftPayment;
}

function buildPaymentsConfig(result: AnalysisResult, locale: string): TableConfig<PaymentRow> {
  const payments =
    result.saftData.sourceDocuments.payments?.payments ?? [];
  const customers = indexBy(result.saftData.masterFiles.customers, (customer) => customer.customerID);
  const invoices = indexBy(result.saftData.sourceDocuments.salesInvoices?.invoices ?? [], (invoice) => invoice.invoiceNo);
  return {
    data: payments.map((p) => ({
      paymentRefNo: p.paymentRefNo,
      paymentType: p.paymentType,
      transactionDate: p.transactionDate,
      customerID: p.customerID,
      status: p.documentStatus.paymentStatus,
      grossTotal: p.documentTotals.grossTotal,
      details: p,
    })),
    sectionCode: "PAY",
    rowKey: (r) => r.paymentRefNo,
    getDetails: (r) => ({
      payment: r.details,
      customer: customers.get(r.details.customerID),
      sourceInvoices: r.details.lines
        .map((line) => line.sourceDocumentID?.originatingON)
        .filter((invoiceNo): invoiceNo is string => Boolean(invoiceNo))
        .map((invoiceNo) => invoices.get(invoiceNo))
        .filter((invoice): invoice is SaftInvoice => invoice !== undefined),
    }),
    columns: [
      { header: "Referência", accessor: (r) => r.paymentRefNo },
      { header: "Tipo", accessor: (r) => r.paymentType },
      { header: "Data", accessor: (r) => r.transactionDate },
      { header: "Cliente", accessor: (r) => r.customerID },
      { header: "Estado", accessor: (r) => r.status },
      {
        header: "Total bruto",
        accessor: (r) => formatCurrency(r.grossTotal, locale),
        className: "text-right",
      },
    ],
  };
}

interface MovementRow {
  documentNumber: string;
  movementType: string;
  movementDate: string;
  status: string;
  grossTotal: number;
  details: SaftStockMovement;
}

function buildMovementsConfig(result: AnalysisResult, locale: string): TableConfig<MovementRow> {
  const movements =
    result.saftData.sourceDocuments.movementOfGoods?.stockMovements ?? [];
  const customers = indexBy(result.saftData.masterFiles.customers, (customer) => customer.customerID);
  const suppliers = indexBy(result.saftData.masterFiles.suppliers, (supplier) => supplier.supplierID);
  const products = indexBy(result.saftData.masterFiles.products, (product) => product.productCode);
  return {
    data: movements.map((m) => ({
      documentNumber: m.documentNumber,
      movementType: m.movementType,
      movementDate: m.movementDate,
      status: m.documentStatus.movementStatus,
      grossTotal: m.documentTotals.grossTotal,
      details: m,
    })),
    sectionCode: "MOV",
    rowKey: (r) => r.documentNumber,
    getDetails: (r) => ({
      movement: r.details,
      customer: r.details.customerID ? customers.get(r.details.customerID) : undefined,
      supplier: r.details.supplierID ? suppliers.get(r.details.supplierID) : undefined,
      products: [...new Set(r.details.lines.map((line) => line.productCode))]
        .map((productCode) => products.get(productCode))
        .filter((product): product is SaftProduct => product !== undefined),
    }),
    columns: [
      { header: "N.º documento", accessor: (r) => r.documentNumber },
      { header: "Tipo", accessor: (r) => r.movementType },
      { header: "Data", accessor: (r) => r.movementDate },
      { header: "Estado", accessor: (r) => r.status },
      {
        header: "Total bruto",
        accessor: (r) => formatCurrency(r.grossTotal, locale),
        className: "text-right",
      },
    ],
  };
}

interface WorkDocRow {
  documentNumber: string;
  workType: string;
  workDate: string;
  customerID: string;
  status: string;
  grossTotal: number;
  details: SaftWorkDocument;
}

function buildWorkDocsConfig(result: AnalysisResult, locale: string): TableConfig<WorkDocRow> {
  const docs =
    result.saftData.sourceDocuments.workingDocuments?.workDocuments ?? [];
  const customers = indexBy(result.saftData.masterFiles.customers, (customer) => customer.customerID);
  const products = indexBy(result.saftData.masterFiles.products, (product) => product.productCode);
  return {
    data: docs.map((d) => ({
      documentNumber: d.documentNumber,
      workType: d.workType,
      workDate: d.workDate,
      customerID: d.customerID,
      status: d.documentStatus.workStatus,
      grossTotal: d.documentTotals.grossTotal,
      details: d,
    })),
    sectionCode: "WRK",
    rowKey: (r) => r.documentNumber,
    getDetails: (r) => ({
      workDocument: r.details,
      customer: customers.get(r.details.customerID),
      products: [...new Set(r.details.lines.map((line) => line.productCode))]
        .map((productCode) => products.get(productCode))
        .filter((product): product is SaftProduct => product !== undefined),
    }),
    columns: [
      { header: "N.º documento", accessor: (r) => r.documentNumber },
      { header: "Tipo", accessor: (r) => r.workType },
      { header: "Data", accessor: (r) => r.workDate },
      { header: "Cliente", accessor: (r) => r.customerID },
      { header: "Estado", accessor: (r) => r.status },
      {
        header: "Total bruto",
        accessor: (r) => formatCurrency(r.grossTotal, locale),
        className: "text-right",
      },
    ],
  };
}

type AnyRow =
  | SaftCustomer
  | SaftSupplier
  | SaftProduct
  | SaftTaxTableEntry
  | GLRow
  | InvoiceRow
  | PaymentRow
  | MovementRow
  | WorkDocRow;

function getConfig( section: string, result: AnalysisResult, locale: string,
): TableConfig<AnyRow> | null {
  switch (section) {
    case "customers":
      return buildCustomersConfig(result) as TableConfig<AnyRow>;
    case "suppliers":
      return buildSuppliersConfig(result) as TableConfig<AnyRow>;
    case "products":
      return buildProductsConfig(result) as TableConfig<AnyRow>;
    case "tax-tables":
      return buildTaxTablesConfig(result) as TableConfig<AnyRow>;
    case "gl-entries":
      return buildGLConfig(result) as TableConfig<AnyRow>;
    case "invoices":
      return buildInvoicesConfig(result, locale) as TableConfig<AnyRow>;
    case "payments":
      return buildPaymentsConfig(result, locale) as TableConfig<AnyRow>;
    case "movements":
      return buildMovementsConfig(result, locale) as TableConfig<AnyRow>;
    case "work-docs":
      return buildWorkDocsConfig(result, locale) as TableConfig<AnyRow>;
    default:
      return null;
  }
}

const ROWS_PER_PAGE = 50;
const CURRENCY_FIELDS = new Set([
  "openingDebitBalance",
  "openingCreditBalance",
  "closingDebitBalance",
  "closingCreditBalance",
  "unitPrice",
  "creditAmount",
  "debitAmount",
  "taxPayable",
  "netTotal",
  "grossTotal",
  "taxAmount",
  "settlementAmount",
  "withholdingTaxAmount",
  "currencyAmount",
  "paymentAmount",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fieldLabel(key: string): string {
  const labels: Record<string, string> = {
    invoice: "Fatura",
    payment: "Pagamento",
    movement: "Movimento",
    workDocument: "Documento de trabalho",
    customer: "Cliente relacionado",
    supplier: "Fornecedor relacionado",
    products: "Produtos relacionados",
    sourceInvoices: "Faturas de origem",
    journalDescription: "Descrição do diário",
    invoiceNo: "N.º fatura",
    documentNumber: "N.º documento",
    paymentRefNo: "Referência do pagamento",
    invoiceDate: "Data da fatura",
    transactionDate: "Data da transação",
    movementDate: "Data do movimento",
    workDate: "Data do documento",
    invoiceType: "Tipo de fatura",
    movementType: "Tipo de movimento",
    workType: "Tipo de documento",
    documentStatus: "Estado do documento",
    invoiceStatus: "Estado da fatura",
    paymentStatus: "Estado do pagamento",
    movementStatus: "Estado do movimento",
    workStatus: "Estado do documento de trabalho",
    statusDate: "Data do estado",
    invoiceStatusDate: "Data do estado da fatura",
    paymentStatusDate: "Data do estado do pagamento",
    movementStatusDate: "Data do estado do movimento",
    workStatusDate: "Data do estado do documento",
    sourceID: "ID de origem",
    sourceBilling: "Faturação de origem",
    sourcePayment: "Pagamento de origem",
    customerID: "ID do cliente",
    supplierID: "ID do fornecedor",
    transactionID: "ID da transação",
    systemEntryDate: "Data de entrada no sistema",
    atcud: "ATCUD",
    hashControl: "Controlo do hash",
    specialRegimes: "Regimes especiais",
    selfBillingIndicator: "Indicador de autofaturação",
    cashVATSchemeIndicator: "Indicador do regime de IVA de caixa",
    thirdPartiesBillingIndicator: "Indicador de faturação por terceiros",
    lines: "Linhas do documento",
    lineNumber: "N.º da linha",
    orderReferences: "Referências de encomenda",
    sourceDocumentID: "Documento de origem",
    originatingON: "N.º do documento de origem",
    productCode: "Código do produto",
    productDescription: "Descrição do produto",
    productType: "Tipo de produto",
    productGroup: "Grupo de produtos",
    productNumberCode: "Código de barras",
    quantity: "Quantidade",
    unitOfMeasure: "Unidade de medida",
    unitPrice: "Preço unitário",
    taxPointDate: "Data de exigibilidade do imposto",
    creditAmount: "Montante a crédito",
    debitAmount: "Montante a débito",
    tax: "Imposto",
    taxType: "Tipo de imposto",
    taxCountryRegion: "Região do imposto",
    taxCode: "Código do imposto",
    taxPercentage: "Taxa de imposto (%)",
    taxAmount: "Montante do imposto",
    taxExemptionReason: "Motivo de isenção",
    taxExemptionCode: "Código de isenção",
    settlementAmount: "Montante de desconto",
    documentTotals: "Totais do documento",
    taxPayable: "IVA a pagar",
    netTotal: "Total líquido",
    grossTotal: "Total bruto",
    currency: "Moeda",
    currencyCode: "Código da moeda",
    currencyAmount: "Montante noutra moeda",
    exchangeRate: "Taxa de câmbio",
    settlement: "Desconto de liquidação",
    settlementDiscount: "Desconto de liquidação",
    settlementDate: "Data de liquidação",
    paymentTerms: "Condições de pagamento",
    withholdingTax: "Retenção na fonte",
    withholdingTaxType: "Tipo de retenção",
    withholdingTaxDescription: "Descrição da retenção",
    withholdingTaxAmount: "Montante retido",
    paymentMethods: "Meios de pagamento",
    paymentMechanism: "Meio de pagamento",
    paymentAmount: "Montante pago",
    paymentDate: "Data do pagamento",
    shipTo: "Local de entrega",
    shipFrom: "Local de expedição",
    deliveryID: "ID da entrega",
    deliveryDate: "Data de entrega",
    warehouseID: "ID do armazém",
    locationID: "ID da localização",
    address: "Morada",
    addressDetail: "Morada",
    postalCode: "Código postal",
    companyName: "Nome",
    customerTaxID: "NIF do cliente",
    supplierTaxID: "NIF do fornecedor",
    accountID: "Conta",
    contact: "Contacto",
    telephone: "Telefone",
    email: "Email",
    website: "Website",
    country: "País",
    city: "Localidade",
    reason: "Motivo",
    description: "Descrição",
    period: "Período",
    eacCode: "Código EAC",
    hash: "Hash",
    transactionType: "Tipo de transação",
    journalID: "Diário",
    systemID: "ID do sistema",
    accountDescription: "Descrição da conta",
    auditFileVersion: "Versão SAF-T",
    billingAddress: "Morada de faturação",
    buildingNumber: "N.º de porta",
    businessName: "Nome comercial",
    companyAddress: "Morada da empresa",
    companyID: "ID da empresa",
    dateCreated: "Data de criação",
    docArchivalNumber: "N.º de arquivo do documento",
    endDate: "Data fim",
    fax: "Fax",
    fiscalYear: "Ano fiscal",
    glPostingDate: "Data de lançamento contabilístico",
    groupingCategory: "Categoria de agrupamento",
    groupingCode: "Código de agrupamento",
    headerComment: "Observações do cabeçalho",
    movementComments: "Observações do movimento",
    movementStartTime: "Hora de início do movimento",
    numberOfEntries: "Número de registos",
    numberOfMovementLines: "Número de linhas de movimento",
    productCompanyTaxID: "NIF da empresa de software",
    productID: "ID do produto de software",
    productVersion: "Versão do produto de software",
    recordID: "ID do registo",
    reference: "Referência",
    references: "Referências",
    region: "Região",
    shipToAddress: "Morada de entrega",
    softwareCertificateNumber: "Certificado de software",
    startDate: "Data início",
    streetName: "Rua",
    taxAccountingBasis: "Base contabilística",
    taxEntity: "Entidade fiscal",
    taxExpirationDate: "Data de validade do imposto",
    taxRegistrationNumber: "NIF",
    taxonomyCode: "Código de taxonomia",
    totalCredit: "Total a crédito",
    totalDebit: "Total a débito",
    totalQuantityIssued: "Quantidade total emitida",
  };
  return labels[key] ?? key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (value) => value.toUpperCase());
}

function DetailFields({
  value,
  t,
  languageTag,
}: {
  value: Record<string, unknown>;
  t: (portuguese: string) => string;
  languageTag: string;
}) {
  const entries = Object.entries(value).filter(([, fieldValue]) =>
    fieldValue !== undefined && fieldValue !== null && fieldValue !== "" &&
    (!Array.isArray(fieldValue) || fieldValue.length > 0),
  );

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {entries.map(([key, fieldValue]) => {
        const label = t(fieldLabel(key));
        if (Array.isArray(fieldValue)) {
          return (
            <section key={key} className="space-y-2 sm:col-span-2">
              <h5 className="text-sm font-medium">
                {label} <span className="text-xs text-muted-foreground">({formatNumber(fieldValue.length, languageTag)})</span>
              </h5>
              <div className="grid gap-2 lg:grid-cols-2">
                {fieldValue.map((item, index) => (
                  <div key={`${key}-${index}`} className="rounded-md border bg-background p-3">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      {t("Item")} {formatNumber(index + 1, languageTag)}
                    </p>
                    {isRecord(item) ? (
                      <DetailFields value={item} t={t} languageTag={languageTag} />
                    ) : (
                      <p className="break-words text-sm">{String(item)}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          );
        }
        if (isRecord(fieldValue)) {
          return (
            <section key={key} className="space-y-2 rounded-md border bg-background p-3 sm:col-span-2">
              <h5 className="text-sm font-medium">{label}</h5>
              <DetailFields value={fieldValue} t={t} languageTag={languageTag} />
            </section>
          );
        }
        return (
          <div key={key} className="min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="break-words text-sm">
              {typeof fieldValue !== "number"
                ? String(fieldValue)
                : CURRENCY_FIELDS.has(key)
                  ? formatCurrency(fieldValue, languageTag)
                  : key === "taxPercentage"
                    ? `${formatNumber(fieldValue, languageTag)}%`
                    : formatNumber(fieldValue, languageTag)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

export function DataTableView({ result, section }: DataTableViewProps) {
  const { t, languageTag } = useLocale();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const config = useMemo(() => getConfig(section, result, languageTag), [section, result, languageTag]);

  const sectionErrors = useMemo(
    () =>
      config
        ? result.errors.filter((e) => e.section === config.sectionCode)
        : [],
    [result.errors, config],
  );

  const errorsByDoc = useMemo(() => {
    const map = new Map<string, ValidationError[]>();
    for (const err of sectionErrors) {
      const key = err.documentId ?? err.path;
      const arr = map.get(key) ?? [];
      arr.push(err);
      map.set(key, arr);
    }
    return map;
  }, [sectionErrors]);

  if (!config) {
    return (
      <p className="py-8 text-center text-muted-foreground">
        {t("Secção não encontrada")}
      </p>
    );
  }

  const { data, columns, rowKey } = config;

  const filtered = search
    ? data.filter((row) => {
        const q = search.toLowerCase();
        return Object.entries(row)
          .filter(([key]) => key !== "details")
          .some(([, value]) => String(value ?? "").toLowerCase().includes(q));
      })
    : data;

  const totalPages = Math.ceil(filtered.length / ROWS_PER_PAGE);
  const pageData = filtered.slice(
    page * ROWS_PER_PAGE,
    (page + 1) * ROWS_PER_PAGE,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {formatNumber(filtered.length, languageTag)} {t("registos")}
          {sectionErrors.length > 0 && (
            <>
              {" "}
              &middot;{" "}
              <span className="text-destructive">
                {formatNumber(sectionErrors.length, languageTag)} {t("erros encontrados")}
              </span>
            </>
          )}
        </p>
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder={t("Pesquisar…")}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
              setExpandedRow(null);
            }}
            className="pl-9"
          />
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col, i) => (
                <TableHead key={i} className={col.className}>
                  {t(col.header)}
                </TableHead>
              ))}
              <TableHead className="w-20">{t("Erros")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + 1}
                  className="py-8 text-center text-muted-foreground"
                >
                  {t("Sem dados")}
                </TableCell>
              </TableRow>
            ) : (
              pageData.map((row, i) => {
                const key = rowKey(row);
                const rowErrors = errorsByDoc.get(key);
                const isExpanded = expandedRow === key;
                const detailsId = `${section}-row-${i}-details`;
                const details = isExpanded ? config.getDetails(row) : null;
                return (
                  <Fragment key={`${key}-${i}`}>
                  <TableRow>
                    {columns.map((col, j) => (
                      <TableCell key={j} className={col.className}>
                        {j === 0 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-auto max-w-full justify-start gap-2 px-1 py-1 text-left font-medium"
                            aria-label={`${t(isExpanded ? "Ocultar detalhes de" : "Mostrar detalhes de")} ${key}`}
                            aria-expanded={isExpanded}
                            aria-controls={detailsId}
                            onClick={() => setExpandedRow(isExpanded ? null : key)}
                          >
                            <ChevronDown className={`size-4 shrink-0 transition-transform motion-reduce:transition-none ${isExpanded ? "rotate-180" : ""}`} aria-hidden="true" />
                            <span className="truncate">{col.accessor(row)}</span>
                          </Button>
                        ) : col.accessor(row)}
                      </TableCell>
                    ))}
                    <TableCell>
                      {rowErrors && rowErrors.length > 0 && (
                        <Badge variant="destructive">
                          {rowErrors.length}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow>
                      <TableCell id={detailsId} colSpan={columns.length + 1} className="whitespace-normal bg-muted/20 p-0">
                        <div className="space-y-3 p-4 sm:p-5">
                          <h4 className="text-sm font-semibold">{t("Detalhes completos")}</h4>
                          <DetailFields
                            value={isRecord(details) ? details : { details }}
                            t={t}
                            languageTag={languageTag}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t("Página")} {formatNumber(page + 1, languageTag)} {t("de")} {formatNumber(totalPages, languageTag)}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPage((p) => Math.max(0, p - 1));
                setExpandedRow(null);
              }}
              disabled={page === 0}
            >
              {t("Anterior")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPage((p) => Math.min(totalPages - 1, p + 1));
                setExpandedRow(null);
              }}
              disabled={page >= totalPages - 1}
            >
              {t("Seguinte")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
