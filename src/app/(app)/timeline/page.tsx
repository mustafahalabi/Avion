import { getCurrentUser } from "@/lib/current-user";
import { getPlanningLifecycleTimeline } from "@/lib/outcome-planning-lifecycle";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { TrendingUp } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const EVENT_TYPE_CONFIG: Record<string, { color: string; dot: string }> = {
  intake: { color: "text-blue-400", dot: "bg-blue-500" },
  planning: { color: "text-violet-400", dot: "bg-violet-500" },
  awaiting_approval: { color: "text-amber-400", dot: "bg-amber-500" },
  executing: { color: "text-emerald-400", dot: "bg-emerald-500" },
  in_review: { color: "text-amber-400", dot: "bg-amber-400" },
  in_qa: { color: "text-purple-400", dot: "bg-purple-500" },
  complete: { color: "text-emerald-400", dot: "bg-emerald-600" },
  blocked: { color: "text-red-400", dot: "bg-red-500" },
  cancelled: { color: "text-neutral-600", dot: "bg-neutral-700" },
};

type TimelineEvent = {
  id: string;
  type: string;
  description: string;
  actor: string | null;
  createdAt: Date;
  request: { id: string; title: string; status: string; requestType: string };
};

function groupByDate(events: TimelineEvent[]): Record<string, TimelineEvent[]> {
  const groups: Record<string, TimelineEvent[]> = {};
  for (const event of events) {
    const key = new Date(event.createdAt).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    if (!groups[key]) groups[key] = [];
    groups[key].push(event);
  }
  return groups;
}

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

  const mergedTimeline = [
    ...events.map((event) => ({
      id: `runtime-${event.id}`,
      createdAt: event.createdAt,
      description: event.description,
      href: `/inbox/requests/${event.request.id}`,
      contextLabel: event.request.title,
      type: event.type,
      source: "runtime" as const,
    })),
    ...planningTimeline.map((event) => ({
      id: `planning-${event.id}`,
      createdAt: event.createdAt,
      description: event.summary,
      href: event.href,
      contextLabel: event.outcomeTitle ?? "Outcome planning",
      type: event.eventType,
      source: "planning" as const,
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 100);

  const grouped = groupByDate(
    mergedTimeline.map((event) => ({
      id: event.id,
      type: event.type,
      description: event.description,
      actor: null,
      createdAt: event.createdAt,
      request: {
        id: event.href,
        title: event.contextLabel,
        status: event.source,
        requestType: event.type,
      },
    }))
  );
  const dateKeys = Object.keys(grouped);

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <header className="flex h-12 items-center justify-between border-b border-neutral-800 px-6">
        <h1 className="text-sm font-semibold text-neutral-100">Timeline</h1>
        <span className="text-xs text-neutral-600">
          {mergedTimeline.length} event{mergedTimeline.length === 1 ? "" : "s"}
        </span>
      </header>

      <div className="flex flex-col p-6 max-w-2xl">
        {mergedTimeline.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-neutral-800 py-14 text-center">
            <TrendingUp className="h-5 w-5 text-neutral-700" />
            <div>
              <p className="text-sm font-medium text-neutral-500">
                No timeline events yet
              </p>
              <p className="mt-0.5 text-xs text-neutral-700">
                Events appear here as your company processes requests and moves
                work through the pipeline.
              </p>
            </div>
            <Link
              href="/inbox"
              className="rounded-lg border border-neutral-700 px-4 py-2 text-xs font-medium text-neutral-400 hover:bg-neutral-800 transition-colors"
            >
              Submit first request →
            </Link>
          </div>
        ) : (
          dateKeys.map((dateKey) => {
            const dayEvents = grouped[dateKey];
            return (
              <div key={dateKey} className="mb-8">
                <div className="mb-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-neutral-800" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-600">
                    {dateKey}
                  </span>
                  <div className="h-px flex-1 bg-neutral-800" />
                </div>

                <div className="flex flex-col">
                  {dayEvents.map((event, i) => {
                    const cfg =
                      EVENT_TYPE_CONFIG[event.type] ??
                      EVENT_TYPE_CONFIG["intake"];
                    return (
                      <div key={event.id} className="flex items-start gap-4">
                        <div className="flex flex-col items-center">
                          <div
                            className={cn(
                              "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                              cfg.dot
                            )}
                          />
                          {i < dayEvents.length - 1 && (
                            <div className="w-px flex-1 bg-neutral-800 mt-1" style={{ minHeight: "20px" }} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 pb-4">
                          <p className="text-sm text-neutral-300 leading-relaxed">
                            {event.description}
                          </p>
                          <div className="mt-1 flex items-center gap-2 text-[11px] text-neutral-700">
                            <Link
                              href={
                                event.request.id.startsWith("/")
                                  ? event.request.id
                                  : `/inbox/requests/${event.request.id}`
                              }
                              className="truncate hover:text-neutral-500 transition-colors"
                            >
                              {event.request.title}
                            </Link>
                            <span>·</span>
                            <span
                              className={cn("font-medium capitalize", cfg.color)}
                            >
                              {event.type.replace(/_/g, " ")}
                            </span>
                            {event.actor && (
                              <>
                                <span>·</span>
                                <span>{event.actor}</span>
                              </>
                            )}
                            <span>·</span>
                            <span className="shrink-0">
                              {new Date(event.createdAt).toLocaleTimeString(
                                "en-US",
                                { hour: "numeric", minute: "2-digit" }
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
