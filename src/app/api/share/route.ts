import { NextRequest, NextResponse } from "next/server";
import type { AnalysisResult } from "@/lib/types/analysis";
import { MAX_JSON_REQUEST_BYTES } from "@/lib/request-limits";
import { isRecord, readJsonBody, RequestBodyError } from "@/lib/server/request-body";
import { createShare } from "@/lib/server/share-store";
import { guardReportRequest } from "@/lib/server/report-request-guard";

function isAnalysisResult(value: unknown): value is AnalysisResult {
  if (!isRecord(value) || !isRecord(value.header)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.fileName === "string" &&
    typeof value.analyzedAt === "string" &&
    isRecord(value.saftData) &&
    isRecord(value.financialSummary) &&
    Array.isArray(value.errors) &&
    Array.isArray(value.hashChainResults) &&
    isRecord(value.errorSummary) &&
    isRecord(value.healthScore) &&
    Array.isArray(value.xsdErrors)
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = guardReportRequest(request);
  if (guard.response) return guard.response;
  try {
    const value: unknown = await readJsonBody(request, MAX_JSON_REQUEST_BYTES);
    if (!isAnalysisResult(value)) {
      return NextResponse.json(
        { error: "Dados de análise inválidos." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const serialized = JSON.stringify(value);
    const share = createShare(serialized, guard.ipKey);
    if (!share.ok) {
      if (share.reason === "share-too-large") {
        return NextResponse.json(
          { error: "Cada ligação partilhada pode conter no máximo 10 MiB." },
          { status: 413, headers: { "Cache-Control": "no-store" } },
        );
      }
      if (share.reason === "ip-share-limit") {
        return NextResponse.json(
          { error: "Este endereço IP já tem 10 ligações ativas." },
          { status: 429, headers: { "Cache-Control": "no-store" } },
        );
      }
      return NextResponse.json(
        { error: "Não foi possível criar um link agora. Tente novamente mais tarde." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      { url: `/share/${share.id}`, expiresAt: share.expiresAt },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      { error: "Não foi possível criar o link de partilha." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
