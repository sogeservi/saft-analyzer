"use client";

import { useState, useMemo, type ReactNode } from "react";
import { Search } from "lucide-react";
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
import type { SaftCustomer, SaftSupplier, SaftProduct, SaftTaxTableEntry } from "@/lib/types/saft";

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
  columns: Column<T>[];
}

function buildCustomersConfig(result: AnalysisResult): TableConfig<SaftCustomer> {
  return {
    data: result.saftData.masterFiles.customers,
    sectionCode: "CUST",
    rowKey: (r) => r.customerID,
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
    })),
  );
  return {
    data: rows,
    sectionCode: "GL",
    rowKey: (r) => r.transactionID,
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
}

function buildInvoicesConfig(result: AnalysisResult): TableConfig<InvoiceRow> {
  const invoices =
    result.saftData.sourceDocuments.salesInvoices?.invoices ?? [];
  return {
    data: invoices.map((inv) => ({
      invoiceNo: inv.invoiceNo,
      invoiceType: inv.invoiceType,
      invoiceDate: inv.invoiceDate,
      customerID: inv.customerID,
      status: inv.documentStatus.invoiceStatus,
      grossTotal: inv.documentTotals.grossTotal,
    })),
    sectionCode: "INV",
    rowKey: (r) => r.invoiceNo,
    columns: [
      { header: "N.º fatura", accessor: (r) => r.invoiceNo },
      { header: "Tipo", accessor: (r) => r.invoiceType },
      { header: "Data", accessor: (r) => r.invoiceDate },
      { header: "Cliente", accessor: (r) => r.customerID },
      { header: "Estado", accessor: (r) => r.status },
      {
        header: "Total bruto",
        accessor: (r) => formatCurrency(r.grossTotal),
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
}

function buildPaymentsConfig(result: AnalysisResult): TableConfig<PaymentRow> {
  const payments =
    result.saftData.sourceDocuments.payments?.payments ?? [];
  return {
    data: payments.map((p) => ({
      paymentRefNo: p.paymentRefNo,
      paymentType: p.paymentType,
      transactionDate: p.transactionDate,
      customerID: p.customerID,
      status: p.documentStatus.paymentStatus,
      grossTotal: p.documentTotals.grossTotal,
    })),
    sectionCode: "PAY",
    rowKey: (r) => r.paymentRefNo,
    columns: [
      { header: "Referência", accessor: (r) => r.paymentRefNo },
      { header: "Tipo", accessor: (r) => r.paymentType },
      { header: "Data", accessor: (r) => r.transactionDate },
      { header: "Cliente", accessor: (r) => r.customerID },
      { header: "Estado", accessor: (r) => r.status },
      {
        header: "Total bruto",
        accessor: (r) => formatCurrency(r.grossTotal),
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
}

function buildMovementsConfig(result: AnalysisResult): TableConfig<MovementRow> {
  const movements =
    result.saftData.sourceDocuments.movementOfGoods?.stockMovements ?? [];
  return {
    data: movements.map((m) => ({
      documentNumber: m.documentNumber,
      movementType: m.movementType,
      movementDate: m.movementDate,
      status: m.documentStatus.movementStatus,
      grossTotal: m.documentTotals.grossTotal,
    })),
    sectionCode: "MOV",
    rowKey: (r) => r.documentNumber,
    columns: [
      { header: "N.º documento", accessor: (r) => r.documentNumber },
      { header: "Tipo", accessor: (r) => r.movementType },
      { header: "Data", accessor: (r) => r.movementDate },
      { header: "Estado", accessor: (r) => r.status },
      {
        header: "Total bruto",
        accessor: (r) => formatCurrency(r.grossTotal),
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
}

function buildWorkDocsConfig(result: AnalysisResult): TableConfig<WorkDocRow> {
  const docs =
    result.saftData.sourceDocuments.workingDocuments?.workDocuments ?? [];
  return {
    data: docs.map((d) => ({
      documentNumber: d.documentNumber,
      workType: d.workType,
      workDate: d.workDate,
      customerID: d.customerID,
      status: d.documentStatus.workStatus,
      grossTotal: d.documentTotals.grossTotal,
    })),
    sectionCode: "WRK",
    rowKey: (r) => r.documentNumber,
    columns: [
      { header: "N.º documento", accessor: (r) => r.documentNumber },
      { header: "Tipo", accessor: (r) => r.workType },
      { header: "Data", accessor: (r) => r.workDate },
      { header: "Cliente", accessor: (r) => r.customerID },
      { header: "Estado", accessor: (r) => r.status },
      {
        header: "Total bruto",
        accessor: (r) => formatCurrency(r.grossTotal),
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

function getConfig(
  section: string,
  result: AnalysisResult,
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
      return buildInvoicesConfig(result) as TableConfig<AnyRow>;
    case "payments":
      return buildPaymentsConfig(result) as TableConfig<AnyRow>;
    case "movements":
      return buildMovementsConfig(result) as TableConfig<AnyRow>;
    case "work-docs":
      return buildWorkDocsConfig(result) as TableConfig<AnyRow>;
    default:
      return null;
  }
}

const ROWS_PER_PAGE = 50;

export function DataTableView({ result, section }: DataTableViewProps) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const config = useMemo(() => getConfig(section, result), [section, result]);

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
        Secção não encontrada
      </p>
    );
  }

  const { data, columns, rowKey } = config;

  const filtered = search
    ? data.filter((row) => {
        const q = search.toLowerCase();
        const record = row as unknown as Record<string, unknown>;
        return Object.values(record).some((v) =>
          String(v ?? "")
            .toLowerCase()
            .includes(q),
        );
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
          {formatNumber(filtered.length)} registos
          {sectionErrors.length > 0 && (
            <>
              {" "}
              &middot;{" "}
              <span className="text-destructive">
                {sectionErrors.length} erros
              </span>
            </>
          )}
        </p>
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
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
                  {col.header}
                </TableHead>
              ))}
              <TableHead className="w-20">Erros</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + 1}
                  className="py-8 text-center text-muted-foreground"
                >
                  Sem dados
                </TableCell>
              </TableRow>
            ) : (
              pageData.map((row, i) => {
                const key = rowKey(row);
                const rowErrors = errorsByDoc.get(key);
                return (
                  <TableRow key={`${key}-${i}`}>
                    {columns.map((col, j) => (
                      <TableCell key={j} className={col.className}>
                        {col.accessor(row)}
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
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {page + 1} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setPage((p) => Math.min(totalPages - 1, p + 1))
              }
              disabled={page >= totalPages - 1}
            >
              Seguinte
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
