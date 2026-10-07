import type {
  Content,
  CustomTableLayout,
  TDocumentDefinitions,
} from "pdfmake/interfaces";
import type { AnalysisResult } from "../types/analysis";
import { APP_BUILD_INFO } from "../build-info";
import {
  ACTIVITY_PERIOD_LABELS,
  groupFinancialActivity,
} from "../financial-activity";
import { formatCurrency, formatNumber } from "../format";
import { SEVERITY_LABELS } from "../types/errors";

const BODY_WIDTH = 531;
const TABLE_LAYOUT: CustomTableLayout = {
  hLineWidth: (index, node) =>
    index === 0 || index === node.table.body.length ? 0.6 : 0.25,
  vLineWidth: () => 0,
  hLineColor: () => "#DDE4EA",
  paddingLeft: () => 5,
  paddingRight: () => 5,
  paddingTop: () => 3,
  paddingBottom: () => 3,
};

function textCell(text: string, bold = false): { text: string; bold: boolean } {
  return { text, bold };
}

function compact(value: string | undefined, maxLength = 64): string {
  if (!value) return "-";
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

function buildActivityChart(result: AnalysisResult): Content[] {
  const { period, buckets } = groupFinancialActivity(result.financialSummary.dayStats);
  if (buckets.length === 0) {
    return [{ text: "Sem atividade financeira por data neste período.", color: "#64748B", fontSize: 8 }];
  }

  const visible = buckets.slice(-12);
  const maxTotal = Math.max(1, ...visible.map((bucket) => Math.max(0, bucket.grossTotal)));
  const width = 531;
  const height = 118;
  const plotTop = 8;
  const plotHeight = 76;
  const slot = width / visible.length;
  const barWidth = Math.max(4, Math.min(22, slot * 0.6));
  const bars = visible.map((bucket, index) => {
    const barHeight = Math.max(1, (Math.max(0, bucket.grossTotal) / maxTotal) * plotHeight);
    const x = index * slot + (slot - barWidth) / 2;
    const y = plotTop + plotHeight - barHeight;
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barHeight.toFixed(1)}" rx="2" fill="#0891B2"/>`;
  }).join("");
  const labels = visible.map((bucket, index) => {
    const x = (index * slot + slot / 2).toFixed(1);
    const label = compact(bucket.label, visible.length > 8 ? 7 : 12);
    return `<text x="${x}" y="108" text-anchor="middle" font-family="Helvetica" font-size="8" fill="#475569">${escapeXml(label)}</text>`;
  }).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><path d="M0 ${plotTop + plotHeight} H${width}" stroke="#CBD5E1" stroke-width="1"/><path d="M0 ${plotTop + plotHeight / 2} H${width}" stroke="#E2E8F0" stroke-width="1"/>${bars}${labels}</svg>`;

  const periodRows = visible.map((bucket) => [
    compact(bucket.label, 22),
    formatCurrency(bucket.grossTotal),
    formatNumber(bucket.documentCount),
  ]);
  const remaining = buckets.length - visible.length;

  return [
    {
      text: `Atividade por ${ACTIVITY_PERIOD_LABELS[period]}${buckets.length > visible.length ? ` - ${visible.length} períodos mais recentes de ${buckets.length}` : ""}`,
      style: "sectionTitle",
      margin: [0, 7, 0, 2],
    },
    { svg, width: BODY_WIDTH, height: 118, margin: [0, 0, 0, 2] },
    {
      table: {
        headerRows: 1,
        widths: ["*", 105, 70],
        body: [
          [textCell("Período", true), textCell("Total bruto", true), textCell("Documentos", true)],
          ...periodRows,
        ],
      },
      layout: TABLE_LAYOUT,
      fontSize: 7,
    },
    ...(remaining > 0
      ? [{ text: `Os ${remaining} períodos anteriores estão incluídos na folha Atividade do Excel.`, fontSize: 7, color: "#64748B", margin: [0, 2, 0, 0] } as Content]
      : []),
  ];
}

function escapeXml(value: string): string {
  return value.replace(/[<>&"']/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    '"': "&quot;",
    "'": "&apos;",
  })[character] ?? character);
}

function buildMetadataTable(result: AnalysisResult): Content {
  const address = result.header.companyAddress;
  const companyAddress = [
    address?.addressDetail,
    address?.city,
    address?.postalCode,
    address?.country,
  ].filter(Boolean).join(", ");
  const exporter = [result.header.productID, result.header.productVersion].filter(Boolean).join(" ");
  return {
    table: {
      widths: [105, "*", 95, "*"],
      body: [
        [textCell("SAF-T", true), result.saftType === "complete" ? "Completo" : "Parcial", textCell("Versão", true), result.saftVersion],
        [textCell("Período", true), `${result.header.startDate} a ${result.header.endDate}`, textCell("Analisado", true), new Date(result.analyzedAt).toLocaleString("pt-PT")],
        [textCell("Empresa", true), compact(result.header.companyName), textCell("Nome comercial", true), compact(result.header.businessName)],
        [textCell("NIF", true), result.header.taxRegistrationNumber, textCell("ID da empresa", true), compact(result.header.companyID)],
        [textCell("Morada", true), compact(companyAddress), textCell("Software exportador", true), compact(exporter)],
        [textCell("NIF do produtor", true), compact(result.header.productCompanyTaxID), textCell("Certificado", true), compact(result.header.softwareCertificateNumber)],
      ],
    },
    layout: TABLE_LAYOUT,
    fontSize: 7.5,
  };
}

function buildMetricTable(result: AnalysisResult): Content {
  const counts = result.errorSummary.bySeverity;
  return {
    table: {
      widths: ["*", "*", "*", "*", "*", "*", "*"],
      body: [
        [textCell("Receita", true), textCell("Crédito", true), textCell("Débito", true), textCell("Críticos", true), textCell("Erros", true), textCell("Avisos", true), textCell("Saúde", true)],
        [
          formatCurrency(result.financialSummary.totalRevenue),
          formatCurrency(result.financialSummary.totalCredit),
          formatCurrency(result.financialSummary.totalDebit),
          String(counts.critical),
          String(counts.error),
          String(counts.warning),
          `${result.healthScore.overall}%`,
        ],
      ],
    },
    layout: TABLE_LAYOUT,
    margin: [0, 7, 0, 0],
    fontSize: 8,
  };
}

function buildSupportingDetails(result: AnalysisResult): Content[] {
  const content: Content[] = [{ text: "Detalhe financeiro e validação", style: "sectionTitle", pageBreak: "before" }];
  const vat = result.financialSummary.vatBreakdown.slice(0, 8);
  if (vat.length > 0) {
    content.push({ text: "IVA por taxa", style: "subsectionTitle" });
    content.push({
      table: {
        headerRows: 1,
        widths: ["*", 48, 92, 92, 55],
        body: [
          [textCell("Região", true), textCell("Taxa", true), textCell("Base", true), textCell("IVA", true), textCell("Docs", true)],
          ...vat.map((entry) => [entry.taxCountryRegion, `${entry.taxPercentage}%`, formatCurrency(entry.baseAmount), formatCurrency(entry.taxAmount), formatNumber(entry.documentCount)]),
        ],
      },
      layout: TABLE_LAYOUT,
      fontSize: 7,
    });
  }

  const documentTypes = result.financialSummary.documentTypeCounts.slice(0, 8);
  if (documentTypes.length > 0) {
    content.push({ text: "Documentos por tipo", style: "subsectionTitle" });
    content.push({
      table: {
        headerRows: 1,
        widths: ["*", 70, 120],
        body: [
          [textCell("Tipo", true), textCell("Quantidade", true), textCell("Total bruto", true)],
          ...documentTypes.map((entry) => [compact(entry.type, 40), formatNumber(entry.count), formatCurrency(entry.grossTotal)]),
        ],
      },
      layout: TABLE_LAYOUT,
      fontSize: 7,
    });
  }

  const topErrors = result.errorSummary.topErrors.slice(0, 8);
  if (topErrors.length > 0) {
    content.push({ text: "Erros mais frequentes", style: "subsectionTitle" });
    content.push({
      table: {
        headerRows: 1,
        widths: [58, 55, 38, "*"],
        body: [
          [textCell("Código", true), textCell("Severidade", true), textCell("Qtd.", true), textCell("Descrição", true)],
          ...topErrors.map((error) => {
            const matchingError = result.errors.find(
              (entry) => entry.code === error.code && entry.severity !== "info",
            );
            return [
              error.code,
              SEVERITY_LABELS[matchingError?.severity ?? "info"],
              formatNumber(error.count),
              compact(error.message, 88),
            ];
          }),
        ],
      },
      layout: TABLE_LAYOUT,
      fontSize: 7,
    });
    const remaining = result.errorSummary.total - topErrors.reduce((sum, error) => sum + error.count, 0);
    if (remaining > 0) {
      content.push({ text: `Outros erros: ${formatNumber(remaining)}. A listagem completa está no Excel.`, fontSize: 7, color: "#64748B", margin: [0, 3, 0, 0] });
    }
  } else {
    content.push({ text: "Sem erros de validação registados.", color: "#15803D", fontSize: 8 });
  }

  content.push({
    text: `Cadeia de hash: ${result.hashChainResults.every((entry) => entry.valid) ? "válida" : "com falhas"}  |  XSD: ${result.xsdValid ? "válido" : "inválido"}`,
    fontSize: 7,
    color: "#475569",
    margin: [0, 8, 0, 0],
  });
  return content;
}

export function buildPdfDefinition(result: AnalysisResult): TDocumentDefinitions {
  return {
    pageSize: "A4",
    pageMargins: [32, 42, 32, 36],
    defaultStyle: { fontSize: 8, font: "Helvetica", color: "#1F2937" },
    styles: {
      title: { fontSize: 16, bold: true, color: "#0F172A" },
      sectionTitle: { fontSize: 11, bold: true, color: "#0F172A", margin: [0, 8, 0, 4] },
      subsectionTitle: { fontSize: 9, bold: true, color: "#334155", margin: [0, 8, 0, 3] },
    },
    header: {
      text: `SAF-T Analyzer  |  App ${APP_BUILD_INFO.version}  |  ${APP_BUILD_INFO.date}`,
      alignment: "right",
      margin: [32, 16, 32, 0],
      fontSize: 7,
      color: "#64748B",
    },
    footer: (currentPage: number, pageCount: number) => ({
      text: `Página ${currentPage} de ${pageCount}  |  SAF-T Analyzer`,
      alignment: "center",
      margin: [0, 12, 0, 0],
      fontSize: 7,
      color: "#64748B",
    }),
    content: [
      {
        columns: [
          { text: "Relatório de análise SAF-T", style: "title", width: "*" },
          { text: `${compact(result.header.companyName, 55)}\n${result.header.taxRegistrationNumber}`, alignment: "right", fontSize: 8, width: 180 },
        ],
        margin: [0, 0, 0, 7],
      },
      buildMetadataTable(result),
      buildMetricTable(result),
      ...buildActivityChart(result),
      ...buildSupportingDetails(result),
    ],
    info: {
      title: `Análise SAF-T - ${result.header.companyName}`,
      author: "SAF-T Analyzer",
      subject: `Versão ${APP_BUILD_INFO.version}`,
      keywords: "SAF-T, análise, validação",
    },
  };
}
