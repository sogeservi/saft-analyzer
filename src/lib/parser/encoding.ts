export type FileEncoding = "utf-8" | "utf-16-be" | "utf-16-le" | "ascii";

export interface EncodingResult {
  encoding: FileEncoding;
  hasBOM: boolean;
  bomBytes: number;
}

export function detectEncoding(
  buffer: Uint8Array,
): EncodingResult {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xef &&
    buffer[1] === 0xbb &&
    buffer[2] === 0xbf
  ) {
    return { encoding: "utf-8", hasBOM: true, bomBytes: 3 };
  }
  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    return { encoding: "utf-16-be", hasBOM: true, bomBytes: 2 };
  }
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return { encoding: "utf-16-le", hasBOM: true, bomBytes: 2 };
  }
  return { encoding: "ascii", hasBOM: false, bomBytes: 0 };
}

export function detectXmlDeclaredEncoding(
  xmlStart: string,
): string | null {
  const match = xmlStart.match(
    /<\?xml[^?]*encoding=["']([^"']+)["'][^?]*\?>/,
  );
  return match ? match[1].toUpperCase() : null;
}
