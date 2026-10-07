import { NextRequest, NextResponse } from "next/server";
import { XmlParseError } from "@/lib/parser/stream-parser";
import { beginAnalysis, finishAnalysisJob } from "@/lib/server/analysis-queue";
import { getClientIpKey } from "@/lib/server/client-ip";
import {
  processSaftBuffer,
  UnsupportedSaftBasisError,
} from "@/lib/server/process-saft";

interface RouteContext {
  params: Promise<{ jobId: string }>;
}

function basisLabel(basis: string): string {
  const labels: Record<string, string> = {
    C: "Contabilidade",
    E: "Contabilidade e Faturação (exportação)",
    I: "Contabilidade Integrada",
  };
  return labels[basis] ?? basis;
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
  const begun = beginAnalysis(jobId, ipKey);
  if (!begun.ok) {
    const status =
      begun.reason === "not-found"
        ? 404
        : begun.reason === "upload-incomplete"
          ? 409
          : 409;
    return NextResponse.json(
      {
        error:
          begun.reason === "upload-incomplete"
            ? "O carregamento ainda não terminou."
            : "A análise não está disponível para processamento.",
      },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }

  const file = begun.file;
  try {
    const result = await processSaftBuffer(file, begun.fileName);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    if (error instanceof UnsupportedSaftBasisError) {
      return NextResponse.json(
        {
          error: `Este ficheiro SAF-T é do tipo "${basisLabel(error.basis)}" (TaxAccountingBasis="${error.basis}"). Apenas ficheiros de faturação (F, S, P, R, T) são aceites.`,
        },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (error instanceof XmlParseError) {
      return NextResponse.json(
        {
          code: "XML_PARSE_ERROR",
          message: error.message,
          line: error.line,
          column: error.column,
        },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      { error: "Não foi possível processar este ficheiro SAF-T." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  } finally {
    file.fill(0);
    finishAnalysisJob(jobId, ipKey);
  }
}
