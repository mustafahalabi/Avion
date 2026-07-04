"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Clock,
  GitPullRequest,
  ShieldAlert,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { LivePipeline } from "@/lib/live-pipeline-data";
import type { TimelineItem } from "@/components/timeline-entry";
import { ElapsedTime } from "@/components/ui/elapsed-time";
import { AdapterBadge } from "@/components/ui/badge";
import { useLivePipeline } from "@/components/live/use-live-pipeline";
import { useLiveNotifications } from "@/components/notifications/live-notifications-provider";
import {
  derivePlanningActivity,
  filterConversationDecisions,
  filterStreamToScope,
  mergeActivityById,
  stripPlanningProgress,
  type ConversationScope,
  type PlanningActivityState,
} from "@/lib/chat-activity";
import type { WorkItemView } from "@/lib/work-lifecycle";
import { SessionStream } from "./SessionStream";

/** A message row, serialized from the server page. */
export interface ChatThreadMessage {
  readonly id: string;
  readonly role: string;
  readonly type: string;
  readonly content: string;
  readonly createdAt: Date;
  readonly request: {
    readonly id: string;
    readonly title: string;
    readonly status: string;
    readonly assignedTo: string | null;
    readonly requestType: string;
    readonly clarification: string | null;
  } | null;
  /** Optimistically-rendered send, not yet confirmed by the server. */
  readonly pending?: boolean;
}

const STREAM_HREF = "/api/work/live/stream";

