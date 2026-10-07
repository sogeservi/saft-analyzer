import { parseSaftStream } from "@/lib/parser/stream-parser";
import { detectEncoding, detectXmlDeclaredEncoding } from "@/lib/parser/encoding";
import { runValidation } from "@/lib/validators/engine";
import type { AnalysisResult } from "@/lib/types/analysis";

export class UnsupportedSaftBasisError extends Error {
  constructor(readonly basis: string) {
    super("Unsupported SAF-T accounting basis.");
    this.name = "UnsupportedSaftBasisError";
  }
}

export async function processSaftBuffer(
  rawBuffer: Buffer,
  fileName: string,
): Promise<AnalysisResult> {
  let decodedBuffer: Buffer | undefined;
  try {
    const encodingResult = detectEncoding(rawBuffer);
    const xmlStart = rawBuffer.toString(
      "utf-8",
      0,
      Math.min(rawBuffer.length, 2000),
    );
    const declaredEncoding = detectXmlDeclaredEncoding(xmlStart);

    let buffer = rawBuffer;
    const legacyEncodings = new Set([
      "WINDOWS-1252",
      "ISO-8859-1",
      "ISO-8859-15",
      "LATIN1",
      "LATIN-1",
    ]);
    if (
      declaredEncoding &&
      legacyEncodings.has(declaredEncoding.toUpperCase())
    ) {
      const decoded = new TextDecoder(declaredEncoding).decode(rawBuffer);
      const reEncoded = decoded.replace(
        /encoding=["'][^"']+["']/,
        'encoding="UTF-8"',
      );
      decodedBuffer = Buffer.from(reEncoded, "utf-8");
      buffer = decodedBuffer;
    }

    const saftData = await parseSaftStream(buffer);
    if (buffer !== rawBuffer) buffer.fill(0);

    const invoicingBases = new Set(["F", "S", "P", "R", "T"]);
    const basis = saftData.header.taxAccountingBasis;
    if (basis && !invoicingBases.has(basis)) {
      throw new UnsupportedSaftBasisError(basis);
    }

    const result = runValidation(saftData, fileName, rawBuffer.length);
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

    result.errorSummary.total = result.errors.length;
    for (const error of result.errors) {
      if (error.code !== "XML_002" && error.code !== "XML_003") continue;
      result.errorSummary.bySeverity[error.severity] =
        (result.errorSummary.bySeverity[error.severity] ?? 0) + 1;
      result.errorSummary.byCode[error.code] =
        (result.errorSummary.byCode[error.code] ?? 0) + 1;
      result.errorSummary.bySection["XML"] =
        (result.errorSummary.bySection["XML"] ?? 0) + 1;
    }

    return result;
  } finally {
    decodedBuffer?.fill(0);
    rawBuffer.fill(0);
  }
}
