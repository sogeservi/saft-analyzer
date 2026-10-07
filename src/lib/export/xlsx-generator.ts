import ExcelJS from "exceljs";
import type { AnalysisResult } from "../types/analysis";
import { SEVERITY_LABELS } from "../types/errors";
import { APP_BUILD_INFO } from "../build-info";
import {
  ACTIVITY_PERIOD_LABELS,
  groupFinancialActivity,
} from "../financial-activity";

export async function generateXlsx(result: AnalysisResult): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SogeServi | SAF-T Analyzer";
  wb.company = "SogeServi";
  wb.created = new Date();

  addResumoSheet(wb, result);
  addActivitySheet(wb, result);
  addClientesSheet(wb, result);
  addFornecedoresSheet(wb, result);
  addProdutosSheet(wb, result);
  addVendasSheet(wb, result);
  addPagamentosSheet(wb, result);
  addMovimentosSheet(wb, result);
  addDocTrabSheet(wb, result);
  addErrosSheet(wb, result);

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function headerStyle(ws: ExcelJS.Worksheet, rowNum: number): void {
  const row = ws.getRow(rowNum);
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF1F2937" },
  };
  row.alignment = { horizontal: "center" };
  ws.views = [{ state: "frozen", ySplit: rowNum }];
}

function addResumoSheet(wb: ExcelJS.Workbook, r: AnalysisResult): void {
  const ws = wb.addWorksheet("Resumo");
  ws.columns = [
    { header: "Campo", key: "field", width: 30 },
    { header: "Valor", key: "value", width: 40 },
  ];
  headerStyle(ws, 1);

  ws.addRow({ field: "Empresa", value: r.header.companyName });
  ws.addRow({ field: "Nome comercial", value: r.header.businessName ?? "" });
  ws.addRow({ field: "NIF", value: r.header.taxRegistrationNumber });
  ws.addRow({ field: "ID da empresa", value: r.header.companyID });
  ws.addRow({ field: "Morada", value: [r.header.companyAddress.addressDetail, r.header.companyAddress.city, r.header.companyAddress.postalCode, r.header.companyAddress.country].filter(Boolean).join(", ") });
  ws.addRow({ field: "Software exportador", value: [r.header.productID, r.header.productVersion].filter(Boolean).join(" ") });
  ws.addRow({ field: "NIF do produtor de software", value: r.header.productCompanyTaxID });
  ws.addRow({ field: "Certificado de software", value: r.header.softwareCertificateNumber });
  ws.addRow({ field: "Tipo SAF-T", value: r.saftType === "complete" ? "Completo" : "Parcial" });
  ws.addRow({ field: "Versão SAF-T", value: r.saftVersion });
  ws.addRow({ field: "Período", value: `${r.header.startDate} a ${r.header.endDate}` });
  ws.addRow({ field: "Data de Análise", value: new Date(r.analyzedAt) }).getCell(2).numFmt = "yyyy-mm-dd hh:mm";
  ws.addRow({ field: "Versão da aplicação", value: APP_BUILD_INFO.version });
  ws.addRow({ field: "Data de build da aplicação", value: APP_BUILD_INFO.date });
  ws.addRow({ field: "Receita Total", value: r.financialSummary.totalRevenue }).getCell(2).numFmt = '"€"#,##0.00';
  ws.addRow({ field: "Total Crédito", value: r.financialSummary.totalCredit }).getCell(2).numFmt = '"€"#,##0.00';
  ws.addRow({ field: "Total Débito", value: r.financialSummary.totalDebit }).getCell(2).numFmt = '"€"#,##0.00';
  ws.addRow({ field: "Score de Saúde", value: `${r.healthScore.overall}%` });
  ws.addRow({ field: "Total de Erros", value: r.errorSummary.total });
  ws.addRow({ field: "Erros Críticos", value: r.errorSummary.bySeverity.critical });
  ws.addRow({ field: "Erros", value: r.errorSummary.bySeverity.error });
  ws.addRow({ field: "Avisos", value: r.errorSummary.bySeverity.warning });
  ws.addRow({ field: "Informações", value: r.errorSummary.bySeverity.info });
  const attribution = ws.addRow({ field: "Made by", value: "SogeServi" });
  attribution.getCell(2).value = {
    text: "SogeServi",
    hyperlink: "https://sogeservi.pt",
    tooltip: "SogeServi",
  };
  attribution.getCell(2).font = { color: { argb: "FF0563C1" }, underline: true };
}

