import { NextRequest, NextResponse } from "next/server";
import PdfPrinter from "pdfmake";
import { buildPdfDefinition } from "@/lib/export/pdf-generator";
import type { AnalysisResult } from "@/lib/types/analysis";
import { isRecord, readJsonBody, RequestBodyError } from "@/lib/server/request-body";
import { MAX_JSON_REQUEST_BYTES } from "@/lib/request-limits";
import { guardReportRequest } from "@/lib/server/report-request-guard";

const fonts = {
  Helvetica: {
    normal: "Helvetica",
    bold: "Helvetica-Bold",
    italics: "Helvetica-Oblique",
    bolditalics: "Helvetica-BoldOblique",
  },
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = guardReportRequest(request);
  if (guard.response) return guard.response;
  try {
    const payload: unknown = await readJsonBody(request, MAX_JSON_REQUEST_BYTES);
    if (
      !isRecord(payload) ||
      !isRecord(payload.header) ||
      !isRecord(payload.saftData)
    ) {
      return NextResponse.json(
        { error: "Invalid analysis result." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    const result = payload as unknown as AnalysisResult;

    const docDefinition = buildPdfDefinition(result);
    const printer = new PdfPrinter(fonts);
    const pdfDoc = printer.createPdfKitDocument(docDefinition);

    const chunks: Uint8Array[] = [];
    let pdfBuffer: Buffer | undefined;
    try {
      pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
        pdfDoc.on("data", (chunk: Uint8Array) => chunks.push(chunk));
        pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
        pdfDoc.on("error", reject);
        pdfDoc.end();
      });

      return new NextResponse(new Uint8Array(pdfBuffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'attachment; filename="saft-analysis.pdf"',
          "Cache-Control": "no-store, max-age=0",
        },
      });
    } finally {
      for (const chunk of chunks) chunk.fill(0);
      pdfBuffer?.fill(0);
    }
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      { error: "Could not generate PDF." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
