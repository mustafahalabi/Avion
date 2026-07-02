/**
 * Conversational Company Chat follow-ups (MUS-261).
 *
 * Only the first message in a chat conversation used to do anything (create the
 * RuntimeRequest → Outcome → PlanningDraft chain). Every follow-up got a canned
 * "Message noted." reply and was attached to nothing — clarifications, scope
 * changes, and answers to the plan's open CEO questions were silently dropped.
 *
 * Follow-ups now:
 * - attach to the conversation's active RuntimeRequest/Outcome: a `follow_up`
 *   RuntimeEvent is recorded and the text is appended to the outcome's `brief`
 *   (durable, human-readable log) and `constraints` (the JSON array both
 *   planners parse), so planning and rework consume it;
 * - regenerate a still-pending planning draft so the plan absorbs the note
 *   before approval — approved/applied plans are never regenerated (the
 *   appended constraints reach rework/execution briefs through the outcome);
 * - reply with a deterministic chief-of-staff status answer built from real
 *   records (request status, plan status + open CEO questions, live task
 *   counts). No AI call, no fake intelligence — every line traces to a row.
 *
 * When the conversation has no active request (it completed / was cancelled),
 * the caller treats the message as a new first message and starts a fresh
 * request — the conversation→request linkage is `Message.requestId`, so the
 * latest linked message naturally becomes the active request.
 */

import { prisma } from "@/lib/prisma";
import { parseJsonStringArray } from "@/lib/planning-generator";
import { createOrUpdatePlanningDraftForOutcome } from "@/lib/planning-draft-service";
import { TERMINAL_OUTCOME_STATUSES } from "@/lib/outcome-completion-service";
import type { PlanningDraftStatus } from "@/lib/outcome-planning";

/** Runtime request statuses after which a conversation has no active request. */
export const TERMINAL_REQUEST_STATUSES: readonly string[] = [
  "complete",
  "cancelled",
];

/** Section delimiter used when appending CEO follow-ups to the outcome brief. */
export const FOLLOW_UP_BRIEF_DELIMITER = "--- CEO follow-up ---";

/** Prefix marking outcome constraint entries that came from chat follow-ups. */
export const FOLLOW_UP_CONSTRAINT_PREFIX = "CEO follow-up: ";

/** RuntimeEvent type recorded when a follow-up reaches the active request. */
export const FOLLOW_UP_EVENT_TYPE = "follow_up";

/** The conversation's currently active request, resolved via Message.requestId. */
export interface ActiveConversationRequest {
  readonly requestId: string;
  readonly requestTitle: string;
  readonly requestStatus: string;
  readonly outcomeId: string;
}

/** Live task tallies for the follow-up status reply. */
export interface FollowUpTaskCounts {
  readonly todo: number;
  readonly inProgress: number;
  readonly inReview: number;
  readonly done: number;
  readonly other: number;
  readonly total: number;
}

/** Real-state snapshot the deterministic follow-up reply is rendered from. */
export interface FollowUpReplyContext {
  readonly requestTitle: string;
  readonly requestStatus: string;
  readonly plan: {
    readonly status: PlanningDraftStatus;
    readonly version: number;
    readonly regenerated: boolean;
  } | null;
  readonly openCeoQuestions: readonly string[];
  readonly taskCounts: FollowUpTaskCounts;
}

/** What `handleConversationFollowUp` did with the message. */
export type ConversationFollowUpResult =
  | {
      readonly kind: "attached";
      readonly requestId: string;
      readonly outcomeId: string;
      readonly planRegenerated: boolean;
    }
  | { readonly kind: "no_active_request" };

export interface ConversationFollowUpInput {
  readonly companyId: string;
  readonly conversationId: string;
  readonly content: string;
  readonly actorId: string;
}

/**
 * Appends a CEO follow-up to the outcome brief with a clear delimiter.
 * Timestamp-free and idempotent: re-appending an identical section is a no-op.
 *
 * @param brief - Current outcome brief (may be null/empty).
 * @param content - Trimmed follow-up text.
 * @returns The brief with the follow-up section appended.
 */