export function ChatThread({
  messages,
  seedActivity,
  initialPipeline,
  scope,
}: {
  messages: readonly ChatThreadMessage[];
  seedActivity: readonly TimelineItem[];
  initialPipeline: LivePipeline;
  scope: ConversationScope;
}) {
  const { pipeline } = useLivePipeline(STREAM_HREF, initialPipeline);
  const liveNotifications = useLiveNotifications();

  // Live activity = the conversation's seed unioned with any pushed stream
  // events that belong to its outcomes.
  const activity = useMemo(() => {
    const live = filterStreamToScope(pipeline.stream, scope.outcomeIds);
    return mergeActivityById(seedActivity, live);
  }, [pipeline.stream, seedActivity, scope.outcomeIds]);

  // Live planning feedback (Goal 2): outcomes whose plan is being drafted right
  // now → a pulsing "Avion is drafting your plan…" indicator that advances
  // through phases and disappears when the draft lands. The heartbeats
  // themselves are stripped from the permanent feed.
  const planningStates = useMemo(
    () => derivePlanningActivity(activity, scope.outcomeIds),
    [activity, scope.outcomeIds]
  );
  const feedActivity = useMemo(() => stripPlanningProgress(activity), [activity]);

  // Inline "needs your input" bubbles for decisions/blockers on this thread.
  const decisions = useMemo(() => {
    const source = liveNotifications?.notifications ?? [];
    return filterConversationDecisions(source, scope);
  }, [liveNotifications, scope]);

  // Every in-flight item on this conversation's outcomes — so concurrent agents
  // are all visible, each with its real adapter and a live timer (not collapsed
  // to a single line).
  const liveItems = useMemo(
    () => pickLiveItems(pipeline.board.columns.flatMap((c) => c.items), scope),
    [pipeline.board, scope]
  );

  // Sessions actively building right now — each gets a live "Avion is building…"
  // agent-output feed (humanized by default, raw output behind an opt-in drawer).
  const liveSessionIds = useMemo(
    () =>
      liveItems
        .filter((i) => i.isLive && i.sessionId)
        .map((i) => i.sessionId as string),
    [liveItems]
  );

  // Interleave messages + activity + decisions chronologically (planning
  // heartbeats excluded — they drive the live indicator, not the feed).
  const feed = useMemo(
    () => buildFeed(messages, feedActivity, decisions),
    [messages, feedActivity, decisions]
  );

  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [feed.length, liveItems.length]);

  const isEmpty = feed.length === 0;

  if (isEmpty) {
    return (
      <div className="mx-auto flex max-w-sm flex-col items-center gap-3 pt-10 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900">
          <Zap className="h-5 w-5 text-neutral-500" />
        </div>
        <div>
          <p className="text-sm font-semibold text-neutral-300">
            Talk to your company
          </p>
          <p className="mt-1 max-w-sm text-xs text-neutral-600">
            State a goal. The company will plan, build, review, QA, and ship it —
            and you&apos;ll watch it happen right here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      {feed.map((node) => {
        if (node.kind === "message") {
          return <MessageBubble key={node.id} message={node.message} />;
        }
        if (node.kind === "decision") {
          return <DecisionBubble key={node.id} decision={node.decision} />;
        }
        return <ActivityBubble key={node.id} item={node.item} />;
      })}
      {planningStates.map((state) => (
        <PlanningIndicator key={`planning-${state.outcomeId}`} state={state} />
      ))}
      {liveItems.length > 0 && <WorkingNowPanel items={liveItems} />}
      {liveSessionIds.map((sid) => (
        <SessionStream key={sid} sessionId={sid} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

// ─── Feed assembly ────────────────────────────────────────────────────────────

type FeedNode =
  | { kind: "message"; id: string; sortKey: number; message: ChatThreadMessage }
  | { kind: "activity"; id: string; sortKey: number; item: TimelineItem }
  | {
      kind: "decision";
      id: string;
      sortKey: number;
      decision: DecisionData;
    };

interface DecisionData {
  readonly id: string;
  readonly title: string;
  readonly body: string | null;
  readonly type: string;
  readonly actionUrl: string | null;
  readonly createdAt: Date;
}

function buildFeed(
  messages: readonly ChatThreadMessage[],
  activity: readonly TimelineItem[],
  decisions: readonly DecisionData[]
): FeedNode[] {
  const nodes: FeedNode[] = [
    ...messages.map((message) => ({
      kind: "message" as const,
      id: `m-${message.id}`,
      sortKey: message.createdAt.getTime(),
      message,
    })),
    ...activity.map((item) => ({
      kind: "activity" as const,
      id: `a-${item.id}`,
      sortKey: item.createdAt.getTime(),
      item,
    })),
    ...decisions.map((decision) => ({
      kind: "decision" as const,
      id: `d-${decision.id}`,
      sortKey: decision.createdAt.getTime(),
      decision,
    })),
  ];
  // Stable chronological order; ties keep messages before derived activity.
  return nodes.sort((a, b) => a.sortKey - b.sortKey);
}

/** Every in-flight item for the conversation, ordered live → blocked → recent. */
function pickLiveItems(
  items: readonly WorkItemView[],
  scope: ConversationScope
): WorkItemView[] {
  const set = new Set(scope.outcomeIds);
  const scoped = items.filter(
    (i) => i.workflowId != null && set.has(i.workflowId)
  );
  const active = scoped.filter(
    (i) => i.stage !== "done" && (i.isLive || i.isBlocked || i.awaitingApproval)
  );
  return active.slice().sort((a, b) => {
    if (a.isLive !== b.isLive) return a.isLive ? -1 : 1;
    if (a.isBlocked !== b.isBlocked) return a.isBlocked ? -1 : 1;
    return b.updatedAt.getTime() - a.updatedAt.getTime();
  });
}

// ─── Bubbles ──────────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: ChatThreadMessage }) {
  const isUser = message.role === "user";
  return (
    <div
      className={cn(
        "av-fade-in-up flex gap-3",
        isUser ? "flex-row-reverse" : "flex-row",
        message.pending && "opacity-60"
      )}
    >
      <div
        className={cn(
          "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
          isUser
            ? "bg-white text-neutral-900"
            : "border border-neutral-700 bg-neutral-800 text-neutral-400"
        )}
      >
        {isUser ? "C" : "E"}
      </div>
      <div
        className={cn(
          "flex flex-col gap-1.5",
          isUser ? "items-end" : "items-start"
        )}
      >
        <div
          className={cn(
            "max-w-md rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
            isUser
              ? "rounded-tr-sm bg-neutral-100 text-neutral-900"
              : "rounded-tl-sm border border-neutral-800 bg-neutral-900 text-neutral-300"
          )}
        >
          {renderContent(message.content)}
        </div>
        {message.request && <RequestCard request={message.request} />}
        <span className="px-1 text-[10px] text-neutral-700">
          {formatTime(message.createdAt)}
        </span>
      </div>
    </div>
  );
}

const ACTIVITY_ICON: Array<{ match: (t: string) => boolean; icon: LucideIcon; color: string }> = [
  { match: (t) => t.includes("merged") || t === "complete" || t.startsWith("outcome"), icon: CheckCircle2, color: "text-emerald-400" },
  { match: (t) => t.includes("pr_") || t.startsWith("release"), icon: GitPullRequest, color: "text-emerald-400" },
  { match: (t) => t.includes("qa"), icon: CheckCircle2, color: "text-sky-400" },
  { match: (t) => t.includes("review"), icon: AlertCircle, color: "text-orange-400" },
  { match: (t) => t.includes("execution") || t.includes("build") || t === "executing", icon: Zap, color: "text-emerald-400" },
  { match: (t) => t.startsWith("plan") || t === "planning" || t === "intake", icon: Clock, color: "text-neutral-400" },
];

function activityIcon(type: string): { icon: LucideIcon; color: string } {
  const hit = ACTIVITY_ICON.find((c) => c.match(type));
  return hit ? { icon: hit.icon, color: hit.color } : { icon: Circle, color: "text-neutral-500" };
}

function ActivityBubble({ item }: { item: TimelineItem }) {
  const { icon: Icon, color } = activityIcon(item.type);
  return (
    <div className="av-fade-in-up flex justify-center">
      <Link
        href={item.contextHref}
        className="group inline-flex max-w-lg items-center gap-2 rounded-full border border-neutral-800 bg-neutral-950/60 px-3 py-1.5 text-xs text-neutral-400 transition-colors hover:border-neutral-700 hover:text-neutral-300"
      >
        <Icon className={cn("h-3.5 w-3.5 shrink-0", color)} />
        <span className="truncate">{item.description}</span>
        <span className="shrink-0 text-neutral-700">{formatTime(item.createdAt)}</span>
      </Link>
    </div>
  );
}

function DecisionBubble({ decision }: { decision: DecisionData }) {
  const Icon = decision.type === "blocker" ? ShieldAlert : Zap;
  const inner = (
    <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-950/20 px-4 py-3">
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500/15">
        <Icon className="h-3.5 w-3.5 text-amber-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-amber-200">{decision.title}</p>
        {decision.body && (
          <p className="mt-0.5 text-xs leading-relaxed text-amber-100/70">
            {decision.body}
          </p>
        )}
        <p className="mt-1.5 text-[11px] font-medium text-amber-400/80">
          Needs your input{decision.actionUrl ? " · open" : ""}
        </p>
      </div>
    </div>
  );
  return (
    <div className="av-fade-in-up flex flex-row gap-3">
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-amber-700/50 bg-amber-900/30 text-[10px] font-bold text-amber-300">
        E
      </div>
      <div className="min-w-0 flex-1">
        {decision.actionUrl ? (
          <Link href={decision.actionUrl} className="block">
            {inner}
          </Link>
        ) : (
          inner
        )}
        <span className="px-1 text-[10px] text-neutral-700">
          {formatTime(decision.createdAt)}
        </span>
      </div>
    </div>
  );
}

/**
 * Live "Avion is drafting your plan…" indicator (Goal 2). Shown while a plan is
 * being generated so the ~1–2 min planning window is never a silent gap: a
 * pulsing dot, the current phase line (which advances as phases arrive), and a
 * ticking elapsed timer. It disappears the moment the plan lands (a terminal
 * planning event), handing off to the "Plan ready" activity bubble.
 */
function PlanningIndicator({ state }: { state: PlanningActivityState }) {
  return (
    <div className="av-fade-in-up flex flex-row gap-3">
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-neutral-700 bg-neutral-800 text-[10px] font-bold text-neutral-400">
        E
      </div>
      <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm border border-neutral-800 bg-neutral-900 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-brand-500" aria-hidden />
          <span className="text-sm font-medium text-neutral-200">
            Avion is drafting your plan…
          </span>
          <ElapsedTime
            startedAt={state.since}
            className="ml-auto text-[11px] font-semibold text-brand-400"
          />
        </div>
        <p className="mt-1 pl-3.5 text-xs text-neutral-500">{state.phase}</p>
      </div>
    </div>
  );
}

/**
 * "Working now" — a compact panel listing EVERY in-flight item on the thread,
 * each with its real adapter (Claude Code / Codex) and a live-ticking timer, so
 * concurrent agents are all visible rather than collapsed to a single line.
 */
function WorkingNowPanel({ items }: { items: readonly WorkItemView[] }) {
  const liveCount = items.filter((i) => i.isLive).length;
  return (
    <div className="av-fade-in-up flex flex-row gap-3">
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-neutral-700 bg-neutral-800 text-[10px] font-bold text-neutral-400">
        E
      </div>
      <div className="min-w-0 flex-1 border border-neutral-800 bg-neutral-950/60">
        <div className="flex items-center gap-2 border-b border-neutral-800 px-3 py-1.5">
          <span
            className={cn(
              "h-1.5 w-1.5 shrink-0 rounded-full",
              liveCount > 0 ? "bg-brand-500 animate-pulse" : "bg-warning-500"
            )}
          />
          <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
            {liveCount > 0 ? `Working now · ${liveCount} agent${liveCount === 1 ? "" : "s"}` : "Waiting on you"}
          </span>
        </div>
        {items.map((item) => (
          <WorkingNowRow key={item.id} item={item} />
        ))}
      </div>
    </div>
  );
}

function WorkingNowRow({ item }: { item: WorkItemView }) {
  const dot = item.isBlocked
    ? "bg-danger-500"
    : item.awaitingApproval || item.isStale
    ? "bg-warning-500"
    : "bg-brand-500 animate-pulse";
  const clockColor = item.isBlocked
    ? "text-danger-400"
    : item.awaitingApproval || item.isStale
    ? "text-warning-400"
    : "text-brand-400";
  return (
    <div className="flex items-center gap-2.5 border-b border-neutral-800/70 px-3 py-2 last:border-b-0">
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dot)} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-neutral-200">{item.title}</p>
        <p className="truncate font-mono text-[10px] text-neutral-500">
          {item.statusLine}
          {item.prNumber != null ? ` · PR #${item.prNumber}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {item.agentType && <AdapterBadge agentType={item.agentType} />}
        {item.isLive && item.startedAt ? (
          <ElapsedTime
            startedAt={item.startedAt}
            className={cn("text-[11px] font-semibold", clockColor)}
          />
        ) : item.totalActiveMs ? (
          <ElapsedTime ms={item.totalActiveMs} className="text-[11px] text-neutral-500" />
        ) : null}
      </div>
    </div>
  );
}

// ─── Presentational helpers (ported from the server page) ─────────────────────

const REQUEST_STATUS_LABEL: Record<
  string,
  { label: string; color: string; icon: LucideIcon }
> = {
  intake: { label: "Intake", color: "text-blue-400", icon: Circle },
  planning: { label: "Planning", color: "text-neutral-400", icon: Clock },
  awaiting_approval: { label: "Awaiting Approval", color: "text-amber-400", icon: AlertCircle },
  executing: { label: "Executing", color: "text-emerald-400", icon: Clock },
  in_review: { label: "In Review", color: "text-amber-400", icon: Clock },
  in_qa: { label: "In QA", color: "text-neutral-400", icon: Clock },
  complete: { label: "Complete", color: "text-emerald-400", icon: CheckCircle2 },
  blocked: { label: "Blocked", color: "text-red-400", icon: AlertCircle },
  cancelled: { label: "Cancelled", color: "text-neutral-500", icon: Circle },
};

function RequestCard({
  request,
}: {
  request: NonNullable<ChatThreadMessage["request"]>;
}) {
  const cfg = REQUEST_STATUS_LABEL[request.status] ?? REQUEST_STATUS_LABEL.intake;
  const Icon = cfg.icon;
  return (
    <Link
      href={`/inbox/requests/${request.id}`}
      className="group flex max-w-xs items-start gap-2.5 rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2.5 transition-colors hover:border-neutral-700"
    >
      <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", cfg.color)} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-neutral-300">
          {request.title}
        </p>
        <p className={cn("mt-0.5 text-[11px] font-medium", cfg.color)}>
          {cfg.label}
          {request.assignedTo && (
            <span className="font-normal text-neutral-600">
              {" · "}
              {request.assignedTo}
            </span>
          )}
        </p>
        {request.clarification && (
          <p className="mt-1 truncate text-[11px] text-amber-600">
            Needs clarification
          </p>
        )}
      </div>
    </Link>
  );
}

function renderContent(content: string) {
  const parts = content.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}
