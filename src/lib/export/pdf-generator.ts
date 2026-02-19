import type { TDocumentDefinitions, Content } from "pdfmake/interfaces";
import type { AnalysisResult } from "../types/analysis";
import { SEVERITY_LABELS } from "../types/errors";

export function buildPdfDefinition(result: AnalysisResult): TDocumentDefinitions {
  return {
    pageSize: "A4",
    pageMargins: [40, 60, 40, 60],
    defaultStyle: {
      fontSize: 9,
      font: "Helvetica",
    },
    header: {
      text: "SAF-T Analyzer — Relatório de Análise",
      alignment: "center",
      margin: [0, 20, 0, 0],
      fontSize: 8,
      color: "#888888",
    },
    footer: (currentPage: number, pageCount: number) => ({
      text: `Página ${currentPage} de ${pageCount} — Gerado automaticamente pelo SAF-T Analyzer`,
      alignment: "center",
      margin: [0, 20, 0, 0],
      fontSize: 7,
      color: "#888888",
    }),
    content: [
      ...buildCoverPage(result),
      { text: "", pageBreak: "after" },
      ...buildSummarySection(result),
      ...buildFinancialSection(result),
      ...buildErrorSection(result),
    ],
  };
}

function buildCoverPage(r: AnalysisResult): Content[] {
  return [
    { text: "\n\n\n\n", fontSize: 20 },
    {
      text: "Relatório de Análise SAF-T",
      fontSize: 24,
      bold: true,
      alignment: "center",
      color: "#1F2937",
    },
    { text: "\n" },
    {
      text: r.header.companyName,
      fontSize: 18,
      alignment: "center",
      color: "#374151",
    },
    { text: "\n" },
    {
      table: {
        widths: ["*", "*"],
        body: [
          [
            { text: "NIF", bold: true },
            r.header.taxRegistrationNumber,
          ],
          [
            { text: "Versão SAF-T", bold: true },
            r.saftVersion,
          ],
          [
            { text: "Período", bold: true },
            `${r.header.startDate} a ${r.header.endDate}`,
          ],
          [
            { text: "Data de Análise", bold: true },
            new Date(r.analyzedAt).toLocaleString("pt-PT"),
          ],
          [
            { text: "Score de Saúde", bold: true },
            `${r.healthScore.overall}%`,
          ],
        ],
      },
      layout: "lightHorizontalLines",
    },
  ];
}

function buildSummarySection(r: AnalysisResult): Content[] {
  return [
    {
      text: "Resumo Executivo",
      fontSize: 16,
      bold: true,
      color: "#1F2937",
      margin: [0, 0, 0, 10] as [number, number, number, number],
    },
    {
      table: {
        widths: ["*", "*", "*", "*"],
        body: [
          [
            { text: "Críticos", bold: true, alignment: "center" },
            { text: "Erros", bold: true, alignment: "center" },
            { text: "Avisos", bold: true, alignment: "center" },
            { text: "Informações", bold: true, alignment: "center" },
          ],
          [
            { text: String(r.errorSummary.bySeverity.critical), alignment: "center", color: "#DC2626" },
            { text: String(r.errorSummary.bySeverity.error), alignment: "center", color: "#EA580C" },
            { text: String(r.errorSummary.bySeverity.warning), alignment: "center", color: "#CA8A04" },
            { text: String(r.errorSummary.bySeverity.info), alignment: "center", color: "#2563EB" },
          ],
        ],
      },
      layout: "lightHorizontalLines",
      margin: [0, 0, 0, 15] as [number, number, number, number],
    },
    {
      text: `Total de erros encontrados: ${r.errorSummary.total}`,
      margin: [0, 0, 0, 5] as [number, number, number, number],
    },
    {
      text: `Integridade hash chain: ${r.hashChainResults.every((h) => h.valid) ? "Válida" : "Comprometida"}`,
      margin: [0, 0, 0, 15] as [number, number, number, number],
    },
  ];
}

