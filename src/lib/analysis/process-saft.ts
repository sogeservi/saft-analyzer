import { parseSaftStream, type ProgressCallback } from "@/lib/parser/stream-parser";
import { detectEncoding, detectXmlDeclaredEncoding } from "@/lib/parser/encoding";
import { runValidation } from "@/lib/validators/engine";
import type { AnalysisProgress, AnalysisResult } from "@/lib/types/analysis";

export class UnsupportedSaftBasisError extends Error {
  constructor(readonly basis: string) {
    super("Unsupported SAF-T accounting basis.");
    this.name = "UnsupportedSaftBasisError";
  }
}

const LEGACY_ENCODINGS = new Set([
  "WINDOWS-1252",
  "ISO-8859-1",
  "ISO-8859-15",
  "LATIN1",
  "LATIN-1",
]);

function decoderName(encoding: string): string {
  const normalized = encoding.toUpperCase();
  if (normalized === "UTF-16-BE" || normalized === "UTF-16-LE") {
    return normalized.toLowerCase();
  }
  if (normalized === "ASCII" || normalized === "UTF-8") return "utf-8";
  if (normalized === "ISO-8859-15") return "ISO-8859-15";
  if (normalized === "ISO-8859-1" || normalized === "LATIN1" || normalized === "LATIN-1") {
    return "windows-1252";
  }
  return encoding;
}

export async function processSaftFile(
  file: File,
  onProgress?: ProgressCallback,
): Promise<AnalysisResult> {
  const sample = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
  const encodingResult = detectEncoding(sample);
  const initialDecoder = new TextDecoder(decoderName(encodingResult.encoding));
  const declaredEncoding = detectXmlDeclaredEncoding(initialDecoder.decode(sample));
  const legacyEncoding = declaredEncoding && LEGACY_ENCODINGS.has(declaredEncoding);
  const selectedEncoding = legacyEncoding
    ? decoderName(declaredEncoding)
    : decoderName(encodingResult.encoding);
  sample.fill(0);

  const parseProgress: ProgressCallback = (progress: AnalysisProgress) => {
    onProgress?.({
      ...progress,
      percentage: progress.phase === "complete"
        ? 30
        : Math.min(30, Math.round(progress.percentage * 0.3)),
    });
  };
  const saftData = await parseSaftStream(file.stream(), parseProgress, selectedEncoding);

  const invoicingBases = new Set(["F", "S", "P", "R", "T"]);
  const basis = saftData.header.taxAccountingBasis;
  if (basis && !invoicingBases.has(basis)) {
    throw new UnsupportedSaftBasisError(basis);
  }

  const result = runValidation(saftData, file.name, file.size, (progress) => {
    onProgress?.({
      ...progress,
      percentage: 30 + Math.round(progress.percentage * 0.7),
    });
  });

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
    result.errorSummary.bySection.XML =
      (result.errorSummary.bySection.XML ?? 0) + 1;
  }

  onProgress?.({ phase: "complete", percentage: 100, errorsFound: result.errors.length });
  return result;
}
