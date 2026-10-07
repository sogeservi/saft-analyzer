import { NextResponse } from "next/server";
import { getClientIpKey } from "./client-ip";
import { consumeReportCreation } from "./report-rate-limit";

type ReportRequestGuardResult =
  | { ipKey: string; response: null }
  | { ipKey: null; response: NextResponse };

export function guardReportRequest(request: Request): ReportRequestGuardResult {
  const ipKey = getClientIpKey(request);
  if (!ipKey) {
    return {
      ipKey: null,
      response: NextResponse.json(
        { error: "Não foi possível validar o endereço IP desta ligação." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      ),
    };
  }

  const result = consumeReportCreation(ipKey);
  if (!result.allowed) {
    return {
      ipKey: null,
      response: NextResponse.json(
        { error: "Atingiu o limite temporário de geração de relatórios e ligações." },
        {
          status: 429,
          headers: {
            "Cache-Control": "no-store",
            "Retry-After": String(result.retryAfterSeconds),
          },
        },
      ),
    };
  }

  return { ipKey, response: null };
}
