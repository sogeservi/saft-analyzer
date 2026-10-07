import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { AnalysisResult } from "../types/analysis";

interface StoredEntry {
  result: AnalysisResult;
  createdAt: number;
  expiresAt: number;
}

const DEFAULT_TTL_HOURS = 24;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getTtlMs(): number {
  const hours = parseInt(process.env.SHARE_TTL_HOURS ?? "", 10);
  return (isNaN(hours) ? DEFAULT_TTL_HOURS : hours) * 60 * 60 * 1000;
}

function getStorageDirectory(): string {
  return process.env.SHARE_STORAGE_DIR ?? path.join(process.cwd(), ".data", "shares");
}

function getSharePath(uuid: string): string | null {
  if (!UUID_PATTERN.test(uuid)) return null;
  return path.join(getStorageDirectory(), `${uuid}.json`);
}

export class ShareStore {
  constructor() {
    const cleanupInterval = setInterval(() => {
      void this.purgeExpired().catch((error: unknown) => {
        console.error("Failed to clean expired share links:", error);
      });
    }, 60_000);
    cleanupInterval.unref();
  }

  async set(
    uuid: string,
    result: AnalysisResult,
  ): Promise<{ createdAt: number; expiresAt: number }> {
    const filePath = getSharePath(uuid);
    if (!filePath) throw new Error("UUID de partilha invÃ¡lido.");

    const createdAt = Date.now();
    const expiresAt = createdAt + getTtlMs();
    const directory = path.dirname(filePath);
    const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
    const entry: StoredEntry = { result, createdAt, expiresAt };

    await mkdir(directory, { recursive: true, mode: 0o700 });
    try {
      await writeFile(temporaryPath, JSON.stringify(entry), {
        mode: 0o600,
        flag: "wx",
      });
      await rename(temporaryPath, filePath);
    } catch (error) {
      await rm(temporaryPath, { force: true });
      throw error;
    }

    return { createdAt, expiresAt };
  }

  async get(uuid: string): Promise<StoredEntry | null> {
    const filePath = getSharePath(uuid);
    if (!filePath) return null;

    let contents: string;
    try {
      contents = await readFile(filePath, "utf8");
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        return null;
      }
      throw error;
    }

    const entry = JSON.parse(contents) as StoredEntry;
    if (Date.now() > entry.expiresAt) {
      await rm(filePath, { force: true });
      return null;
    }
    return entry;
  }

  private async purgeExpired(): Promise<void> {
    const directory = getStorageDirectory();
    let files: string[];
    try {
      files = await readdir(directory);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        return;
      }
      throw error;
    }

    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      const filePath = path.join(directory, file);
      try {
        const entry = JSON.parse(await readFile(filePath, "utf8")) as StoredEntry;
        if (Date.now() > entry.expiresAt) {
          await rm(filePath, { force: true });
        }
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") {
          continue;
        }
        console.error(`Failed to inspect stored share ${file}:`, error);
      }
    }
  }
}

export const tempStore = new ShareStore();
