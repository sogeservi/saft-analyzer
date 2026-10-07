import { randomUUID } from "node:crypto";
import {
  MAX_SAFT_UPLOAD_BYTES,
  MAX_UPLOAD_CHUNK_BYTES,
} from "@/lib/request-limits";

const MAX_CONCURRENT_ANALYSES = 10;
const MAX_CONCURRENT_UPLOADS = 2;
const MAX_WAITING_ANALYSES = 200;
const JOB_IDLE_TTL_MS = 15 * 60 * 1000;

export type AnalysisJobStatus = "queued" | "uploading" | "processing";

interface AnalysisJob {
  id: string;
  ipKey: string;
  fileName: string;
  expectedBytes: number;
  receivedBytes: number;
  chunks: Buffer[];
  status: AnalysisJobStatus;
  updatedAt: number;
}

interface AnalysisQueueState {
  jobs: Map<string, AnalysisJob>;
  waiting: string[];
  active: Set<string>;
}

export interface AnalysisJobStatusView {
  status: AnalysisJobStatus;
  fileName: string;
  fileSize: number;
  receivedBytes: number;
  queuePosition: number | null;
  activeCount: number;
  waitingCount: number;
}

export type CreateAnalysisJobResult =
  | { ok: true; id: string; status: AnalysisJobStatusView }
  | { ok: false; reason: "ip-active" | "queue-full" };

export type UploadChunkResult =
  | { ok: true; receivedBytes: number }
  | { ok: false; reason: "not-found" | "not-admitted" | "invalid-chunk" };

export type BeginAnalysisResult =
  | { ok: true; fileName: string; file: Buffer }
  | { ok: false; reason: "not-found" | "not-admitted" | "upload-incomplete" };

const globalState = globalThis as typeof globalThis & {
  saftAnalyzerAnalysisQueue?: AnalysisQueueState;
};
const state = (globalState.saftAnalyzerAnalysisQueue ??= {
  jobs: new Map<string, AnalysisJob>(),
  waiting: [],
  active: new Set<string>(),
});

function destroyJob(job: AnalysisJob): void {
  for (const chunk of job.chunks) chunk.fill(0);
  job.chunks.length = 0;
  state.jobs.delete(job.id);
  state.active.delete(job.id);
  const waitingIndex = state.waiting.indexOf(job.id);
  if (waitingIndex !== -1) state.waiting.splice(waitingIndex, 1);
}

function promoteWaiting(): void {
  let uploading = 0;
  for (const id of state.active) {
    if (state.jobs.get(id)?.status === "uploading") uploading++;
  }

  while (
    state.waiting.length > 0 &&
    state.active.size < MAX_CONCURRENT_ANALYSES &&
    uploading < MAX_CONCURRENT_UPLOADS
  ) {
    const id = state.waiting.shift();
    if (!id) break;
    const job = state.jobs.get(id);
    if (!job || job.status !== "queued") continue;
    job.status = "uploading";
    job.updatedAt = Date.now();
    state.active.add(id);
    uploading++;
  }
}

function removeIdleJobs(now: number): void {
  for (const job of state.jobs.values()) {
    if (
      job.status !== "processing" &&
      now - job.updatedAt >= JOB_IDLE_TTL_MS
    ) {
      destroyJob(job);
    }
  }
  promoteWaiting();
}

function statusView(job: AnalysisJob): AnalysisJobStatusView {
  const queueIndex = state.waiting.indexOf(job.id);
  return {
    status: job.status,
    fileName: job.fileName,
    fileSize: job.expectedBytes,
    receivedBytes: job.receivedBytes,
    queuePosition: queueIndex === -1 ? null : queueIndex + 1,
    activeCount: state.active.size,
    waitingCount: state.waiting.length,
  };
}

export function createAnalysisJob(
  ipKey: string,
  fileName: string,
  fileSize: number,
): CreateAnalysisJobResult {
  const now = Date.now();
  removeIdleJobs(now);

  for (const job of state.jobs.values()) {
    if (job.ipKey === ipKey) return { ok: false, reason: "ip-active" };
  }
  if (state.waiting.length >= MAX_WAITING_ANALYSES) {
    return { ok: false, reason: "queue-full" };
  }

  const id = randomUUID();
  const job: AnalysisJob = {
    id,
    ipKey,
    fileName: fileName.slice(0, 200),
    expectedBytes: fileSize,
    receivedBytes: 0,
    chunks: [],
    status: "queued",
    updatedAt: now,
  };
  state.jobs.set(id, job);
  state.waiting.push(id);
  promoteWaiting();
  return { ok: true, id, status: statusView(job) };
}

export function getAnalysisJobStatus(
  id: string,
  ipKey: string,
): AnalysisJobStatusView | null {
  removeIdleJobs(Date.now());
  const job = state.jobs.get(id);
  if (!job || job.ipKey !== ipKey) return null;
  if (job.status === "queued") job.updatedAt = Date.now();
  return statusView(job);
}

export function acceptAnalysisChunk(
  id: string,
  ipKey: string,
  index: number,
  chunk: Buffer,
): UploadChunkResult {
  removeIdleJobs(Date.now());
  const job = state.jobs.get(id);
  if (!job || job.ipKey !== ipKey) return { ok: false, reason: "not-found" };
  if (job.status !== "uploading") {
    return { ok: false, reason: "not-admitted" };
  }

  const expectedChunkBytes = Math.min(
    MAX_UPLOAD_CHUNK_BYTES,
    job.expectedBytes - job.receivedBytes,
  );
  if (
    index !== job.chunks.length ||
    chunk.length !== expectedChunkBytes ||
    chunk.length === 0
  ) {
    return { ok: false, reason: "invalid-chunk" };
  }

  job.chunks.push(chunk);
  job.receivedBytes += chunk.length;
  job.updatedAt = Date.now();
  return { ok: true, receivedBytes: job.receivedBytes };
}

export function beginAnalysis(
  id: string,
  ipKey: string,
): BeginAnalysisResult {
  removeIdleJobs(Date.now());
  const job = state.jobs.get(id);
  if (!job || job.ipKey !== ipKey) return { ok: false, reason: "not-found" };
  if (job.status !== "uploading") {
    return { ok: false, reason: "not-admitted" };
  }
  if (job.receivedBytes !== job.expectedBytes) {
    return { ok: false, reason: "upload-incomplete" };
  }

  job.status = "processing";
  job.updatedAt = Date.now();
  const file = Buffer.concat(job.chunks, job.expectedBytes);
  for (const chunk of job.chunks) chunk.fill(0);
  job.chunks.length = 0;
  promoteWaiting();
  return { ok: true, fileName: job.fileName, file };
}

export function cancelAnalysisJob(id: string, ipKey: string): boolean {
  removeIdleJobs(Date.now());
  const job = state.jobs.get(id);
  if (!job || job.ipKey !== ipKey || job.status === "processing") return false;
  destroyJob(job);
  promoteWaiting();
  return true;
}

export function finishAnalysisJob(id: string, ipKey: string): void {
  const job = state.jobs.get(id);
  if (!job || job.ipKey !== ipKey) return;
  destroyJob(job);
  promoteWaiting();
}

export const ANALYSIS_QUEUE_LIMITS = {
  maxConcurrent: MAX_CONCURRENT_ANALYSES,
  maxWaiting: MAX_WAITING_ANALYSES,
} as const;
