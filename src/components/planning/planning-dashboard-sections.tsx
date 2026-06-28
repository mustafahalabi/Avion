import Link from "next/link";
import { ChevronRight, ClipboardCheck, FileText } from "lucide-react";
import type { ReactNode } from "react";

import {
  buildOutcomePlanningUrl,
  type PlanningDashboardPlanItem,
} from "@/lib/outcome-planning-lifecycle";
import { cn } from "@/lib/utils";

interface PlanningDashboardSectionsProps {
  readonly pendingPlans: readonly PlanningDashboardPlanItem[];
  readonly approvedPlans: readonly PlanningDashboardPlanItem[];
}

const PLAN_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  reviewing: "Reviewing",
  approved: "Approved",
};

/**
 * Dashboard sections for pending and recently approved planning drafts.
 *
 * @param props - Planning dashboard rows.
 * @returns CEO-facing planning visibility blocks.
 */
export function PlanningDashboardSections({
  pendingPlans,
  approvedPlans,
}: PlanningDashboardSectionsProps) {
  if (pendingPlans.length === 0 && approvedPlans.length === 0) {
    return null;
  }

  return (
    <>
      {pendingPlans.length > 0 && (
        <section>
          <SectionHeader
            label="Plans Awaiting Review"
            icon={<FileText className="h-3.5 w-3.5 text-amber-400" />}
            count={pendingPlans.length}
          />
          <p className="mb-3 text-xs text-neutral-600">
            Generated plans are proposals only. Review and approve before any projects,
            features, or tasks are created. Agent execution does not start automatically.
          </p>
          <div className="grid gap-2">
            {pendingPlans.map((plan) => (
              <PlanRow key={plan.planningDraftId} plan={plan} tone="pending" />
            ))}
          </div>
        </section>
      )}

      {approvedPlans.length > 0 && (
        <section>
          <SectionHeader
            label="Recently Approved Plans"
            icon={<ClipboardCheck className="h-3.5 w-3.5 text-emerald-400" />}
            count={approvedPlans.length}
          />
          <p className="mb-3 text-xs text-neutral-600">
            These plans are approved but work records may not exist yet. Apply the plan to
            create projects, features, and tasks.
          </p>
          <div className="grid gap-2">
            {approvedPlans.map((plan) => (
              <PlanRow key={plan.planningDraftId} plan={plan} tone="approved" />
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function PlanRow({
  plan,
  tone,
}: {
  plan: PlanningDashboardPlanItem;
  tone: "pending" | "approved";
}) {
  return (
    <Link
      href={buildOutcomePlanningUrl(plan.outcomeId)}
      className={cn(
        "group flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors",
        tone === "pending" &&
          "border-amber-900/40 bg-amber-950/10 hover:border-amber-800/60 hover:bg-amber-950/20",
        tone === "approved" &&
          "border-emerald-900/40 bg-emerald-950/10 hover:border-emerald-800/60 hover:bg-emerald-950/20"
      )}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-neutral-200 truncate">{plan.outcomeTitle}</p>
        <p className="mt-0.5 text-xs text-neutral-500 truncate">{plan.planTitle}</p>
        <p className="mt-1 text-[11px] text-neutral-600">
          {PLAN_STATUS_LABELS[plan.status] ?? plan.status}
          {" · "}
          {new Date(plan.updatedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </p>
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-neutral-700 group-hover:text-neutral-500 transition-colors" />
    </Link>
  );
}

function SectionHeader({
  label,
  icon,
  count,
}: {
  label: string;
  icon: ReactNode;
  count: number;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      {icon}
      <h3 className="text-sm font-medium text-neutral-200">{label}</h3>
      <span className="rounded-full bg-neutral-800 px-1.5 py-0.5 text-[10px] font-medium text-neutral-400">
        {count}
      </span>
    </div>
  );
}
