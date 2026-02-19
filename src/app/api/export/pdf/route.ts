import { NextRequest, NextResponse } from "next/server";
import PdfPrinter from "pdfmake";
import { buildPdfDefinition } from "@/lib/export/pdf-generator";
import type { AnalysisResult } from "@/lib/types/analysis";

const fonts = {
  Helvetica: {
    normal: "Helvetica",
    bold: "Helvetica-Bold",
    italics: "Helvetica-Oblique",
    bolditalics: "Helvetica-BoldOblique",
  },
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const result = (await request.json()) as AnalysisResult;

    const docDefinition = buildPdfDefinition(result);
    const printer = new PdfPrinter(fonts);
    const pdfDoc = printer.createPdfKitDocument(docDefinition);

    const chunks: Uint8Array[] = [];
    const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
      pdfDoc.on("data", (chunk: Uint8Array) => chunks.push(chunk));
      pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
      pdfDoc.on("error", reject);
      pdfDoc.end();
    });

    const fileName = `saft-relatorio-${result.header.taxRegistrationNumber}-${result.header.fiscalYear}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao gerar PDF.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
