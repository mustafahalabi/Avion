import { prisma } from "@/lib/prisma";
import {
  assertPlanningDraftCanCreateWork,
  buildGeneratedWorkTraceData,
  type PlanningDraftWorkGuardInput,
} from "@/lib/outcome-planning";
import { OUTCOME_PLANNING_EVENT_TYPES } from "@/lib/outcome-planning-lifecycle";
import { ensureDefaultWorkspace } from "@/lib/workspace-service";
import type {
  GeneratedPlanningProject,
  GeneratedPlanningFeature,
  GeneratedPlanningTask,
} from "@/lib/planning-generator";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ApprovePlanInput {
  readonly companyId: string;
  readonly planningDraftId: string;
  readonly actorId: string;
  readonly notes?: string;
}

export interface ApprovePlanOutput {
  readonly planningDraftId: string;
  readonly status: "approved" | "already_approved" | "already_applied";
}

export interface RejectPlanInput {
  readonly companyId: string;
  readonly planningDraftId: string;
  readonly actorId: string;
  readonly reason: string;
}

export interface RejectPlanOutput {
  readonly planningDraftId: string;
  readonly status: "rejected" | "already_rejected" | "already_applied";
}

export interface ApplyPlanInput {
  readonly companyId: string;
  readonly planningDraftId: string;
  readonly actorId: string;
}

export interface ApplyPlanOutput {
  readonly planningDraftId: string;
  readonly projectsCreated: number;
  readonly projectsUpdated: number;
  readonly featuresCreated: number;
  readonly featuresUpdated: number;
  readonly tasksCreated: number;
  readonly tasksUpdated: number;
}

// ─── Approve ─────────────────────────────────────────────────────────────────

/**
 * Approves a planning draft, allowing its work records to be applied.
 * Idempotent: calling on an already-approved or already-applied draft returns
 * the current state without error.
 */
export async function approvePlanningDraft(input: ApprovePlanInput): Promise<ApprovePlanOutput> {
  const draft = await prisma.planningDraft.findFirst({
    where: { id: input.planningDraftId, companyId: input.companyId },
    select: {
      id: true,
      status: true,
      outcomeId: true,
      approvedAt: true,
      rejectedAt: true,
    },
  });

  if (!draft) throw new Error("Planning draft not found.");

  if (draft.status === "applied") {
    return { planningDraftId: draft.id, status: "already_applied" };
  }

  if (draft.status === "approved") {
    return { planningDraftId: draft.id, status: "already_approved" };
  }

  if (draft.status === "rejected" || draft.status === "failed") {
    throw new Error(`Cannot approve a ${draft.status} planning draft.`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.planningDraft.update({
      where: { id: draft.id },
      data: {
        status: "approved",
        approvedAt: new Date(),
        approvedById: input.actorId,
        approvalNotes: input.notes ?? null,
      },
    });

    await tx.outcome.updateMany({
      where: { id: draft.outcomeId, companyId: input.companyId },
      data: { status: "approved", updatedAt: new Date() },
    });

    await tx.timelineEntry.create({
      data: {
        entityType: "planning_draft",
        entityId: draft.id,
        eventType: OUTCOME_PLANNING_EVENT_TYPES.planApproved,
        summary: "Planning draft approved.",
        actorId: input.actorId,
        metadata: JSON.stringify({ planningDraftId: draft.id, notes: input.notes ?? null }),
      },
    });
  });

  return { planningDraftId: draft.id, status: "approved" };
}

// ─── Reject ───────────────────────────────────────────────────────────────────

/**
 * Rejects a planning draft without creating work records.
 * Idempotent: calling on an already-rejected draft returns the current state.
 *
 * @param input - Rejection context including reason.
 * @returns Rejection result status.
 */
export async function rejectPlanningDraft(input: RejectPlanInput): Promise<RejectPlanOutput> {
  const reason = input.reason.trim();
  if (reason.length === 0) {
    throw new Error("Rejection reason is required.");
  }

  const draft = await prisma.planningDraft.findFirst({
    where: { id: input.planningDraftId, companyId: input.companyId },
    select: {
      id: true,
      status: true,
      outcomeId: true,
      rejectedAt: true,
    },
  });

  if (!draft) throw new Error("Planning draft not found.");

  if (draft.status === "applied") {
    return { planningDraftId: draft.id, status: "already_applied" };
  }

  if (draft.status === "rejected") {
    return { planningDraftId: draft.id, status: "already_rejected" };
  }

  if (draft.status === "approved") {
    throw new Error("Cannot reject an approved planning draft.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.planningDraft.update({
      where: { id: draft.id },
      data: {
        status: "rejected",
        rejectedAt: new Date(),
        rejectedById: input.actorId,
        rejectionReason: reason,
      },
    });

    await tx.outcome.updateMany({
      where: { id: draft.outcomeId, companyId: input.companyId },
      data: { status: "rejected", updatedAt: new Date() },
    });

    await tx.timelineEntry.create({
      data: {
        entityType: "planning_draft",
        entityId: draft.id,
        eventType: OUTCOME_PLANNING_EVENT_TYPES.planRejected,
        summary: "Planning draft rejected. No work records were created.",
        actorId: input.actorId,
        metadata: JSON.stringify({
          outcomeId: draft.outcomeId,
          planningDraftId: draft.id,
          reason,
          createdWorkRecords: false,
        }),
      },
    });
  });

  return { planningDraftId: draft.id, status: "rejected" };
}

