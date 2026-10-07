import { NextRequest, NextResponse } from "next/server";
import {
  cancelAnalysisJob,
  getAnalysisJobStatus,
} from "@/lib/server/analysis-queue";
import { getClientIpKey } from "@/lib/server/client-ip";

interface RouteContext {
  params: Promise<{ jobId: string }>;
}

export async function GET(
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
  const status = getAnalysisJobStatus(jobId, ipKey);
  if (!status) {
    return NextResponse.json(
      { error: "A análise já não está disponível." },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json(status, {
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

export async function DELETE(
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
  cancelAnalysisJob(jobId, ipKey);
  return new NextResponse(null, {
    status: 204,
    headers: { "Cache-Control": "no-store" },
  });
}
