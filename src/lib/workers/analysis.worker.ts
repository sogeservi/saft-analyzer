import { processSaftFile, UnsupportedSaftBasisError } from "@/lib/analysis/process-saft";
import { XmlParseError } from "@/lib/parser/stream-parser";
import type { AnalysisProgress, AnalysisResult } from "@/lib/types/analysis";

interface AnalysisRequest {
  file: File;
}

type AnalysisResponse =
  | { type: "progress"; progress: AnalysisProgress }
  | { type: "complete"; result: AnalysisResult }
  | {
      type: "error";
      message: string;
      code?: "XML_PARSE_ERROR" | "UNSUPPORTED_BASIS";
      line?: number;
      column?: number;
      basis?: string;
    };

self.onmessage = async (event: MessageEvent<AnalysisRequest>) => {
  const respond = (response: AnalysisResponse) => self.postMessage(response);
  try {
    const result = await processSaftFile(event.data.file, (progress) => {
      respond({ type: "progress", progress });
    });
    respond({ type: "complete", result });
  } catch (error) {
    if (error instanceof XmlParseError) {
      respond({
        type: "error",
        code: "XML_PARSE_ERROR",
        message: error.message,
        line: error.line,
        column: error.column,
      });
      return;
    }
    if (error instanceof UnsupportedSaftBasisError) {
      respond({ type: "error", code: "UNSUPPORTED_BASIS", message: error.message, basis: error.basis });
      return;
    }
    respond({
      type: "error",
      message: error instanceof Error ? error.message : "Could not process this SAF-T file.",
    });
  }
};
