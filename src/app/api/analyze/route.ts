import { NextRequest, NextResponse } from "next/server";
import { parseSaftStream } from "@/lib/parser/stream-parser";
import { detectEncoding, detectXmlDeclaredEncoding } from "@/lib/parser/encoding";
import { runValidation } from "@/lib/validators/engine";
import { startHotReload } from "@/lib/config/rule-loader";

startHotReload();

export async function POST(request: NextRequest): Promise<NextResponse> {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json(
      { error: "Nenhum ficheiro enviado." },
      { status: 400 },
    );
  }

  if (!file.name.toLowerCase().endsWith(".xml")) {
    return NextResponse.json(
      { error: "Formato inválido. Apenas ficheiros .xml são aceites." },
      { status: 400 },
    );
  }

  try {
    const rawBuffer = Buffer.from(await file.arrayBuffer());

    const encodingResult = detectEncoding(rawBuffer);
    const xmlStart = rawBuffer.toString("utf-8", 0, Math.min(rawBuffer.length, 2000));
    const declaredEncoding = detectXmlDeclaredEncoding(xmlStart);

    let buffer = rawBuffer;
    const LEGACY_ENCODINGS = new Set([
      "WINDOWS-1252", "ISO-8859-1", "ISO-8859-15", "LATIN1", "LATIN-1",
    ]);
    if (declaredEncoding && LEGACY_ENCODINGS.has(declaredEncoding.toUpperCase())) {
      const decoded = new TextDecoder(declaredEncoding).decode(rawBuffer);
      const reEncoded = decoded.replace(
        /encoding=["'][^"']+["']/,
        'encoding="UTF-8"',
      );
      buffer = Buffer.from(reEncoded, "utf-8");
    }

    const saftData = await parseSaftStream(buffer);

    const INVOICING_BASES = new Set(["F", "S", "P", "R", "T"]);
    const basis = saftData.header.taxAccountingBasis;
    if (basis && !INVOICING_BASES.has(basis)) {
      const basisLabels: Record<string, string> = {
        C: "Contabilidade",
        E: "Contabilidade e Faturação (exportação)",
        I: "Contabilidade Integrada",
      };
      const basisLabel = basisLabels[basis] ?? basis;
      return NextResponse.json(
        {
          error: `Este ficheiro SAF-T é do tipo "${basisLabel}" (TaxAccountingBasis="${basis}"). Apenas ficheiros de faturação (F, S, P, R, T) são aceites.`,
        },
        { status: 400 },
      );
    }

    const result = runValidation(saftData, file.name, file.size);

    // Add encoding info as warnings if mismatch
    if (
      declaredEncoding &&
      encodingResult.encoding !== "ascii" &&
      declaredEncoding.toLowerCase().replace("-", "") !==
        encodingResult.encoding.replace("-", "")
    ) {
      result.errors.unshift({
        code: "XML_002",
        severity: "error",
        message: `Encoding declarado '${declaredEncoding}' difere do encoding detetado '${encodingResult.encoding}'.`,
        explanation:
          "O encoding da declaração XML não corresponde ao encoding real do ficheiro.",
        path: "XML Declaration",
        section: "XML",
        autoFixable: false,
      });
    }

    if (encodingResult.hasBOM && encodingResult.encoding === "utf-8") {
      result.errors.unshift({
        code: "XML_003",
        severity: "warning",
        message:
          "Ficheiro UTF-8 com BOM detetado. Alguns parsers podem ter problemas.",
        explanation:
          "Ficheiros UTF-8 com BOM são tecnicamente válidos mas podem causar problemas em alguns sistemas.",
        path: "File",
        section: "XML",
        autoFixable: false,
      });
    }

    // Recalculate error summary after adding XML errors
    result.errorSummary.total = result.errors.length;
    for (const err of result.errors) {
      if (err.section === "XML") {
        result.errorSummary.bySection["XML"] =
          (result.errorSummary.bySection["XML"] ?? 0) + 1;
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Erro desconhecido ao processar o ficheiro.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}