function buildFinancialSection(r: AnalysisResult): Content[] {
  const content: Content[] = [
    {
      text: "Resumo Financeiro",
      fontSize: 16,
      bold: true,
      color: "#1F2937",
      margin: [0, 0, 0, 10] as [number, number, number, number],
    },
    {
      table: {
        widths: ["*", "*"],
        body: [
          [{ text: "Receita Total", bold: true }, `${r.financialSummary.totalRevenue.toFixed(2)} EUR`],
          [{ text: "Total Crédito", bold: true }, `${r.financialSummary.totalCredit.toFixed(2)} EUR`],
          [{ text: "Total Débito", bold: true }, `${r.financialSummary.totalDebit.toFixed(2)} EUR`],
        ],
      },
      layout: "lightHorizontalLines",
      margin: [0, 0, 0, 15] as [number, number, number, number],
    },
  ];

  if (r.financialSummary.vatBreakdown.length > 0) {
    content.push({
      text: "Repartição IVA",
      fontSize: 12,
      bold: true,
      margin: [0, 0, 0, 5] as [number, number, number, number],
    });
    content.push({
      table: {
        widths: ["*", "*", "*", "*"],
        body: [
          [
            { text: "Região", bold: true },
            { text: "Taxa", bold: true },
            { text: "Base", bold: true },
            { text: "Imposto", bold: true },
          ],
          ...r.financialSummary.vatBreakdown.map((v) => [
            v.taxCountryRegion,
            `${v.taxPercentage}%`,
            `${v.baseAmount.toFixed(2)}`,
            `${v.taxAmount.toFixed(2)}`,
          ]),
        ],
      },
      layout: "lightHorizontalLines",
      margin: [0, 0, 0, 15] as [number, number, number, number],
    });
  }

  if (r.financialSummary.documentTypeCounts.length > 0) {
    content.push({
      text: "Documentos por Tipo",
      fontSize: 12,
      bold: true,
      margin: [0, 0, 0, 5] as [number, number, number, number],
    });
    content.push({
      table: {
        widths: ["*", "*", "*"],
        body: [
          [
            { text: "Tipo", bold: true },
            { text: "Quantidade", bold: true },
            { text: "Total Bruto", bold: true },
          ],
          ...r.financialSummary.documentTypeCounts.map((d) => [
            d.type,
            String(d.count),
            `${d.grossTotal.toFixed(2)}`,
          ]),
        ],
      },
      layout: "lightHorizontalLines",
      margin: [0, 0, 0, 15] as [number, number, number, number],
    });
  }

  return content;
}

function buildErrorSection(r: AnalysisResult): Content[] {
  if (r.errors.length === 0) {
    return [
      {
        text: "Nenhum erro encontrado.",
        fontSize: 12,
        color: "#16A34A",
        margin: [0, 10, 0, 0] as [number, number, number, number],
      },
    ];
  }

  const content: Content[] = [
    { text: "", pageBreak: "after" },
    {
      text: "Relatório de Erros",
      fontSize: 16,
      bold: true,
      color: "#1F2937",
      margin: [0, 0, 0, 10] as [number, number, number, number],
    },
  ];

  const rows: string[][] = r.errors.slice(0, 200).map((err) => [
    err.code,
    SEVERITY_LABELS[err.severity],
    err.section,
    err.documentId ?? "-",
    err.message.substring(0, 80),
  ]);

  content.push({
    table: {
      headerRows: 1,
      widths: [50, 50, 60, 70, "*"],
      body: [
        [
          { text: "Código", bold: true },
          { text: "Severidade", bold: true },
          { text: "Secção", bold: true },
          { text: "Documento", bold: true },
          { text: "Mensagem", bold: true },
        ],
        ...rows,
      ],
    },
    layout: "lightHorizontalLines",
    fontSize: 7,
  });

  if (r.errors.length > 200) {
    content.push({
      text: `\n... e mais ${r.errors.length - 200} erros. Consulte o ficheiro Excel para a listagem completa.`,
      italics: true,
      color: "#6B7280",
    });
  }

  return content;
}
