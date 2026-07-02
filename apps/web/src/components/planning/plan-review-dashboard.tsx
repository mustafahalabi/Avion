import {
  AlertTriangle,
  ClipboardList,
  GitBranch,
  Layers,
  ListChecks,
  ShieldCheck,
  Truck,
  Users,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import type { PlanningReviewView } from "@/lib/planning-review-view";
import { cn } from "@/lib/utils";

import { PlanReviewActions } from "./plan-review-actions";

interface PlanReviewDashboardProps {
  readonly plan: PlanningReviewView;
  readonly outcomeTitle: string;
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "border-neutral-700 bg-neutral-900 text-neutral-400" },
  reviewing: { label: "Reviewing", className: "border-amber-900 bg-amber-950/30 text-amber-400" },
  approved: { label: "Approved", className: "border-emerald-900 bg-emerald-950/30 text-emerald-400" },
  rejected: { label: "Rejected", className: "border-red-900 bg-red-950/30 text-red-400" },
  applied: { label: "Applied", className: "border-emerald-900 bg-emerald-950/20 text-emerald-500" },
  failed: { label: "Failed", className: "border-red-900 bg-red-950/30 text-red-400" },
};

/** Planner-provenance badge colors (MUS-271). */
const PROVENANCE_TONES: Record<string, string> = {
  ai: "border-violet-900 bg-violet-950/30 text-violet-300",
  deterministic: "border-neutral-700 bg-neutral-900 text-neutral-400",
  fallback: "border-amber-900 bg-amber-950/30 text-amber-400",
};

/**
 * Renders the CEO-facing planning draft review dashboard.
 *
 * @param props - Planning draft review data and source outcome title.
 * @returns Structured plan review sections with approval controls.
 */
