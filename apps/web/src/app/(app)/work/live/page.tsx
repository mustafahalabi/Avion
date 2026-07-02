import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { loadLivePipeline } from "@/lib/live-pipeline-data";
import { LiveFlowBoard } from "@/components/live/live-flow-board";

// `/work/live` is the per-outcome **pipeline graph** (React Flow) streamed over
// in-app **SSE** (`/api/work/live/stream`). This is intentionally distinct from
// `/board` (the realtime **kanban board** over Socket.IO via `@avion/api`); see the
// MUS-260 decision in AGENTS.md. Render a fresh snapshot on every load; the board
// then streams its own updates in place — no full-page polling.
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
