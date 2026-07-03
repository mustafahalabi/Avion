import { redirect } from "next/navigation";

import type { Metadata } from "next";

import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { loadLivePipeline } from "@/lib/live-pipeline-data";
import { MissionControl } from "@/components/live/mission-control";

// `/work/live` is **Mission Control** — the single canonical live surface. It
// shows which agents are running (adapter + role), where (task/repo/branch/PR),
// and for how long (live-ticking timers), with Agents / Graph / Board / Feed
// lenses over one data model. It replaces the previously-overlapping `/board`
// and `/work/board` (both now redirect here). Streamed in place over SSE
// (`/api/work/live/stream`) — no full-page polling.
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Mission Control" };

export default async function LivePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) redirect("/onboarding");

  const initial = await loadLivePipeline(company.id);

  return <MissionControl initial={initial} />;
}
