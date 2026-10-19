"use client";

import { Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useLocale } from "@/lib/i18n";
import type { SaftHeader } from "@/lib/types/saft";

interface AccountingBasisNoticeProps {
  header: Pick<SaftHeader, "taxAccountingBasis" | "headerComment">;
}

export function AccountingBasisNotice({ header }: AccountingBasisNoticeProps) {
  const { t } = useLocale();
  const notice = header.taxAccountingBasis === "E"
    ? {
        title: t("Faturação emitida por terceiros (E)"),
        description: t("Este SAF-T contém faturação emitida por um terceiro em nome e por conta do fornecedor. A empresa identificada no cabeçalho é o fornecedor; o emitente deve ser identificado no comentário do cabeçalho."),
      }
    : header.taxAccountingBasis === "S"
      ? {
          title: t("Autofaturação (S)"),
          description: t("Este SAF-T contém autofaturação: o cliente emite as faturas em nome e por conta do fornecedor. A empresa identificada no cabeçalho é o fornecedor."),
        }
      : null;

  if (!notice) return null;

  return (
    <Alert role="status" aria-labelledby="accounting-basis-title">
      <Info aria-hidden="true" />
      <AlertTitle id="accounting-basis-title" className="line-clamp-none">
        <h2>{notice.title}</h2>
      </AlertTitle>
      <AlertDescription>
        <p>{notice.description}</p>
        {header.taxAccountingBasis === "E" && header.headerComment && (
          <p className="break-words whitespace-pre-wrap">
            <span className="font-medium">{t("Comentário do cabeçalho")}: </span>
            {header.headerComment}
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}