function addActivitySheet(wb: ExcelJS.Workbook, result: AnalysisResult): void {
  const { period, buckets } = groupFinancialActivity(result.financialSummary.dayStats);
  const ws = wb.addWorksheet("Atividade");
  ws.columns = [
    { header: `Período (${ACTIVITY_PERIOD_LABELS[period]})`, key: "period", width: 26 },
    { header: "Total bruto (EUR)", key: "grossTotal", width: 22 },
    { header: "Documentos", key: "documentCount", width: 16 },
  ];
  headerStyle(ws, 1);

  for (const bucket of buckets) {
    const row = ws.addRow({
      period: bucket.label,
      grossTotal: bucket.grossTotal,
      documentCount: bucket.documentCount,
    });
    row.getCell(2).numFmt = '"€"#,##0.00';
    row.getCell(3).numFmt = "#,##0";
  }
  if (buckets.length > 0) {
    ws.addConditionalFormatting({
      ref: `B2:B${buckets.length + 1}`,
      rules: [{
        type: "colorScale",
        priority: 1,
        cfvo: [{ type: "min" }, { type: "max" }],
        color: [{ argb: "FFE0F2FE" }, { argb: "FF0891B2" }],
      }],
    });
  }
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: ws.rowCount, column: ws.columnCount },
  };
}

function addClientesSheet(wb: ExcelJS.Workbook, r: AnalysisResult): void {
  const ws = wb.addWorksheet("Clientes");
  ws.columns = [
    { header: "ID", key: "id", width: 15 },
    { header: "NIF", key: "nif", width: 18 },
    { header: "Nome", key: "name", width: 35 },
    { header: "País", key: "country", width: 8 },
    { header: "Cidade", key: "city", width: 20 },
    { header: "Cód. Postal", key: "postalCode", width: 12 },
  ];
  headerStyle(ws, 1);

  for (const c of r.saftData.masterFiles.customers) {
    ws.addRow({
      id: c.customerID,
      nif: c.customerTaxID,
      name: c.companyName,
      country: c.billingAddress.country,
      city: c.billingAddress.city,
      postalCode: c.billingAddress.postalCode,
    });
  }
}

function addFornecedoresSheet(wb: ExcelJS.Workbook, r: AnalysisResult): void {
  const ws = wb.addWorksheet("Fornecedores");
  ws.columns = [
    { header: "ID", key: "id", width: 15 },
    { header: "NIF", key: "nif", width: 18 },
    { header: "Nome", key: "name", width: 35 },
    { header: "País", key: "country", width: 8 },
    { header: "Cidade", key: "city", width: 20 },
  ];
  headerStyle(ws, 1);

  for (const s of r.saftData.masterFiles.suppliers) {
    ws.addRow({
      id: s.supplierID,
      nif: s.supplierTaxID,
      name: s.companyName,
      country: s.billingAddress.country,
      city: s.billingAddress.city,
    });
  }
}

function addProdutosSheet(wb: ExcelJS.Workbook, r: AnalysisResult): void {
  const ws = wb.addWorksheet("Produtos");
  ws.columns = [
    { header: "Código", key: "code", width: 18 },
    { header: "Tipo", key: "type", width: 6 },
    { header: "Descrição", key: "desc", width: 40 },
    { header: "Grupo", key: "group", width: 20 },
    { header: "Nº Código", key: "numCode", width: 18 },
  ];
  headerStyle(ws, 1);

  for (const p of r.saftData.masterFiles.products) {
    ws.addRow({
      code: p.productCode,
      type: p.productType,
      desc: p.productDescription,
      group: p.productGroup ?? "",
      numCode: p.productNumberCode,
    });
  }
}

