import { NextRequest, NextResponse } from "next/server";
import type { ValidationError } from "@/lib/types/errors";
import type { SaftFile } from "@/lib/types/saft";
import { generateFixes, buildPatchDocument } from "@/lib/fixes/fix-engine";
import { patchToJson } from "@/lib/fixes/patch-generator";
import { isRecord, readJsonBody, RequestBodyError } from "@/lib/server/request-body";
import { MAX_JSON_REQUEST_BYTES } from "@/lib/request-limits";
import { guardReportRequest } from "@/lib/server/report-request-guard";

interface FixRequest {
  fileName: string;
  saftData: SaftFile;
  selectedErrorCodes: string[];
  errors: ValidationError[];
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = guardReportRequest(request);
  if (guard.response) return guard.response;
  try {
    const payload: unknown = await readJsonBody(request, MAX_JSON_REQUEST_BYTES);
    if (
      !isRecord(payload) ||
      !isRecord(payload.saftData) ||
      !Array.isArray(payload.errors) ||
      !Array.isArray(payload.selectedErrorCodes) ||
      typeof payload.fileName !== "string"
    ) {
      return NextResponse.json(
        { error: "Invalid fix request." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    const body = payload as unknown as FixRequest;

    const selectedErrors = body.errors.filter(
      (e) =>
        e.autoFixable && body.selectedErrorCodes.includes(e.code + "|" + e.path),
    );

    const fixes = generateFixes(body.saftData, selectedErrors);
    const patch = buildPatchDocument("saft-upload.xml", fixes);
    const json = patchToJson(patch);

    const responseBody = Buffer.from(json, "utf-8");
    try {
      return new NextResponse(new Uint8Array(responseBody), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": 'attachment; filename="saft-fixes.json"',
          "Cache-Control": "no-store, max-age=0",
        },
      });
    } finally {
      responseBody.fill(0);
    }
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: { "Cache-Control": "no-store" } },
      );
    }
    return NextResponse.json(
      { error: "Could not generate fixes." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
