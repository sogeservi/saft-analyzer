import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SharedResultView } from "./shared-result-view";
import { getShare } from "@/lib/server/share-store";
import type { AnalysisResult } from "@/lib/types/analysis";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function SharedPage({
  params,
}: {
  params: Promise<{ uuid: string }>;
}) {
  const { uuid } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(uuid)) notFound();

  const share = getShare(uuid);
  if (!share) notFound();

  let result: AnalysisResult;
  try {
    result = JSON.parse(share.payload.toString("utf8")) as AnalysisResult;
  } catch {
    notFound();
  }

  return <SharedResultView result={result} expiresAt={share.expiresAt} />;
}
