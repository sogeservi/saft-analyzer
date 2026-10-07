"use client";

import { useReducer, useCallback } from "react";
import { toast } from "sonner";
import { Dropzone } from "@/components/upload/dropzone";
import {
  FileList,
  type FileEntry,
  type FileStatus,
  type XmlUploadError,
} from "@/components/upload/file-list";
import { ProgressView } from "@/components/processing/progress-view";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { SectionView } from "@/components/sections/section-view";
import { ErrorsView } from "@/components/errors/errors-view";
import { Button } from "@/components/ui/button";
import type { AnalysisResult } from "@/lib/types/analysis";
import {
  MAX_SAFT_UPLOAD_BYTES,
} from "@/lib/file-limits";
import { useLocale } from "@/lib/i18n";
import { analyzeFileInWorker, AnalysisWorkerError } from "@/lib/analysis/analyze-file";

type View = "upload" | "results";

interface AppState {
  files: FileEntry[];
  activeFileId: string | null;
  view: View;
  section: string | null;
}

type Action =
  | { type: "ADD_FILES"; files: FileEntry[] }
  | { type: "REMOVE_FILE"; id: string }
  | {
      type: "SET_FILE_STATUS";
      id: string;
      status: FileStatus;
      result?: AnalysisResult;
      error?: FileEntry["error"];
    }
  | {
      type: "SET_ANALYSIS_PROGRESS";
      id: string;
      progress: number;
    }
  | { type: "SET_ACTIVE_FILE"; id: string }
  | { type: "SET_VIEW"; view: View }
  | { type: "SET_SECTION"; section: string | null }
  | { type: "RESET" };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "ADD_FILES":
      return { ...state, files: [...state.files, ...action.files] };

    case "REMOVE_FILE": {
      const files = state.files.filter((f) => f.id !== action.id);
      const activeFileId =
        state.activeFileId === action.id
          ? (files[0]?.id ?? null)
          : state.activeFileId;
      return { ...state, files, activeFileId };
    }

    case "SET_FILE_STATUS":
      return {
        ...state,
        files: state.files.map((f) =>
          f.id === action.id
            ? {
                ...f,
                status: action.status,
                file: action.status === "complete" ? null : f.file,
                result: action.result ?? f.result,
                error: action.error ?? f.error,
              }
            : f,
        ),
      };

    case "SET_ANALYSIS_PROGRESS":
      return {
        ...state,
        files: state.files.map((file) =>
          file.id === action.id
            ? {
                ...file,
                progress: action.progress,
              }
            : file,
        ),
      };

    case "SET_ACTIVE_FILE":
      return { ...state, activeFileId: action.id, section: null };

    case "SET_VIEW":
      return { ...state, view: action.view, section: null };

    case "SET_SECTION":
      return { ...state, section: action.section };

    case "RESET":
      return INITIAL_STATE;

    default:
      return state;
  }
}

const INITIAL_STATE: AppState = {
  files: [],
  activeFileId: null,
  view: "upload",
  section: null,
};

let idCounter = 0;