export function PlanReviewDashboard({ plan, outcomeTitle }: PlanReviewDashboardProps) {
  const statusCfg = STATUS_LABELS[plan.status] ?? STATUS_LABELS.draft;

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider text-neutral-600">Outcome</p>
            <h2 className="mt-1 text-lg font-semibold text-neutral-100">{outcomeTitle}</h2>
            <p className="mt-2 text-sm text-neutral-400">{plan.title}</p>
            {plan.summary && (
              <p className="mt-2 text-sm leading-relaxed text-neutral-500">{plan.summary}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-medium",
                statusCfg.className
              )}
            >
              {statusCfg.label} · v{plan.version}
            </div>
            <div
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-medium",
                PROVENANCE_TONES[plan.provenance.tone] ?? PROVENANCE_TONES.deterministic
              )}
              title={plan.provenance.detail ?? undefined}
            >
              {plan.provenance.label}
            </div>
          </div>
        </div>

        {plan.provenance.tone === "fallback" && plan.provenance.detail && (
          <Notice tone="warning" title="AI planning fell back to the deterministic template">
            {plan.provenance.detail}
          </Notice>
        )}

        {plan.executionNotStarted && plan.status !== "rejected" && plan.status !== "failed" && (
          <p className="mt-4 rounded-md border border-blue-900/50 bg-blue-950/20 px-3 py-2 text-xs text-blue-200">
            Execution has not started. Review this generated plan before any projects, features,
            or tasks are created.
          </p>
        )}

        {plan.generationError && (
          <Notice tone="error" title="Generation error">
            {plan.generationError}
          </Notice>
        )}

        {plan.applicationError && (
          <Notice tone="error" title="Application error">
            {plan.applicationError}
          </Notice>
        )}

        {plan.rejectionReason && (
          <Notice tone="warning" title="Rejection reason">
            {plan.rejectionReason}
          </Notice>
        )}

        {plan.approvalNotes && (
          <Notice tone="success" title="Approval notes">
            {plan.approvalNotes}
          </Notice>
        )}
      </section>

      <PlanReviewActions plan={plan} />

      <Panel title="Scope" icon={ClipboardList}>
        <BulletList items={plan.scope} empty="No scope items recorded." />
        {plan.nonScope.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-neutral-600">
              Out of scope
            </p>
            <BulletList items={plan.nonScope} />
          </div>
        )}
      </Panel>

      <Panel title="Projects & Milestones" icon={Layers}>
        {plan.projects.length === 0 ? (
          <EmptyLine>No generated projects in this draft.</EmptyLine>
        ) : (
          plan.projects.map((project) => (
            <div
              key={project.planItemId}
              className="mb-3 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-3 last:mb-0"
            >
              <p className="text-sm font-medium text-neutral-200">{project.name}</p>
              <p className="mt-1 text-xs text-neutral-500">{project.description}</p>
              <p className="mt-2 text-[11px] text-neutral-600">
                Owner: {project.ownerRole}
                {project.ownerEmployeeName ? ` · ${project.ownerEmployeeName}` : ""}
              </p>
              {project.milestones.length > 0 && (
                <div className="mt-3 flex flex-col gap-2">
                  {project.milestones.map((milestone) => (
                    <div
                      key={milestone.id}
                      className="rounded border border-neutral-800 bg-neutral-900/60 px-2.5 py-2"
                    >
                      <p className="text-xs font-medium text-neutral-300">{milestone.title}</p>
                      <p className="mt-1 text-[11px] text-neutral-500">{milestone.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </Panel>

      <Panel title="Features" icon={GitBranch}>
        {plan.features.length === 0 ? (
          <EmptyLine>No generated features in this draft.</EmptyLine>
        ) : (
          plan.features.map((feature) => (
            <div
              key={feature.planItemId}
              className="mb-2 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 last:mb-0"
            >
              <p className="text-sm font-medium text-neutral-200">{feature.title}</p>
              <p className="mt-1 text-xs text-neutral-500">{feature.description}</p>
              <p className="mt-1 text-[11px] text-neutral-600">Owner: {feature.ownerRole}</p>
            </div>
          ))
        )}
      </Panel>

      <Panel title="Tasks" icon={ListChecks}>
        {plan.tasks.length === 0 ? (
          <EmptyLine>No generated tasks in this draft.</EmptyLine>
        ) : (
          plan.tasks.map((task) => (
            <div
              key={task.planItemId}
              className="mb-2 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 last:mb-0"
            >
              <p className="text-sm font-medium text-neutral-200">{task.title}</p>
              <p className="mt-1 text-xs text-neutral-500">{task.description}</p>
              <p className="mt-1 text-[11px] text-neutral-600">
                Role: {task.recommendedRole}
                {task.recommendedEmployeeName ? ` · ${task.recommendedEmployeeName}` : ""}
                {" · "}
                {task.estimatePoints} pts
              </p>
              {task.acceptanceCriteria.length > 0 && (
                <BulletList items={task.acceptanceCriteria} compact />
              )}
            </div>
          ))
        )}
      </Panel>

      <Panel title="Risks" icon={AlertTriangle}>
        {plan.risks.length === 0 ? (
          <EmptyLine>No risks recorded.</EmptyLine>
        ) : (
          plan.risks.map((risk) => (
            <div
              key={risk.id}
              className="mb-2 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 last:mb-0"
            >
              <p className="text-xs font-medium text-neutral-200">
                [{risk.severity}] {risk.description}
              </p>
              <p className="mt-1 text-[11px] text-neutral-500">Mitigation: {risk.mitigation}</p>
              <p className="mt-1 text-[11px] text-neutral-600">Owner: {risk.ownerRole}</p>
            </div>
          ))
        )}
      </Panel>

      <Panel title="Assignments" icon={Users}>
        {plan.recommendedAssignments.length === 0 ? (
          <EmptyLine>No assignment recommendations recorded.</EmptyLine>
        ) : (
          plan.recommendedAssignments.map((assignment) => (
            <div
              key={`${assignment.role}-${assignment.employeeId ?? "unassigned"}`}
              className="mb-2 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 last:mb-0"
            >
              <p className="text-xs font-medium text-neutral-200">
                {assignment.role}
                {assignment.employeeName ? ` · ${assignment.employeeName}` : " · Unassigned"}
              </p>
              <p className="mt-1 text-[11px] text-neutral-500">{assignment.reason}</p>
            </div>
          ))
        )}
      </Panel>

      {plan.reviewPlan && (
        <Panel title="Review Plan" icon={ShieldCheck}>
          <KeyValue label="Owner" value={plan.reviewPlan.ownerRole} />
          <KeyValue label="Approval gate" value={plan.reviewPlan.approvalGate} />
          <BulletList items={plan.reviewPlan.requiredReviewers} prefix="Required reviewers:" />
          <BulletList items={plan.reviewPlan.checkpoints} prefix="Checkpoints:" />
        </Panel>
      )}

      {plan.qaPlan && (
        <Panel title="QA Plan" icon={ShieldCheck}>
          <KeyValue label="Owner" value={plan.qaPlan.ownerRole} />
          <KeyValue label="Strategy" value={plan.qaPlan.strategy} />
          <BulletList items={plan.qaPlan.requiredChecks} prefix="Required checks:" />
          <BulletList items={plan.qaPlan.evidenceRequired} prefix="Evidence required:" />
        </Panel>
      )}

      {plan.releasePlan && (
        <Panel title="Release Plan" icon={Truck}>
          <KeyValue label="Owner" value={plan.releasePlan.ownerRole} />
          <KeyValue label="Strategy" value={plan.releasePlan.strategy} />
          <BulletList items={plan.releasePlan.readinessCriteria} prefix="Readiness criteria:" />
          <BulletList items={plan.releasePlan.rolloutSteps} prefix="Rollout steps:" />
          <KeyValue label="Rollback plan" value={plan.releasePlan.rollbackPlan} />
        </Panel>
      )}

      {plan.dependencies.length > 0 && (
        <Panel title="Dependencies" icon={GitBranch}>
          {plan.dependencies.map((dependency) => (
            <div
              key={dependency.id}
              className="mb-2 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 last:mb-0"
            >
              <p className="text-xs font-medium text-neutral-200">
                [{dependency.type}] {dependency.description}
              </p>
            </div>
          ))}
        </Panel>
      )}

      {plan.assumptions.length > 0 && (
        <Panel title="Assumptions" icon={ClipboardList}>
          <BulletList items={plan.assumptions} />
        </Panel>
      )}
    </div>
  );
}

function Panel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-neutral-500" />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function BulletList({
  items,
  empty,
  compact = false,
  prefix,
}: {
  items: readonly string[];
  empty?: string;
  compact?: boolean;
  prefix?: string;
}) {
  if (items.length === 0) {
    return empty ? <EmptyLine>{empty}</EmptyLine> : null;
  }

  return (
    <div className={compact ? "mt-2" : undefined}>
      {prefix && <p className="mb-1 text-[11px] text-neutral-600">{prefix}</p>}
      <ul className={cn("flex flex-col gap-1", compact ? "text-[11px]" : "text-xs")}>
        {items.map((item) => (
          <li key={item} className="text-neutral-400">
            · {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <p className="mb-2 text-xs text-neutral-400">
      <span className="text-neutral-600">{label}: </span>
      {value}
    </p>
  );
}

function Notice({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "error" | "warning" | "success";
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "mt-4 rounded-md border px-3 py-2 text-xs",
        tone === "error" && "border-red-900 bg-red-950/20 text-red-200",
        tone === "warning" && "border-amber-900 bg-amber-950/20 text-amber-200",
        tone === "success" && "border-emerald-900 bg-emerald-950/20 text-emerald-200"
      )}
    >
      <p className="font-medium">{title}</p>
      <p className="mt-1 opacity-90">{children}</p>
    </div>
  );
}

function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="text-xs text-neutral-500">{children}</p>;
}