export function appendFollowUpToBrief(brief: string | null, content: string): string {
  const section = `${FOLLOW_UP_BRIEF_DELIMITER}\n${content.trim()}`;
  if (!brief || brief.trim().length === 0) return section;
  if (brief.includes(section)) return brief;
  return `${brief}\n\n${section}`;
}

/**
 * Appends a CEO follow-up entry to the outcome's constraints JSON array — the
 * field both the deterministic and AI planners parse. Whitespace is collapsed
 * so the entry survives `parseJsonStringArray` round-trips, keeping the
 * duplicate check (and therefore idempotency) stable.
 *
 * @param constraintsJson - Current `Outcome.constraints` JSON string.
 * @param content - Follow-up text.
 * @returns Updated constraints JSON string.
 */
export function appendFollowUpConstraint(constraintsJson: string, content: string): string {
  const constraints = parseJsonStringArray(constraintsJson);
  const entry = `${FOLLOW_UP_CONSTRAINT_PREFIX}${content.replace(/\s+/g, " ").trim()}`;
  if (constraints.includes(entry)) return JSON.stringify(constraints);
  return JSON.stringify([...constraints, entry]);
}

/**
 * Resolves the conversation's active runtime request, if any.
 *
 * Linkage: company messages created when a request starts (and every attached
 * follow-up) carry `Message.requestId`, so the latest linked message points at
 * the conversation's current request. A request is active while neither it nor
 * its outcome has reached a terminal status.
 *
 * @param input - Company + conversation identifiers (ownership-guarded).
 * @returns The active request context, or null when none exists.
 */
export async function resolveActiveConversationRequest(input: {
  readonly companyId: string;
  readonly conversationId: string;
}): Promise<ActiveConversationRequest | null> {
  const linked = await prisma.message.findFirst({
    where: {
      conversationId: input.conversationId,
      requestId: { not: null },
      conversation: { companyId: input.companyId },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      request: {
        select: {
          id: true,
          companyId: true,
          title: true,
          status: true,
          outcome: { select: { id: true, status: true } },
        },
      },
    },
  });

  const request = linked?.request;
  if (!request || request.companyId !== input.companyId) return null;
  if (TERMINAL_REQUEST_STATUSES.includes(request.status)) return null;

  const outcome = request.outcome;
  if (!outcome || TERMINAL_OUTCOME_STATUSES.has(outcome.status)) return null;

  return {
    requestId: request.id,
    requestTitle: request.title,
    requestStatus: request.status,
    outcomeId: outcome.id,
  };
}

/**
 * Routes a chat follow-up message to the conversation's active request.
 *
 * When active: records the user message (linked to the request), appends the
 * text to the outcome brief + constraints, records a `follow_up` RuntimeEvent,
 * regenerates a not-yet-approved planning draft, and replies with a
 * deterministic status answer built from the post-update records.
 *
 * When there is no active request, nothing is written — the caller starts a
 * new request from the message instead.
 *
 * @param input - Company, conversation, message content, and acting user.
 * @returns What happened, so the caller can route accordingly.
 */
