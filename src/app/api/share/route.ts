import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { tempStore } from "@/lib/store/temp-store";
import type { AnalysisResult } from "@/lib/types/analysis";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const result = (await request.json()) as AnalysisResult;

    const uuid = uuidv4();
    const { createdAt, expiresAt } = await tempStore.set(uuid, result);

    return NextResponse.json({
      uuid,
      url: `/share/${uuid}`,
      createdAt,
      expiresAt,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao criar link de partilha.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const uuid = url.searchParams.get("uuid");

  if (!uuid) {
    return NextResponse.json(
      { error: "UUID em falta." },
      { status: 400 },
    );
  }

  const entry = await tempStore.get(uuid);
  if (!entry) {
    return NextResponse.json(
      { error: "Link expirado ou não encontrado." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    result: entry.result,
    createdAt: entry.createdAt,
    expiresAt: entry.expiresAt,
  });
}
