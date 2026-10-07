"use client";

import { useReducer, useCallback } from "react";
import { toast } from "sonner";
import { Dropzone } from "@/components/upload/dropzone";
import {
  FileList,
  type FileEntry,
  type FileStatus,
  type UploadStage,
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
  MAX_UPLOAD_CHUNK_BYTES,
} from "@/lib/request-limits";
import { useLocale } from "@/lib/i18n";

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
      type: "SET_UPLOAD_PROGRESS";
      id: string;
      stage: UploadStage;
      queuePosition: number | null;
      uploadProgress: number;
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

    case "SET_UPLOAD_PROGRESS":
      return {
        ...state,
        files: state.files.map((file) =>
          file.id === action.id
            ? {
                ...file,
                stage: action.stage,
                queuePosition: action.queuePosition,
                uploadProgress: action.uploadProgress,
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function responseError(response: Response): Promise<string> {
  const data: unknown = await response.json().catch(() => null);
  return isRecord(data) && typeof data.error === "string"
    ? data.error
    : `Erro HTTP ${response.status}`;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

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
      stage: "queue",
      queuePosition: null,
      uploadProgress: 0,
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
    const pendingFiles = state.files.filter((f) => f.status === "pending");
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
      dispatch({
        type: "SET_FILE_STATUS",
        id: entry.id,
        status: "uploading",
      });
      dispatch({
        type: "SET_UPLOAD_PROGRESS",
        id: entry.id,
        stage: "queue",
        queuePosition: null,
        uploadProgress: 0,
      });

      let jobId: string | null = null;
      try {
        const createResponse = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: file.name, fileSize: file.size }),
          cache: "no-store",
        });
        if (!createResponse.ok) {
          throw new Error(await responseError(createResponse));
        }

        const createData: unknown = await createResponse.json();
        if (
          !isRecord(createData) ||
          typeof createData.jobId !== "string" ||
          (createData.status !== "queued" && createData.status !== "uploading")
        ) {
          throw new Error(t("Resposta inválida do servidor."));
        }
        jobId = createData.jobId;
        let jobStatus = createData.status;
        let queuePosition =
          typeof createData.queuePosition === "number"
            ? createData.queuePosition
            : null;

        while (jobStatus === "queued") {
          dispatch({
            type: "SET_UPLOAD_PROGRESS",
            id: entry.id,
            stage: "queue",
            queuePosition,
            uploadProgress: 0,
          });
          await wait(1500);
          const statusResponse = await fetch("/api/analyze/" + jobId, {
            cache: "no-store",
          });
          if (!statusResponse.ok) {
            throw new Error(await responseError(statusResponse));
          }
          const statusData: unknown = await statusResponse.json();
          if (
            !isRecord(statusData) ||
            (statusData.status !== "queued" && statusData.status !== "uploading")
          ) {
            throw new Error(t("A análise já não está disponível."));
          }
          jobStatus = statusData.status;
          queuePosition =
            typeof statusData.queuePosition === "number"
              ? statusData.queuePosition
              : null;
        }

        dispatch({
          type: "SET_UPLOAD_PROGRESS",
          id: entry.id,
          stage: "upload",
          queuePosition: null,
          uploadProgress: 0,
        });
        let offset = 0;
        let chunkIndex = 0;
        while (offset < file.size) {
          const chunk = file.slice(offset, offset + MAX_UPLOAD_CHUNK_BYTES);
          const chunkResponse = await fetch(
            "/api/analyze/" + jobId + "/chunk?index=" + chunkIndex,
            {
              method: "POST",
              headers: { "Content-Type": "application/octet-stream" },
              body: chunk,
              cache: "no-store",
            },
          );
          if (!chunkResponse.ok) {
            throw new Error(await responseError(chunkResponse));
          }
          offset += chunk.size;
          chunkIndex++;
          dispatch({
            type: "SET_UPLOAD_PROGRESS",
            id: entry.id,
            stage: "upload",
            queuePosition: null,
            uploadProgress: Math.round((offset / file.size) * 100),
          });
        }

        dispatch({
          type: "SET_UPLOAD_PROGRESS",
          id: entry.id,
          stage: "processing",
          queuePosition: null,
          uploadProgress: 100,
        });
        const response = await fetch(
          "/api/analyze/" + jobId + "/complete",
          { method: "POST", cache: "no-store" },
        );
        jobId = null;
        if (!response.ok) {
          const data: unknown = await response.json().catch(() => null);
          if (
            isRecord(data) &&
            data.code === "XML_PARSE_ERROR" &&
            typeof data.message === "string" &&
            typeof data.line === "number" &&
            typeof data.column === "number"
          ) {
            const xmlError: XmlUploadError = {
              kind: "xml",
              message: data.message,
              line: data.line,
              column: data.column,
            };
            dispatch({
              type: "SET_FILE_STATUS",
              id: entry.id,
              status: "error",
              error: xmlError,
            });
            toast.error(
              t("Erro no XML") + " — " + t("Linha") + " " +
                xmlError.line + ", " + t("Coluna") + " " + xmlError.column,
            );
            continue;
          }
          const message =
            isRecord(data) && typeof data.error === "string"
              ? data.error
              : "Erro HTTP " + response.status;
          throw new Error(message);
        }

        const result: AnalysisResult = await response.json();
        dispatch({
          type: "SET_FILE_STATUS",
          id: entry.id,
          status: "complete",
          result,
        });

        if (!firstCompletedId) firstCompletedId = entry.id;
        toast.success(entry.name + " " + t("analisado com sucesso!"));
      } catch (err) {
        const message =
          err instanceof Error ? t(err.message) : t("Erro desconhecido.");
        dispatch({
          type: "SET_FILE_STATUS",
          id: entry.id,
          status: "error",
          error: message,
        });
        toast.error(t("Erro ao analisar") + " " + entry.name + ": " + message);
      } finally {
        if (jobId) {
          await fetch("/api/analyze/" + jobId, {
            method: "DELETE",
            cache: "no-store",
          }).catch(() => null);
        }
      }
    }

    if (firstCompletedId) {
      dispatch({ type: "SET_ACTIVE_FILE", id: firstCompletedId });
      dispatch({ type: "SET_VIEW", view: "results" });
    }
  }, [state.files, t]);

  const isUploading = state.files.some((f) => f.status === "uploading");
  const hasPending = state.files.some((f) => f.status === "pending");
  const completedFiles = state.files.filter((f) => f.status === "complete");
  const activeFile = state.files.find((f) => f.id === state.activeFileId);
  const uploadingFile = state.files.find((f) => f.status === "uploading");

  if (uploadingFile) {
    return (
      <ProgressView
        fileName={uploadingFile.name}
        fileSize={uploadingFile.size}
        stage={uploadingFile.stage}
        queuePosition={uploadingFile.queuePosition}
        uploadProgress={uploadingFile.uploadProgress}
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
        <Dropzone onFiles={handleFiles} disabled={isUploading} />
        <FileList
          files={state.files}
          onRemove={handleRemove}
          disabled={isUploading}
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
      <details className="mt-10 rounded-lg border px-5 py-4 text-sm">
        <summary className="cursor-pointer font-medium">{t("Privacidade e partilha")}</summary>
        <div className="mt-3 space-y-3 leading-relaxed text-muted-foreground">
          <p><strong className="text-foreground">{t("O que acontece ao meu ficheiro?")}</strong> {t("É enviado para análise e os resultados são mostrados aqui. Não guardamos o ficheiro nem os resultados.")}</p>
          <p><strong className="text-foreground">{t("Posso partilhar os resultados?")}</strong> {t("Sim. Se escolher criar um link, os dados apresentados serão guardados por até 24 horas. Qualquer pessoa com o link poderá vê-los.")}</p>
          <p><strong className="text-foreground">{t("E depois?")}</strong> {t("O link e os dados partilhados são apagados automaticamente ao fim de 24 horas.")}</p>
        </div>
      </details>
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
