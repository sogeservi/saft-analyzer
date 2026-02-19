import type { PatchDocument } from "../types/errors";

export function patchToJson(patch: PatchDocument): string {
  return JSON.stringify(patch, null, 2);
}

export function patchToText(patch: PatchDocument): string {
  const lines: string[] = [
    `# Documento de Correções SAF-T`,
    `# Ficheiro: ${patch.sourceFile}`,
    `# Gerado em: ${patch.analyzedAt}`,
    `# Total de correções: ${patch.fixes.length}`,
    ``,
    `---`,
  ];

  for (let i = 0; i < patch.fixes.length; i++) {
    const fix = patch.fixes[i];
    lines.push(``);
    lines.push(`## Correção ${i + 1}: ${fix.errorCode}`);
    lines.push(`Caminho: ${fix.path}`);
    lines.push(`Valor original: ${fix.originalValue}`);
    lines.push(`Valor corrigido: ${fix.correctedValue}`);
    lines.push(`Descrição: ${fix.description}`);
  }

  return lines.join("\n");
}
