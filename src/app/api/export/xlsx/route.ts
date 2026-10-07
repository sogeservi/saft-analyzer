import { NextRequest, NextResponse } from "next/server";
import { generateXlsx } from "@/lib/export/xlsx-generator";
import type { AnalysisResult } from "@/lib/types/analysis";
import { isRecord, readJsonBody, RequestBodyError } from "@/lib/server/request-body";
import { MAX_JSON_REQUEST_BYTES } from "@/lib/request-limits";
import { guardReportRequest } from "@/lib/server/report-request-guard";

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

    const buffer = await generateXlsx(result);
    try {
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": 'attachment; filename="saft-analysis.xlsx"',
          "Cache-Control": "no-store, max-age=0",
        },
      });
    } finally {
      buffer.fill(0);
    }
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      { error: "Could not generate spreadsheet." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