export async function handleConversationFollowUp(
  input: ConversationFollowUpInput
): Promise<ConversationFollowUpResult> {
  const active = await resolveActiveConversationRequest({
    companyId: input.companyId,
    conversationId: input.conversationId,
  });
  if (!active) return { kind: "no_active_request" };

  const content = input.content.trim();

  await prisma.$transaction(async (tx) => {
    await tx.message.create({
      data: {
        conversationId: input.conversationId,
        authorId: input.actorId,
        role: "user",
        type: "text",
        requestId: active.requestId,
        content,
      },
    });

    await tx.conversation.update({
      where: { id: input.conversationId },
      data: { updatedAt: new Date() },
    });

    const outcome = await tx.outcome.findFirst({
      where: { id: active.outcomeId, companyId: input.companyId },
      select: { brief: true, constraints: true },
    });
    if (outcome) {
      await tx.outcome.updateMany({
        where: { id: active.outcomeId, companyId: input.companyId },
        data: {
          brief: appendFollowUpToBrief(outcome.brief, content),
          constraints: appendFollowUpConstraint(outcome.constraints, content),
          updatedAt: new Date(),
        },
      });
    }

    await tx.runtimeEvent.create({
      data: {
        requestId: active.requestId,
        type: FOLLOW_UP_EVENT_TYPE,
        description: `CEO follow-up received via company chat: "${truncate(content, 200)}"`,
        actor: "CEO",
      },
    });
  });

  // Plans that are not yet approved absorb the note now: pending drafts
  // regenerate in place, failed drafts retry, rejected drafts re-plan at the
  // next version (all inside createOrUpdatePlanningDraftForOutcome, which is
  // idempotent per outcome+version). Approved/applied plans are never
  // regenerated — the appended constraints reach rework and execution briefs
  // through the outcome instead.
  const latestDraft = await prisma.planningDraft.findFirst({
    where: { companyId: input.companyId, outcomeId: active.outcomeId },
    orderBy: { version: "desc" },
    select: { status: true },
  });
  const planRegenerated =
    latestDraft?.status !== "approved" && latestDraft?.status !== "applied";
  if (planRegenerated) {
    await createOrUpdatePlanningDraftForOutcome({
      companyId: input.companyId,
      outcomeId: active.outcomeId,
      actorId: input.actorId,
      regeneratePendingDraft: true,
    });
  }

  // Reply from the post-update records so the CEO sees the state their
  // follow-up produced (e.g. the regenerated plan's open questions).
  const context = await loadFollowUpReplyContext({
    companyId: input.companyId,
    requestId: active.requestId,
    outcomeId: active.outcomeId,
    planRegenerated,
  });

  await prisma.message.create({
    data: {
      conversationId: input.conversationId,
      role: "company",
      type: "text",
      requestId: active.requestId,
      content: buildFollowUpReply(context),
    },
  });

  return {
    kind: "attached",
    requestId: active.requestId,
    outcomeId: active.outcomeId,
    planRegenerated,
  };
}

/**
 * Renders the deterministic markdown status reply for an attached follow-up.
 * Pure so the exact wording is unit-testable.
 *
 * @param context - Real-state snapshot loaded after the follow-up was applied.
 * @returns Markdown reply for the company chat message.
 */
export function buildFollowUpReply(context: FollowUpReplyContext): string {
  const lines: string[] = [
    `Noted — your message is attached to **${context.requestTitle}** and recorded on the outcome brief.`,
    "",
    `**Request status:** ${humanizeStatus(context.requestStatus)}`,
    `**Plan:** ${describePlan(context.plan)}`,
  ];

  if (context.openCeoQuestions.length > 0) {
    lines.push("", "**Open questions for you:**");
    context.openCeoQuestions.forEach((question, index) => {
      lines.push(`${index + 1}. ${question}`);
    });
  }

  lines.push("", `**Delivery:** ${describeTaskCounts(context.taskCounts, context.plan)}`);

  return lines.join("\n");
}

/** Loads the post-update snapshot the reply is rendered from. */
async function loadFollowUpReplyContext(input: {
  readonly companyId: string;
  readonly requestId: string;
  readonly outcomeId: string;
  readonly planRegenerated: boolean;
}): Promise<FollowUpReplyContext> {
  const [request, outcome, draft, tasks] = await Promise.all([
    prisma.runtimeRequest.findFirst({
      where: { id: input.requestId, companyId: input.companyId },
      select: { title: true, status: true },
    }),
    prisma.outcome.findFirst({
      where: { id: input.outcomeId, companyId: input.companyId },
      select: { constraints: true },
    }),
    prisma.planningDraft.findFirst({
      where: { companyId: input.companyId, outcomeId: input.outcomeId },
      orderBy: { version: "desc" },
      select: { status: true, version: true, generationError: true },
    }),
    prisma.task.findMany({
      where: {
        companyId: input.companyId,
        OR: [{ outcomeId: input.outcomeId }, { planningDraft: { outcomeId: input.outcomeId } }],
      },
      select: { status: true },
    }),
  ]);

  return {
    requestTitle: request?.title ?? "your request",
    requestStatus: request?.status ?? "unknown",
    plan: draft
      ? {
          status: draft.status as PlanningDraftStatus,
          version: draft.version,
          regenerated: input.planRegenerated,
        }
      : null,
    openCeoQuestions: draft
      ? extractOpenCeoQuestions(
          draft.status as PlanningDraftStatus,
          draft.generationError,
          outcome?.constraints ?? "[]"
        )
      : [],
    taskCounts: countTasks(tasks),
  };
}

