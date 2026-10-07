import { createHmac, randomBytes } from "node:crypto";
import { isIP } from "node:net";

const processSecret = randomBytes(32);

function getRequestIp(request: Request): string | null {
  const ip = Reflect.get(request, "ip");
  return typeof ip === "string" && isIP(ip) !== 0 ? ip : null;
}

function getLocalRequestIp(request: Request): string | null {
  const hostname = new URL(request.url).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]"
    ? "127.0.0.1"
    : null;
}

function getTrustedProxyIp(request: Request): string | null {
  const cloudflareIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cloudflareIp && isIP(cloudflareIp) !== 0) return cloudflareIp;

  const forwardedFor = request.headers.get("x-forwarded-for");
  for (const candidate of forwardedFor?.split(",") ?? []) {
    const ip = candidate.trim();
    if (ip && isIP(ip) !== 0) return ip;
  }

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp && isIP(realIp) !== 0) return realIp;

  return null;
}

export function getClientIpKey(request: Request): string | null {
  const proxyTrustDisabled = process.env.TRUST_PROXY_HEADERS?.toLowerCase() === "false";
  const ip = proxyTrustDisabled
    ? getRequestIp(request) ?? getLocalRequestIp(request)
    : getTrustedProxyIp(request) ?? getRequestIp(request) ?? getLocalRequestIp(request);
  if (!ip) return null;

  return createHmac("sha256", processSecret).update(ip).digest("hex");
}
