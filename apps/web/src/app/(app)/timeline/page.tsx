import { getCurrentUser } from "@/lib/current-user";
import { getPlanningLifecycleTimeline } from "@/lib/outcome-planning-lifecycle";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { TimelineList } from "@/components/timeline-list";
import type { TimelineItem } from "@/components/timeline-entry";

export default async function TimelinePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true, name: true },
  });
  if (!company) redirect("/onboarding");

  const [events, planningTimeline] = await Promise.all([
    prisma.runtimeEvent.findMany({
      where: { request: { companyId: company.id } },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        request: {
          select: { id: true, title: true, status: true, requestType: true },
        },
      },
    }),
    getPlanningLifecycleTimeline(company.id, 50),
  ]);

  const items: TimelineItem[] = [
    ...events.map((event) => ({
      id: `runtime-${event.id}`,
      createdAt: event.createdAt,
      description: event.description,
      contextHref: `/inbox/requests/${event.request.id}`,
      contextLabel: event.request.title,
      type: event.type,
    })),
    ...planningTimeline.map((event) => ({
      id: `planning-${event.id}`,
      createdAt: event.createdAt,
      description: event.summary,
      contextHref: event.href,
      contextLabel: event.outcomeTitle ?? "Outcome planning",
      type: event.eventType,
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 100);

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <header className="flex h-12 items-center justify-between border-b border-neutral-800 px-6">
        <h1 className="text-sm font-semibold text-neutral-100">Timeline</h1>
        <span className="text-xs text-neutral-600">
          {items.length} event{items.length === 1 ? "" : "s"}
        </span>
      </header>

      <div className="flex flex-col p-6">
        <TimelineList items={items} />
      </div>
    </div>
  );
}