/**
 * Extracts the plan's open CEO questions from where the system records them:
 * successful generation writes them to `Outcome.constraints`; failed generation
 * records them in `PlanningDraft.generationError`. Only drafts still awaiting
 * review (or failed) surface questions — approved plans have moved on.
 */
function extractOpenCeoQuestions(
  status: PlanningDraftStatus,
  generationError: string | null,
  constraintsJson: string
): readonly string[] {
  if (status === "failed") {
    try {
      const parsed = JSON.parse(generationError ?? "{}") as {
        openCeoQuestions?: unknown;
      };
      if (Array.isArray(parsed.openCeoQuestions)) {
        return parsed.openCeoQuestions.filter(
          (item): item is string => typeof item === "string"
        );
      }
    } catch {
      // fall through to the empty list — never invent questions
    }
    return [];
  }

  if (status !== "draft" && status !== "reviewing") return [];

  return parseJsonStringArray(constraintsJson).filter(
    (entry) => entry.endsWith("?") && !entry.startsWith(FOLLOW_UP_CONSTRAINT_PREFIX)
  );
}

/** Tallies live task statuses for the reply. */
function countTasks(tasks: readonly { readonly status: string }[]): FollowUpTaskCounts {
  let todo = 0;
  let inProgress = 0;
  let inReview = 0;
  let done = 0;
  let other = 0;
  for (const task of tasks) {
    if (task.status === "todo") todo += 1;
    else if (task.status === "in-progress") inProgress += 1;
    else if (task.status === "in-review") inReview += 1;
    else if (task.status === "done") done += 1;
    else other += 1;
  }
  return { todo, inProgress, inReview, done, other, total: tasks.length };
}

/** Renders the plan line of the reply. */
function describePlan(plan: FollowUpReplyContext["plan"]): string {
  if (!plan) return "not generated yet — it will be prepared for your review.";

  const version = `v${plan.version}`;
  switch (plan.status) {
    case "draft":
    case "reviewing":
      return plan.regenerated
        ? `${version} awaiting your review — updated with this note.`
        : `${version} awaiting your review.`;
    case "approved":
      return `${version} approved — this note was attached to the outcome and will reach execution and rework briefs.`;
    case "applied":
      return `${version} applied to delivery work — this note was attached to the outcome and will reach rework briefs.`;
    case "rejected":
      return `${version} rejected — awaiting a revised plan.`;
    case "failed":
      return plan.regenerated
        ? `${version} needs clarification — planning retried with this note.`
        : `${version} needs clarification.`;
    default:
      return `${version} ${humanizeStatus(plan.status)}.`;
  }
}

/** Renders the delivery line of the reply. */
function describeTaskCounts(
  counts: FollowUpTaskCounts,
  plan: FollowUpReplyContext["plan"]
): string {
  if (counts.total === 0) {
    const planPending =
      plan !== null && (plan.status === "draft" || plan.status === "reviewing");
    return planPending
      ? "no tasks yet — delivery work is created when you approve the plan."
      : "no delivery tasks yet.";
  }

  const parts = [
    `${counts.todo} todo`,
    `${counts.inProgress} in progress`,
    `${counts.inReview} in review`,
    `${counts.done} done`,
  ];
  if (counts.other > 0) parts.push(`${counts.other} other`);
  return `${parts.join(" · ")} (${counts.total} total)`;
}

/** Lowercases separators in status identifiers for prose ("in_review" → "in review"). */
function humanizeStatus(status: string): string {
  return status.replace(/[_-]+/g, " ");
}

/** Truncates event descriptions without breaking the closing quote. */
function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}