export default function HomePage() {
  const { t } = useLocale();
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  const handleFiles = useCallback((files: File[]) => {
    const entries: FileEntry[] = files.map((file) => ({
      id: String(++idCounter),
      file: file.size <= MAX_SAFT_UPLOAD_BYTES ? file : null,
      name: file.name,
      size: file.size,
      status: file.size <= MAX_SAFT_UPLOAD_BYTES ? "pending" : "error",
      progress: 0,
      result: null,
      error:
        file.size <= MAX_SAFT_UPLOAD_BYTES
          ? null
          : t("O limite por ficheiro é 100 MiB."),
    }));
    dispatch({ type: "ADD_FILES", files: entries });
  }, [t]);

  const handleRemove = useCallback((id: string) => {
    dispatch({ type: "REMOVE_FILE", id });
  }, []);

  const handleAnalyze = useCallback(async () => {
    const pendingFiles = state.files.filter((file) => file.status === "pending");
    if (pendingFiles.length === 0) return;

    let firstCompletedId: string | null = null;
    for (const entry of pendingFiles) {
      const file = entry.file;
      if (!file) {
        dispatch({
          type: "SET_FILE_STATUS",
          id: entry.id,
          status: "error",
          error: t("Ficheiro indisponível. Selecione-o novamente."),
        });
        continue;
      }

      dispatch({ type: "SET_FILE_STATUS", id: entry.id, status: "analyzing" });
      dispatch({
        type: "SET_ANALYSIS_PROGRESS",
        id: entry.id,
        progress: 0,
      });

      try {
        const result = await analyzeFileInWorker(file, (progress) => {
          dispatch({
            type: "SET_ANALYSIS_PROGRESS",
            id: entry.id,
            progress: progress.percentage,
          });
        });
        dispatch({ type: "SET_FILE_STATUS", id: entry.id, status: "complete", result });
        if (!firstCompletedId) firstCompletedId = entry.id;
        toast.success(entry.name + " " + t("analisado com sucesso!"));
      } catch (error) {
        if (error instanceof AnalysisWorkerError && error.response.code === "XML_PARSE_ERROR") {
          const xmlError: XmlUploadError = {
            kind: "xml",
            message: error.message,
            line: error.response.line ?? 1,
            column: error.response.column ?? 1,
          };
          dispatch({ type: "SET_FILE_STATUS", id: entry.id, status: "error", error: xmlError });
          toast.error(
            t("Erro no XML") + " — " + t("Linha") + " " + xmlError.line + ", " +
              t("Coluna") + " " + xmlError.column,
          );
          continue;
        }

        let message = error instanceof Error ? t(error.message) : t("Erro desconhecido.");
        if (error instanceof AnalysisWorkerError && error.response.code === "UNSUPPORTED_BASIS") {
          const basis = error.response.basis ?? "?";
          message = t("Este ficheiro SAF-T não é de faturação. TaxAccountingBasis") +
            `="${basis}". ` + t("Só são aceites ficheiros de faturação (F, S, P, R, T).");
        }
        dispatch({ type: "SET_FILE_STATUS", id: entry.id, status: "error", error: message });
        toast.error(t("Erro ao analisar") + " " + entry.name + ": " + message);
      }
    }

    if (firstCompletedId) {
      dispatch({ type: "SET_ACTIVE_FILE", id: firstCompletedId });
      dispatch({ type: "SET_VIEW", view: "results" });
    }
  }, [state.files, t]);
  const isAnalyzing = state.files.some((f) => f.status === "analyzing");
  const hasPending = state.files.some((f) => f.status === "pending");
  const completedFiles = state.files.filter((f) => f.status === "complete");
  const activeFile = state.files.find((f) => f.id === state.activeFileId);
  const analyzingFile = state.files.find((f) => f.status === "analyzing");

  if (analyzingFile) {
    return (
      <ProgressView
        fileName={analyzingFile.name}
        fileSize={analyzingFile.size}
        progress={analyzingFile.progress}
      />
    );
  }

  if (state.view === "results" && activeFile?.result) {
    return (
      <ResultsView
        files={completedFiles}
        activeFile={activeFile}
        section={state.section}
        onFileSelect={(id) => dispatch({ type: "SET_ACTIVE_FILE", id })}
        onSectionSelect={(s) => dispatch({ type: "SET_SECTION", section: s })}
        onNewAnalysis={() => dispatch({ type: "RESET" })}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold tracking-tight">SAF-T Analyzer</h1>
        <p className="mt-2 text-muted-foreground">{t("Analise e valide ficheiros SAF-T (PT). Veja erros, totais e resumos num só lugar.")}</p>
      </div>
      <div className="space-y-6">
        <Dropzone onFiles={handleFiles} disabled={isAnalyzing} />
        <FileList
          files={state.files}
          onRemove={handleRemove}
          disabled={isAnalyzing}
        />
        {hasPending && (
          <div className="flex justify-center">
            <Button size="lg" onClick={handleAnalyze}>
              {t("Analisar")}
            </Button>
          </div>
        )}
        {completedFiles.length > 0 && state.view === "upload" && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={() => {
                dispatch({
                  type: "SET_ACTIVE_FILE",
                  id: completedFiles[0].id,
                });
                dispatch({ type: "SET_VIEW", view: "results" });
              }}
            >
              {t("Ver Resultados")}
            </Button>
          </div>
        )}
      </div>
      <p className="mt-10 rounded-lg border px-5 py-4 text-sm text-muted-foreground">{t("Os ficheiros SAF-T são analisados localmente no navegador. Os ficheiros e resultados não são enviados para um servidor.")}</p>
    </div>
  );
}

interface ResultsViewProps {
  files: FileEntry[];
  activeFile: FileEntry;
  section: string | null;
  onFileSelect: (id: string) => void;
  onSectionSelect: (section: string | null) => void;
  onNewAnalysis: () => void;
}

function ResultsView({
  files,
  activeFile,
  section,
  onFileSelect,
  onSectionSelect,
  onNewAnalysis,
}: ResultsViewProps) {
  const { t } = useLocale();
  const result = activeFile.result!;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center gap-4 px-6">
          <h1 className="text-lg font-semibold">SAF-T Analyzer</h1>
          <div className="flex-1" />

          {files.length > 1 && (
            <div className="flex gap-1">
              {files.map((f) => (
                <Button
                  key={f.id}
                  variant={f.id === activeFile.id ? "default" : "ghost"}
                  size="sm"
                  onClick={() => onFileSelect(f.id)}
                >
                  {f.name}
                </Button>
              ))}
            </div>
          )}

          <Button variant="outline" size="sm" onClick={onNewAnalysis}>{t("Nova Análise")}</Button>
        </div>
      </header>

      <main className="px-6 py-6">
        {section === null ? (
          <DashboardView result={result} onSectionSelect={onSectionSelect} />
        ) : section === "errors" ? (
          <ErrorsView
            result={result}
            onBack={() => onSectionSelect(null)}
          />
        ) : (
          <SectionView
            result={result}
            section={section}
            onBack={() => onSectionSelect(null)}
          />
        )}
      </main>
    </div>
  );
}
