import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  AlertCircle,
  Circle,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { RequestStatusControls } from "./request-status-controls";

interface Props {
  params: Promise<{ id: string }>;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; icon: React.ElementType }
> = {
  intake: { label: "Intake", color: "text-blue-400", icon: Circle },
  planning: { label: "Planning", color: "text-violet-400", icon: Clock },
  awaiting_approval: {
    label: "Awaiting Approval",
    color: "text-amber-400",
    icon: AlertCircle,
  },
  executing: { label: "Executing", color: "text-emerald-400", icon: Clock },
  in_review: { label: "In Review", color: "text-amber-400", icon: Clock },
  in_qa: { label: "In QA", color: "text-purple-400", icon: Clock },
  complete: {
    label: "Complete",
    color: "text-emerald-400",
    icon: CheckCircle2,
  },
  blocked: { label: "Blocked", color: "text-red-400", icon: AlertCircle },
  cancelled: { label: "Cancelled", color: "text-neutral-600", icon: Circle },
};

const REQUEST_TYPE_LABELS: Record<string, string> = {
  feature: "New feature",
  bug: "Bug fix",
  architecture: "Architecture question",
  security: "Security concern",
  documentation: "Documentation",
  configuration: "Configuration change",
  performance: "Performance concern",
  question: "General question",
};

export default async function RequestDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) redirect("/onboarding");

  const request = await prisma.runtimeRequest.findFirst({
    where: { id, companyId: company.id },
    include: {
      events: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!request) notFound();

  const cfg = STATUS_CONFIG[request.status] ?? STATUS_CONFIG["intake"];
  const Icon = cfg.icon;
  const isTerminal = ["complete", "cancelled"].includes(request.status);

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <header className="flex h-12 items-center gap-3 border-b border-neutral-800 px-6">
        <Link
          href="/inbox"
          className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Inbox
        </Link>
        <span className="text-neutral-700">/</span>
        <h1 className="text-sm font-semibold text-neutral-100 truncate">
          {request.title}
        </h1>
      </header>

      <div className="flex flex-col gap-8 p-6 max-w-2xl">
        {/* Header */}
        <section className="flex items-start gap-3">
          <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", cfg.color)} />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold text-neutral-100">
                {request.title}
              </h2>
              <span className="rounded-full border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-[10px] font-medium text-neutral-400">
                {REQUEST_TYPE_LABELS[request.requestType] ??
                  request.requestType}
              </span>
            </div>
            <p className={cn("mt-0.5 text-xs font-medium", cfg.color)}>
              {cfg.label}
              {request.assignedTo && (
                <span className="font-normal text-neutral-500">
                  {" "}
                  · {request.assignedTo}
                </span>
              )}
            </p>
          </div>
        </section>

        {/* Goal */}
        <section>
          <SectionLabel>Request</SectionLabel>
          <p className="mt-2 text-sm text-neutral-300 leading-relaxed whitespace-pre-wrap">
            {request.goal}
          </p>
        </section>

        {/* Clarification */}
        {request.clarification && (
          <section className="rounded-lg border border-amber-900/50 bg-amber-950/20 px-4 py-3">
            <SectionLabel>Clarification Needed</SectionLabel>
            <p className="mt-2 text-sm text-amber-200 leading-relaxed">
              {request.clarification}
            </p>
          </section>
        )}

        {/* Resolution */}
        {request.resolution && (
          <section className="rounded-lg border border-emerald-900/50 bg-emerald-950/20 px-4 py-3">
            <SectionLabel>Resolution</SectionLabel>
            <p className="mt-2 text-sm text-emerald-200 leading-relaxed">
              {request.resolution}
            </p>
          </section>
        )}

        {/* Status controls */}
        {!isTerminal && (
          <RequestStatusControls
            requestId={request.id}
            currentStatus={request.status}
          />
        )}

        {/* Event timeline */}
        {request.events.length > 0 && (
          <section>
            <SectionLabel>Activity</SectionLabel>
            <div className="mt-3 flex flex-col gap-2">
              {request.events.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-3 text-sm"
                >
                  <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-600" />
                  <div className="flex-1">
                    <p className="text-neutral-400">{event.description}</p>
                    <p className="mt-0.5 text-[11px] text-neutral-700">
                      {event.actor && `${event.actor} · `}
                      {new Date(event.createdAt).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
      {children}
    </h3>
  );
}
