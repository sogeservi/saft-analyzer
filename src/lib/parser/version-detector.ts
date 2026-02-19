export const SUPPORTED_VERSIONS = [
  "1.01_01",
  "1.02_01",
  "1.03_01",
  "1.04_01",
] as const;

export type SaftVersion = (typeof SUPPORTED_VERSIONS)[number];

export function isSupportedVersion(
  version: string,
): version is SaftVersion {
  return (SUPPORTED_VERSIONS as readonly string[]).includes(version);
}

export function detectVersionFromXml(xmlStart: string): string | null {
  const match = xmlStart.match(
    /<AuditFileVersion>([^<]+)<\/AuditFileVersion>/,
  );
  return match ? match[1].trim() : null;
}

export function detectNamespaceVersion(xmlStart: string): string | null {
  const match = xmlStart.match(
    /urn:OECD:StandardAuditFile-Tax:PT_([\d._]+)/,
  );
  return match ? match[1] : null;
}
