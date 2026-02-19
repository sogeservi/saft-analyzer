import { NextRequest, NextResponse } from "next/server";
import { generateXlsx } from "@/lib/export/xlsx-generator";
import type { AnalysisResult } from "@/lib/types/analysis";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const result = (await request.json()) as AnalysisResult;

    const buffer = await generateXlsx(result);

    const fileName = `saft-analise-${result.header.taxRegistrationNumber}-${result.header.fiscalYear}.xlsx`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao gerar Excel.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
