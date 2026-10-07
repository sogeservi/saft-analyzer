import { NextRequest, NextResponse } from "next/server";
import { acceptAnalysisChunk } from "@/lib/server/analysis-queue";
import { getClientIpKey } from "@/lib/server/client-ip";
import { RequestBodyError, readRequestBody } from "@/lib/server/request-body";
import { MAX_UPLOAD_CHUNK_BYTES } from "@/lib/request-limits";

interface RouteContext {
  params: Promise<{ jobId: string }>;
}

export async function POST(
  request: NextRequest,
  { params }: RouteContext,
): Promise<NextResponse> {
  const ipKey = getClientIpKey(request);
  if (!ipKey) {
    return NextResponse.json(
      { error: "Não foi possível validar o endereço IP desta ligação." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { jobId } = await params;
  const indexValue = new URL(request.url).searchParams.get("index");
  const index = indexValue === null ? Number.NaN : Number(indexValue);
  if (!Number.isSafeInteger(index) || index < 0) {
    return NextResponse.json(
      { error: "Número de bloco inválido." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  let chunk: Buffer | undefined;
  try {
    chunk = await readRequestBody(
      request,
      MAX_UPLOAD_CHUNK_BYTES,
      "application/octet-stream",
    );
    const result = acceptAnalysisChunk(jobId, ipKey, index, chunk);
    if (!result.ok) {
      chunk.fill(0);
      const status =
        result.reason === "not-found"
          ? 404
          : result.reason === "not-admitted"
            ? 409
            : 400;
      return NextResponse.json(
        { error: "O bloco enviado é inválido ou já não é esperado." },
        { status, headers: { "Cache-Control": "no-store" } },
      );
    }

    chunk = undefined;
    return NextResponse.json(
      { receivedBytes: result.receivedBytes },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    chunk?.fill(0);
    if (error instanceof RequestBodyError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      { error: "Não foi possível receber este bloco." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
