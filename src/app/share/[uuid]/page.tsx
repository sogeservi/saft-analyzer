import { notFound } from "next/navigation";
import { tempStore } from "@/lib/store/temp-store";
import { SharedResultView } from "./shared-result-view";

interface SharePageProps {
  params: Promise<{ uuid: string }>;
}

export default async function SharePage({ params }: SharePageProps) {
  const { uuid } = await params;
  const entry = await tempStore.get(uuid);

  if (!entry) {
    notFound();
  }

  return (
    <SharedResultView result={entry.result} expiresAt={entry.expiresAt} />
  );
}
