import type { AnalysisResult } from "../types/analysis";

interface StoredEntry {
  result: AnalysisResult;
  createdAt: number;
  expiresAt: number;
}

const DEFAULT_TTL_HOURS = 24;

function getTtlMs(): number {
  const hours = parseInt(process.env.SHARE_TTL_HOURS ?? "", 10);
  return (isNaN(hours) ? DEFAULT_TTL_HOURS : hours) * 60 * 60 * 1000;
}

class TempStore {
  private store = new Map<string, StoredEntry>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.cleanupInterval = setInterval(() => this.purgeExpired(), 60_000);
  }

  set(uuid: string, result: AnalysisResult): { createdAt: number; expiresAt: number } {
    const now = Date.now();
    const expiresAt = now + getTtlMs();
    this.store.set(uuid, { result, createdAt: now, expiresAt });
    return { createdAt: now, expiresAt };
  }

  get(uuid: string): StoredEntry | null {
    const entry = this.store.get(uuid);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(uuid);
      return null;
    }
    return entry;
  }

  delete(uuid: string): boolean {
    return this.store.delete(uuid);
  }

  has(uuid: string): boolean {
    return this.get(uuid) !== null;
  }

  get size(): number {
    return this.store.size;
  }

  private purgeExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.store.clear();
  }
}

export const tempStore = new TempStore();
