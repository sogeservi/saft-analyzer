import { NextRequest, NextResponse } from "next/server";
import type { ValidationError } from "@/lib/types/errors";
import type { SaftFile } from "@/lib/types/saft";
import { generateFixes, buildPatchDocument } from "@/lib/fixes/fix-engine";
import { patchToJson } from "@/lib/fixes/patch-generator";

interface FixRequest {
  fileName: string;
  saftData: SaftFile;
  selectedErrorCodes: string[];
  errors: ValidationError[];
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as FixRequest;

    const selectedErrors = body.errors.filter(
      (e) =>
        e.autoFixable && body.selectedErrorCodes.includes(e.code + "|" + e.path),
    );

    const fixes = generateFixes(body.saftData, selectedErrors);
    const patch = buildPatchDocument(body.fileName, fixes);
    const json = patchToJson(patch);

    const fileName = `saft-correcoes-${body.fileName.replace(".xml", "")}.json`;

    return new NextResponse(json, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erro ao gerar correções.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
