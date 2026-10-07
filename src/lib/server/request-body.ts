export class RequestBodyError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 413 | 415,
  ) {
    super(message);
    this.name = "RequestBodyError";
  }
}

export async function readRequestBody(
  request: Request,
  maxBytes: number,
  expectedContentType?: string,
): Promise<Buffer> {
  const contentType = request.headers
    .get("content-type")
    ?.split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (expectedContentType && contentType !== expectedContentType) {
    throw new RequestBodyError("Unsupported content type.", 415);
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) {
      throw new RequestBodyError("Invalid content length.", 400);
    }
    if (Number(contentLength) > maxBytes) {
      throw new RequestBodyError("Request body is too large.", 413);
    }
  }

  if (!request.body) {
    throw new RequestBodyError("Request body is required.", 400);
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  let body: Buffer | undefined;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > maxBytes) {
        await Promise.allSettled([reader.cancel()]);
        throw new RequestBodyError("Request body is too large.", 413);
      }
      chunks.push(value);
    }
    body = Buffer.concat(chunks, byteLength);
  } finally {
    reader.releaseLock();
    for (const chunk of chunks) chunk.fill(0);
  }

  if (!body) throw new RequestBodyError("Request body is required.", 400);
  return body;
}

export async function readJsonBody<T>(
  request: Request,
  maxBytes: number,
): Promise<T> {
  const body = await readRequestBody(request, maxBytes, "application/json");
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body)) as T;
  } catch {
    throw new RequestBodyError("Invalid JSON request body.", 400);
  } finally {
    body.fill(0);
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
