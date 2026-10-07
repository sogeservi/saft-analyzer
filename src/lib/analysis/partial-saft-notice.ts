import type { SaftFile } from "@/lib/types/saft";

export function getPartialSaftNotice(saftData: SaftFile): string | null {
  const productsMissing = saftData.masterFiles.products.length === 0;
  const taxTableMissing = saftData.masterFiles.taxTable.length === 0;

  if (!productsMissing && !taxTableMissing) return null;

  if (productsMissing && taxTableMissing) {
    return "Este ficheiro não inclui a lista de produtos nem a tabela de impostos. O analisador não executa validações de negócio em ficheiros parciais; exporte um SAF-T completo para validar os restantes dados.";
  }

  if (productsMissing) {
    return "Este ficheiro não inclui a lista de produtos; a tabela de impostos está presente. O analisador não executa validações de negócio em ficheiros parciais; exporte um SAF-T completo para validar os restantes dados.";
  }

  return "Este ficheiro não inclui a tabela de impostos; a lista de produtos está presente. O analisador não executa validações de negócio em ficheiros parciais; exporte um SAF-T completo para validar os restantes dados.";
}
