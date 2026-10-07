import { createHmac, randomBytes } from "node:crypto";
import { isIP } from "node:net";

const processSecret = randomBytes(32);

export function getClientIpKey(request: Request): string | null {
  const forwardedIp = request.headers.get("cf-connecting-ip")?.trim();
  const devForwardedIp =
    process.env.NODE_ENV !== "production"
      ? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1"
      : undefined;
  const ip = forwardedIp || devForwardedIp;
  if (!ip || isIP(ip) === 0) return null;

  return createHmac("sha256", processSecret).update(ip).digest("hex");
}
