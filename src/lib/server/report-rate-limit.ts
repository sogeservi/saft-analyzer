const WINDOW_MS = 60_000;
const MAX_GLOBAL_REPORTS = 100;
const MAX_IP_REPORTS = 5;

interface RateLimitState {
  global: number[];
  byIp: Map<string, number[]>;
}

const globalState = globalThis as typeof globalThis & {
  saftAnalyzerReportRateLimit?: RateLimitState;
};
const state = (globalState.saftAnalyzerReportRateLimit ??= {
  global: [],
  byIp: new Map<string, number[]>(),
});

function pruneWindow(timestamps: number[], cutoff: number): void {
  while (timestamps.length > 0 && timestamps[0] <= cutoff) timestamps.shift();
}

export function consumeReportCreation(ipKey: string): {
  allowed: boolean;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  pruneWindow(state.global, cutoff);

  for (const [key, timestamps] of state.byIp) {
    pruneWindow(timestamps, cutoff);
    if (timestamps.length === 0) state.byIp.delete(key);
  }

  if (state.global.length >= MAX_GLOBAL_REPORTS) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((state.global[0] + WINDOW_MS - now) / 1000),
      ),
    };
  }

  const ipTimestamps = state.byIp.get(ipKey) ?? [];
  if (ipTimestamps.length >= MAX_IP_REPORTS) {
    state.byIp.set(ipKey, ipTimestamps);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((ipTimestamps[0] + WINDOW_MS - now) / 1000),
      ),
    };
  }

  state.global.push(now);
  ipTimestamps.push(now);
  state.byIp.set(ipKey, ipTimestamps);
  return { allowed: true, retryAfterSeconds: 0 };
}
