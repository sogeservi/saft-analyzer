import type { AnalysisResult } from "@/lib/types/analysis";
import type { TVirtualFileSystem } from "pdfmake/interfaces";
import { buildPdfDefinition } from "./pdf-generator";
import { downloadFile } from "./download-file";

interface BrowserPdfMake {
  createPdf(
    definition: ReturnType<typeof buildPdfDefinition>,
    tableLayouts: undefined,
    fonts: undefined,
    virtualFileSystem: TVirtualFileSystem,
  ): { getBlob(callback: (blob: Blob) => void): void };
}

export async function downloadPdf(result: AnalysisResult): Promise<void> {
  const [pdfMakeModule, virtualFileSystemModule] = await Promise.all([
    import("pdfmake/build/pdfmake"),
    import("pdfmake/build/vfs_fonts"),
  ]);
  const pdfMake = pdfMakeModule as unknown as BrowserPdfMake;
  const virtualFileSystem = (
    virtualFileSystemModule as unknown as {
      default: { pdfMake: { vfs: TVirtualFileSystem } };
    }
  ).default.pdfMake.vfs;
  const pdf = await new Promise<Blob>((resolve) => {
    pdfMake.createPdf(
      buildPdfDefinition(result),
      undefined,
      undefined,
      virtualFileSystem,
    ).getBlob(resolve);
  });
  downloadFile(pdf, "saft-analysis.pdf");
}