function addVendasSheet(wb: ExcelJS.Workbook, r: AnalysisResult): void {
  const ws = wb.addWorksheet("Vendas");
  ws.columns = [
    { header: "Nº Fatura", key: "no", width: 20 },
    { header: "Tipo", key: "type", width: 6 },
    { header: "Data", key: "date", width: 12 },
    { header: "Estado", key: "status", width: 8 },
    { header: "Cliente", key: "customer", width: 15 },
    { header: "Bruto", key: "gross", width: 14 },
    { header: "Líquido", key: "net", width: 14 },
    { header: "IVA", key: "tax", width: 12 },
    { header: "ATCUD", key: "atcud", width: 18 },
  ];
  headerStyle(ws, 1);

  for (const inv of r.saftData.sourceDocuments.salesInvoices?.invoices ?? []) {
    ws.addRow({
      no: inv.invoiceNo,
      type: inv.invoiceType,
      date: inv.invoiceDate,
      status: inv.documentStatus.invoiceStatus,
      customer: inv.customerID,
      gross: inv.documentTotals.grossTotal,
      net: inv.documentTotals.netTotal,
      tax: inv.documentTotals.taxPayable,
      atcud: inv.atcud,
    });
  }
}

function addPagamentosSheet(wb: ExcelJS.Workbook, r: AnalysisResult): void {
  const ws = wb.addWorksheet("Pagamentos");
  ws.columns = [
    { header: "Nº Recibo", key: "no", width: 20 },
    { header: "Tipo", key: "type", width: 6 },
    { header: "Data", key: "date", width: 12 },
    { header: "Estado", key: "status", width: 8 },
    { header: "Cliente", key: "customer", width: 15 },
    { header: "Bruto", key: "gross", width: 14 },
  ];
  headerStyle(ws, 1);

  for (const pay of r.saftData.sourceDocuments.payments?.payments ?? []) {
    ws.addRow({
      no: pay.paymentRefNo,
      type: pay.paymentType,
      date: pay.transactionDate,
      status: pay.documentStatus.paymentStatus,
      customer: pay.customerID,
      gross: pay.documentTotals.grossTotal,
    });
  }
}

function addMovimentosSheet(wb: ExcelJS.Workbook, r: AnalysisResult): void {
  const ws = wb.addWorksheet("Movimentos de Mercadorias");
  ws.columns = [
    { header: "Nº Documento", key: "no", width: 20 },
    { header: "Tipo", key: "type", width: 6 },
    { header: "Data", key: "date", width: 12 },
    { header: "Estado", key: "status", width: 8 },
  ];
  headerStyle(ws, 1);

  for (const sm of r.saftData.sourceDocuments.movementOfGoods?.stockMovements ?? []) {
    ws.addRow({
      no: sm.documentNumber,
      type: sm.movementType,
      date: sm.movementDate,
      status: sm.documentStatus.movementStatus,
    });
  }
}

function addDocTrabSheet(wb: ExcelJS.Workbook, r: AnalysisResult): void {
  const ws = wb.addWorksheet("Documentos de Trabalho");
  ws.columns = [
    { header: "Nº Documento", key: "no", width: 20 },
    { header: "Tipo", key: "type", width: 6 },
    { header: "Data", key: "date", width: 12 },
    { header: "Estado", key: "status", width: 8 },
    { header: "Cliente", key: "customer", width: 15 },
  ];
  headerStyle(ws, 1);

  for (const doc of r.saftData.sourceDocuments.workingDocuments?.workDocuments ?? []) {
    ws.addRow({
      no: doc.documentNumber,
      type: doc.workType,
      date: doc.workDate,
      status: doc.documentStatus.workStatus,
      customer: doc.customerID,
    });
  }
}

function addErrosSheet(wb: ExcelJS.Workbook, r: AnalysisResult): void {
  const ws = wb.addWorksheet("Erros");
  ws.columns = [
    { header: "Código", key: "code", width: 12 },
    { header: "Severidade", key: "severity", width: 12 },
    { header: "Secção", key: "section", width: 16 },
    { header: "Documento", key: "docId", width: 20 },
    { header: "Mensagem", key: "message", width: 60 },
    { header: "Caminho", key: "path", width: 40 },
    { header: "Corrigível", key: "fixable", width: 10 },
  ];
  headerStyle(ws, 1);

  for (const err of r.errors) {
    ws.addRow({
      code: err.code,
      severity: SEVERITY_LABELS[err.severity],
      section: err.section,
      docId: err.documentId ?? "",
      message: err.message,
      path: err.path,
      fixable: err.autoFixable ? "Sim" : "Não",
    });
  }
}
