import { NextRequest, NextResponse } from "next/server";
import { ANALYSIS_QUEUE_LIMITS, createAnalysisJob } from "@/lib/server/analysis-queue";
import { getClientIpKey } from "@/lib/server/client-ip";
import { isRecord, readJsonBody, RequestBodyError } from "@/lib/server/request-body";
import { MAX_JSON_REQUEST_BYTES, MAX_SAFT_UPLOAD_BYTES } from "@/lib/request-limits";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ipKey = getClientIpKey(request);
  if (!ipKey) {
    return NextResponse.json(
      { error: "Não foi possível validar o endereço IP desta ligação." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const body: unknown = await readJsonBody(request, MAX_JSON_REQUEST_BYTES);
    if (
      !isRecord(body) ||
      typeof body.fileName !== "string" ||
      typeof body.fileSize !== "number" ||
      !Number.isSafeInteger(body.fileSize) ||
      body.fileSize <= 0
    ) {
      return NextResponse.json(
        { error: "Indique um nome e tamanho de ficheiro válidos." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (body.fileSize > MAX_SAFT_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: "O limite por ficheiro é 100 MiB." },
        { status: 413, headers: { "Cache-Control": "no-store" } },
      );
    }

    const created = createAnalysisJob(ipKey, body.fileName, body.fileSize);
    if (!created.ok) {
      const isIpActive = created.reason === "ip-active";
      return NextResponse.json(
        {
          error: isIpActive
            ? "Já existe uma análise sua ativa ou em fila."
            : "A fila está cheia. Tente novamente dentro de momentos.",
        },
        {
          status: isIpActive ? 429 : 503,
          headers: { "Cache-Control": "no-store", "Retry-After": "30" },
        },
      );
    }

    return NextResponse.json(
      {
        jobId: created.id,
        ...created.status,
        queueLimit: ANALYSIS_QUEUE_LIMITS.maxConcurrent,
      },
      { status: 202, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      { error: "Não foi possível iniciar a análise deste ficheiro." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
