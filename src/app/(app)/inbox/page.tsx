import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import {
  Inbox,
  CheckCircle2,
  Clock,
  AlertCircle,
  Circle,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { RequestForm } from "./request-form";

const REQUEST_STATUS: Record<
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
  architecture: "Architecture",
  security: "Security",
  documentation: "Documentation",
  configuration: "Configuration",
  performance: "Performance",
  question: "Question",
};

export default async function InboxPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    include: {
      runtimeRequests: {
        orderBy: { updatedAt: "desc" },
        take: 20,
      },
    },
  });

  if (!company) redirect("/onboarding");

  const active = company.runtimeRequests.filter(
    (r) => !["complete", "cancelled"].includes(r.status)
  );
  const completed = company.runtimeRequests.filter((r) =>
    ["complete", "cancelled"].includes(r.status)
  );

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <header className="flex h-12 items-center border-b border-neutral-800 px-6">
        <h1 className="text-sm font-semibold text-neutral-100">Inbox</h1>
      </header>

      <div className="flex flex-col gap-8 p-6">
        {/* Submit request */}
        <section>
          <div className="mb-3 text-sm font-medium text-neutral-200">
            Submit a request
          </div>
          <RequestForm />
        </section>

        {/* Active requests */}
        {active.length > 0 && (
          <section>
            <div className="mb-3 text-sm font-medium text-neutral-200">
              Active ({active.length})
            </div>
            <div className="grid gap-2">
              {active.map((req) => {
                const cfg =
                  REQUEST_STATUS[req.status] ?? REQUEST_STATUS["intake"];
                const Icon = cfg.icon;
                return (
                  <Link
                    key={req.id}
                    href={`/inbox/requests/${req.id}`}
                    className="group flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3.5 transition-colors hover:border-neutral-700 hover:bg-neutral-800"
                  >
                    <Icon className={cn("h-3.5 w-3.5 shrink-0", cfg.color)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-200 truncate">
                        {req.title}
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-600">
                        <span className={cn("font-medium", cfg.color)}>
                          {cfg.label}
                        </span>
                        {req.assignedTo && ` · ${req.assignedTo}`}
                        {req.requestType && (
                          <>
                            {" "}
                            ·{" "}
                            {REQUEST_TYPE_LABELS[req.requestType] ??
                              req.requestType}
                          </>
                        )}
                      </p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-neutral-700 group-hover:text-neutral-500 transition-colors" />
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Completed */}
        {completed.length > 0 && (
          <section>
            <div className="mb-3 text-sm font-medium text-neutral-500">
              Completed ({completed.length})
            </div>
            <div className="grid gap-2">
              {completed.map((req) => (
                <Link
                  key={req.id}
                  href={`/inbox/requests/${req.id}`}
                  className="group flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900/50 px-4 py-3 text-sm text-neutral-500 transition-colors hover:border-neutral-700"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-neutral-600" />
                  <span className="flex-1 truncate">{req.title}</span>
                  <span className="text-xs text-neutral-700 capitalize">
                    {req.status}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {company.runtimeRequests.length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-neutral-800 py-10 text-center">
            <Inbox className="h-5 w-5 text-neutral-600" />
            <div>
              <p className="text-sm font-medium text-neutral-400">
                No requests yet
              </p>
              <p className="mt-0.5 text-xs text-neutral-600">
                Submit a request above to put your company to work.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