// ─── Apply ────────────────────────────────────────────────────────────────────

/**
 * Creates (or updates) real work records from an approved planning draft.
 * Idempotent: re-running returns updated counts without creating duplicates.
 * Uses `planningDraftId + planItemId` unique constraints for upsert.
 */
export async function applyApprovedPlan(input: ApplyPlanInput): Promise<ApplyPlanOutput> {
  const draft = await prisma.planningDraft.findFirst({
    where: { id: input.planningDraftId, companyId: input.companyId },
    select: {
      id: true,
      status: true,
      outcomeId: true,
      approvedAt: true,
      rejectedAt: true,
      generatedProjects: true,
      generatedFeatures: true,
      generatedTasks: true,
      title: true,
    },
  });

  if (!draft) throw new Error("Planning draft not found.");

  const guardInput: PlanningDraftWorkGuardInput = {
    id: draft.id,
    companyId: input.companyId,
    outcomeId: draft.outcomeId,
    status: draft.status as PlanningDraftWorkGuardInput["status"],
    approvedAt: draft.approvedAt,
    rejectedAt: draft.rejectedAt,
  };
  assertPlanningDraftCanCreateWork(guardInput);

  // Parse JSON blobs
  let generatedProjects: GeneratedPlanningProject[] = [];
  let generatedFeatures: GeneratedPlanningFeature[] = [];
  let generatedTasks: GeneratedPlanningTask[] = [];
  try {
    generatedProjects = JSON.parse(draft.generatedProjects) as GeneratedPlanningProject[];
    generatedFeatures = JSON.parse(draft.generatedFeatures) as GeneratedPlanningFeature[];
    generatedTasks = JSON.parse(draft.generatedTasks) as GeneratedPlanningTask[];
  } catch {
    throw new Error("Planning draft contains invalid JSON work data.");
  }

  // Resolve the repository + workspace the generated projects should attach to.
  // The CEO scopes an outcome to a repository (Outcome.repositoryId); we honour
  // that here so AI/deterministic-planned projects inherit the real repo (and its
  // workspace) instead of landing repo-less in the default workspace. Falls back
  // to the default workspace when the outcome has no repository.
  //
  // The repository lookup is split into a scalar fetch + a conditional join so
  // companies/outcomes without a repository never touch the Repository table.
  const outcomeRepositoryId = draft.outcomeId
    ? (
        await prisma.outcome.findFirst({
          where: { id: draft.outcomeId, companyId: input.companyId },
          select: { repositoryId: true },
        })
      )?.repositoryId ?? null
    : null;

  let repositoryId: string | null = null;
  let workspaceId: string;
  const repo = outcomeRepositoryId
    ? await prisma.repository.findFirst({
        where: { id: outcomeRepositoryId },
        select: { id: true, workspaceId: true },
      })
    : null;
  if (repo) {
    repositoryId = repo.id;
    workspaceId = repo.workspaceId;
  } else {
    workspaceId = await ensureDefaultWorkspace(input.companyId);
  }

  const result = await prisma.$transaction(async (tx) => {
    let projectsCreated = 0;
    let projectsUpdated = 0;
    let featuresCreated = 0;
    let featuresUpdated = 0;
    let tasksCreated = 0;
    let tasksUpdated = 0;

    // Map planItemId → DB record id for cross-linking
    const projectIdByPlanItemId = new Map<string, string>();
    const featureIdByPlanItemId = new Map<string, string>();

    // ── Projects ────────────────────────────────────────────────────────────
    for (const gp of generatedProjects) {
      const trace = buildGeneratedWorkTraceData({
        companyId: input.companyId,
        outcomeId: draft.outcomeId,
        planningDraftId: draft.id,
        planItemId: gp.planItemId,
      });

      const slug = slugify(gp.name) + "-" + gp.planItemId.slice(0, 8);

      const existing = await tx.project.findFirst({
        where: { planningDraftId: draft.id, planItemId: gp.planItemId },
        select: { id: true },
      });

      let projectId: string;
      if (existing) {
        await tx.project.update({
          where: { id: existing.id },
          data: {
            name: gp.name,
            description: gp.description,
            // Backfill the repo/workspace link on re-apply, but never clobber an
            // existing link with null when the outcome has no repository.
            ...(repositoryId ? { repositoryId, workspaceId } : {}),
            updatedAt: new Date(),
          },
        });
        projectId = existing.id;
        projectsUpdated++;
      } else {
        const created = await tx.project.create({
          data: {
            name: gp.name,
            slug,
            description: gp.description,
            status: "active",
            companyId: trace.companyId,
            workspaceId,
            repositoryId,
            outcomeId: trace.outcomeId,
            planningDraftId: trace.planningDraftId,
            planItemId: trace.planItemId,
          },
          select: { id: true },
        });
        projectId = created.id;
        projectsCreated++;
      }

      projectIdByPlanItemId.set(gp.planItemId, projectId);
    }

    // ── Features ────────────────────────────────────────────────────────────
    for (const gf of generatedFeatures) {
      const projectId = projectIdByPlanItemId.get(gf.projectPlanItemId);
      if (!projectId) continue; // skip orphaned features

      const trace = buildGeneratedWorkTraceData({
        companyId: input.companyId,
        outcomeId: draft.outcomeId,
        planningDraftId: draft.id,
        planItemId: gf.planItemId,
      });

      const existing = await tx.feature.findFirst({
        where: { planningDraftId: draft.id, planItemId: gf.planItemId },
        select: { id: true },
      });

      let featureId: string;
      if (existing) {
        await tx.feature.update({
          where: { id: existing.id },
          data: {
            title: gf.title,
            description: gf.description,
            updatedAt: new Date(),
          },
        });
        featureId = existing.id;
        featuresUpdated++;
      } else {
        const created = await tx.feature.create({
          data: {
            title: gf.title,
            description: gf.description,
            status: "planned",
            priority: "medium",
            companyId: trace.companyId,
            projectId,
            outcomeId: trace.outcomeId,
            planningDraftId: trace.planningDraftId,
            planItemId: trace.planItemId,
          },
          select: { id: true },
        });
        featureId = created.id;
        featuresCreated++;
      }

      featureIdByPlanItemId.set(gf.planItemId, featureId);
    }

    // ── Tasks ────────────────────────────────────────────────────────────────
    for (const gt of generatedTasks) {
      const featureId = featureIdByPlanItemId.get(gt.featurePlanItemId);

      const trace = buildGeneratedWorkTraceData({
        companyId: input.companyId,
        outcomeId: draft.outcomeId,
        planningDraftId: draft.id,
        planItemId: gt.planItemId,
      });

      const priority = mapEstimateToPriority(gt.estimatePoints);

      const existing = await tx.task.findFirst({
        where: { planningDraftId: draft.id, planItemId: gt.planItemId },
        select: { id: true },
      });

      if (existing) {
        await tx.task.update({
          where: { id: existing.id },
          data: {
            title: gt.title,
            description: gt.description,
            estimate: gt.estimatePoints,
            assigneeId: gt.recommendedEmployeeId ?? undefined,
            updatedAt: new Date(),
          },
        });
        tasksUpdated++;
      } else {
        await tx.task.create({
          data: {
            title: gt.title,
            description: gt.description,
            status: "todo",
            priority,
            estimate: gt.estimatePoints,
            companyId: trace.companyId,
            featureId: featureId ?? null,
            outcomeId: trace.outcomeId,
            planningDraftId: trace.planningDraftId,
            planItemId: trace.planItemId,
            assigneeId: gt.recommendedEmployeeId ?? null,
          },
        });
        tasksCreated++;
      }
    }

    // ── Mark draft as applied ────────────────────────────────────────────────
    await tx.planningDraft.update({
      where: { id: draft.id },
      data: {
        status: "applied",
        appliedAt: new Date(),
        appliedById: input.actorId,
      },
    });

    await tx.outcome.updateMany({
      where: { id: draft.outcomeId, companyId: input.companyId },
      data: { status: "in_delivery", updatedAt: new Date() },
    });

    await tx.timelineEntry.create({
      data: {
        entityType: "planning_draft",
        entityId: draft.id,
        eventType: OUTCOME_PLANNING_EVENT_TYPES.workCreated,
        summary: `Work created from approved plan: ${projectsCreated} project(s), ${featuresCreated} feature(s), ${tasksCreated} task(s).`,
        actorId: input.actorId,
        metadata: JSON.stringify({
          planningDraftId: draft.id,
          projectsCreated,
          projectsUpdated,
          featuresCreated,
          featuresUpdated,
          tasksCreated,
          tasksUpdated,
        }),
      },
    });

    return {
      planningDraftId: draft.id,
      projectsCreated,
      projectsUpdated,
      featuresCreated,
      featuresUpdated,
      tasksCreated,
      tasksUpdated,
    };
  });

  return result;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function mapEstimateToPriority(points: number): string {
  if (points >= 8) return "high";
  if (points >= 5) return "medium";
  return "low";
}
