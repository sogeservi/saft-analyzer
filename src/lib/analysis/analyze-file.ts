import type { AnalysisProgress, AnalysisResult } from "@/lib/types/analysis";

interface AnalysisWorkerResponse {
  type: "progress" | "complete" | "error";
  progress?: AnalysisProgress;
  result?: AnalysisResult;
  message?: string;
  code?: "XML_PARSE_ERROR" | "UNSUPPORTED_BASIS";
  line?: number;
  column?: number;
  basis?: string;
}

export class AnalysisWorkerError extends Error {
  constructor(
    message: string,
    readonly response: AnalysisWorkerResponse,
  ) {
    super(message);
    this.name = "AnalysisWorkerError";
  }
}

export function analyzeFileInWorker(
  file: File,
  onProgress: (progress: AnalysisProgress) => void,
): Promise<AnalysisResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker("/analysis.worker.js", { type: "module" });
    const finish = () => worker.terminate();

    worker.onmessage = (event: MessageEvent<AnalysisWorkerResponse>) => {
      const response = event.data;
      if (response.type === "progress" && response.progress) {
        onProgress(response.progress);
      } else if (response.type === "complete" && response.result) {
        finish();
        resolve(response.result);
      } else if (response.type === "error") {
        finish();
        reject(new AnalysisWorkerError(response.message ?? "Analysis failed.", response));
      }
    };

    worker.onerror = (event) => {
      finish();
      reject(new Error(event.message || "Analysis worker failed."));
    };

    worker.postMessage({ file });
  });
}
