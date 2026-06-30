import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { loadLivePipeline } from "@/lib/live-pipeline-data";
import { LiveFlowBoard } from "@/components/live/live-flow-board";

// Render a fresh snapshot on every load; the board then streams its own updates
// over SSE (`/api/work/live/stream`) and updates in place — no full-page polling.
export const dynamic = "force-dynamic";

export default async function LivePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) redirect("/onboarding");

  const initial = await loadLivePipeline(company.id);

  return <LiveFlowBoard initial={initial} />;
}
