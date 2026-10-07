import { randomUUID } from "node:crypto";

const SHARE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_ACTIVE_SHARES = 100;
const MAX_ACTIVE_SHARE_BYTES = 64 * 1024 * 1024;
export const MAX_SHARE_BYTES = 10 * 1024 * 1024;
export const MAX_ACTIVE_SHARES_PER_IP = 10;

interface StoredShare {
  payload: Buffer;
  ownerKey: string;
  expiresAt: number;
  bytes: number;
  expiryTimer: ReturnType<typeof setTimeout>;
}

interface ShareStoreState {
  shares: Map<string, StoredShare>;
  bytes: number;
}

const globalState = globalThis as typeof globalThis & {
  saftAnalyzerShareState?: ShareStoreState;
};
const state = (globalState.saftAnalyzerShareState ??= {
  shares: new Map<string, StoredShare>(),
  bytes: 0,
});

function removeExpired(now: number): void {
  for (const [id, share] of state.shares) {
    if (share.expiresAt <= now) {
      clearTimeout(share.expiryTimer);
      share.payload.fill(0);
      state.shares.delete(id);
      state.bytes -= share.bytes;
    }
  }
}

function removeShare(id: string): void {
  const share = state.shares.get(id);
  if (!share) return;
  clearTimeout(share.expiryTimer);
  share.payload.fill(0);
  state.shares.delete(id);
  state.bytes -= share.bytes;
}

export type CreateShareResult =
  | { ok: true; id: string; expiresAt: number }
  | {
      ok: false;
      reason: "share-too-large" | "ip-share-limit" | "memory-capacity";
    };

export function createShare(
  payload: string,
  ownerKey: string,
): CreateShareResult {
  const now = Date.now();
  const bytes = Buffer.byteLength(payload, "utf8");
  removeExpired(now);
  if (bytes > MAX_SHARE_BYTES) {
    return { ok: false, reason: "share-too-large" };
  }
  let ownedShares = 0;
  for (const share of state.shares.values()) {
    if (share.ownerKey === ownerKey) ownedShares++;
  }
  if (ownedShares >= MAX_ACTIVE_SHARES_PER_IP) {
    return { ok: false, reason: "ip-share-limit" };
  }
  if (
    state.shares.size >= MAX_ACTIVE_SHARES ||
    state.bytes + bytes > MAX_ACTIVE_SHARE_BYTES
  ) {
    return { ok: false, reason: "memory-capacity" };
  }

  const id = randomUUID();
  const expiresAt = now + SHARE_TTL_MS;
  const expiryTimer = setTimeout(() => {
    removeShare(id);
  }, SHARE_TTL_MS);
  expiryTimer.unref?.();
  state.shares.set(id, {
    payload: Buffer.from(payload, "utf8"),
    ownerKey,
    expiresAt,
    bytes,
    expiryTimer,
  });
  state.bytes += bytes;
  return { ok: true, id, expiresAt };
}

export function getShare(id: string): { payload: Buffer; expiresAt: number } | null {
  const share = state.shares.get(id);
  if (!share) return null;
  if (share.expiresAt <= Date.now()) {
    removeShare(id);
    return null;
  }
  return { payload: share.payload, expiresAt: share.expiresAt };
}
