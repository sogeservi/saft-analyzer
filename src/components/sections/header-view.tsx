"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SaftHeader } from "@/lib/types/saft";
import type { ValidationError } from "@/lib/types/errors";
import { useLocale } from "@/lib/i18n";

interface HeaderViewProps {
  header: SaftHeader;
  errors: ValidationError[];
}

const HEADER_FIELDS: Array<{ key: string; label: string }> = [
  { key: "auditFileVersion", label: "Versão SAF-T" },
  { key: "companyID", label: "ID da empresa" },
  { key: "taxRegistrationNumber", label: "NIF" },
  { key: "taxAccountingBasis", label: "Base contabilística" },
  { key: "companyName", label: "Nome da empresa" },
  { key: "businessName", label: "Nome comercial" },
  { key: "fiscalYear", label: "Ano fiscal" },
  { key: "startDate", label: "Data início" },
  { key: "endDate", label: "Data fim" },
  { key: "currencyCode", label: "Moeda" },
  { key: "dateCreated", label: "Data de criação" },
  { key: "taxEntity", label: "Entidade fiscal" },
  { key: "productCompanyTaxID", label: "NIF empresa software" },
  { key: "softwareCertificateNumber", label: "Certificado software" },
  { key: "productID", label: "ID do produto" },
  { key: "productVersion", label: "Versão do produto" },
  { key: "telephone", label: "Telefone" },
  { key: "email", label: "Email" },
  { key: "website", label: "Website" },
];

export function HeaderView({ header, errors }: HeaderViewProps) {
  const { t } = useLocale();
  const headerRecord = header as unknown as Record<string, unknown>;

  return (
    <div className="space-y-4">
      {errors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive">
              {t("Erros")} ({errors.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {errors.map((err, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <Badge variant="destructive" className="shrink-0 text-xs">
                  {err.code}
                </Badge>
                <span>{err.message}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("Informação do cabeçalho")}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 sm:grid-cols-2">
            {HEADER_FIELDS.map(({ key, label }) => {
              const value = headerRecord[key];
              if (value === undefined || value === null || value === "")
                return null;
              return (
                <div key={key} className="space-y-1">
                  <dt className="text-xs text-muted-foreground">{t(label)}</dt>
                  <dd className="text-sm font-medium">{String(value)}</dd>
                </div>
              );
            })}
          </dl>
        </CardContent>
      </Card>

      {header.companyAddress && (
        <Card>
          <CardHeader>
            <CardTitle>{t("Morada")}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-2">
              {header.companyAddress.addressDetail && (
                <div className="space-y-1 sm:col-span-2">
                  <dt className="text-xs text-muted-foreground">{t("Morada")}</dt>
                  <dd className="text-sm font-medium">
                    {header.companyAddress.addressDetail}
                  </dd>
                </div>
              )}
              <div className="space-y-1">
                <dt className="text-xs text-muted-foreground">{t("Cidade")}</dt>
                <dd className="text-sm font-medium">
                  {header.companyAddress.city}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs text-muted-foreground">
                  {t("Código postal")}
                </dt>
                <dd className="text-sm font-medium">
                  {header.companyAddress.postalCode}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs text-muted-foreground">{t("País")}</dt>
                <dd className="text-sm font-medium">
                  {header.companyAddress.country}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
