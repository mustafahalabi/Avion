"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { GitPullRequest, ShieldCheck, FlaskConical, Sparkles } from "lucide-react";

import type { LifecycleBoard, WorkItemView, WorkStage } from "@/lib/work-lifecycle";
import { cn } from "@/lib/utils";

// ─── Per-stage colour tokens ────────────────────────────────────────────────────

const STAGE_STYLE: Record<
  WorkStage,
  { dot: string; ring: string; text: string }
> = {
  planning: { dot: "bg-neutral-400", ring: "ring-neutral-700", text: "text-neutral-400" },
  queued: { dot: "bg-neutral-500", ring: "ring-neutral-700", text: "text-neutral-400" },
  // Building = live now → vermilion accent, matching the rest of the app.
  building: { dot: "bg-brand-500", ring: "ring-brand-900/60", text: "text-brand-300" },
  review: { dot: "bg-warning-500", ring: "ring-warning-900/60", text: "text-warning-300" },
  qa: { dot: "bg-info-400", ring: "ring-info-900/60", text: "text-info-300" },
  done: { dot: "bg-success-500", ring: "ring-success-900/60", text: "text-success-300" },
};

const STAGE_LABEL: Record<WorkStage, string> = {
  planning: "Planning",
  queued: "Queued",
  building: "Building",
  review: "Review",
  qa: "QA",
  done: "Done",
};

// ─── Node data shapes ───────────────────────────────────────────────────────────

type WorkflowNodeData = {
  title: string;
  planStatus: string | null;
  taskCount: number;
  doneCount: number;
  liveCount: number;
};

type TaskNodeData = {
  item: WorkItemView;
};

// ─── Workflow (outcome) node ────────────────────────────────────────────────────

function WorkflowNode({ data }: NodeProps) {
  const d = data as WorkflowNodeData;
  const progress = d.taskCount > 0 ? Math.round((d.doneCount / d.taskCount) * 100) : 0;
  return (
    <div className="w-[260px] rounded-xl border border-neutral-700 bg-neutral-900 px-3.5 py-3 shadow-lg">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center bg-neutral-800 ring-1 ring-neutral-700">
          <Sparkles className="h-3.5 w-3.5 text-neutral-300" aria-hidden />
        </span>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-neutral-100">
          {d.title}
        </p>
      </div>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-neutral-600">
        Workflow{d.planStatus ? ` · plan ${d.planStatus}` : ""}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <div className="h-1.5 flex-1 bg-neutral-800">
          <div
            className="h-1.5 bg-success-600 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="shrink-0 text-[10px] text-neutral-500">
          {d.doneCount}/{d.taskCount}
        </span>
      </div>
      {d.liveCount > 0 && (
        <p className="mt-1.5 flex items-center gap-1 text-[10px] text-brand-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />
          {d.liveCount} working now
        </p>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-neutral-600" />
    </div>
  );
}

// ─── Task node ──────────────────────────────────────────────────────────────────

function TaskNode({ data }: NodeProps) {
  const { item } = data as TaskNodeData;
  const style = STAGE_STYLE[item.stage];
  return (
    <div
      className={cn(
        "w-[230px] cursor-pointer rounded-lg border bg-neutral-900 px-3 py-2.5 shadow-md ring-1 transition-colors hover:bg-neutral-800/80",
        item.isBlocked
          ? "border-danger-900 ring-danger-900/50"
          : item.isLive
            ? "border-brand-800 ring-brand-900/50"
            : `border-neutral-800 ${style.ring}`
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-neutral-600" />
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "h-1.5 w-1.5 shrink-0 rounded-full",
            style.dot,
            item.isLive && "animate-pulse"
          )}
        />
        <span className={cn("text-[10px] font-medium uppercase tracking-wider", style.text)}>
          {STAGE_LABEL[item.stage]}
        </span>
        {item.awaitingApproval && (
          <span className="ml-auto bg-warning-500/15 px-1.5 text-[9px] font-medium text-warning-300">
            needs you
          </span>
        )}
      </div>
      <p className="mt-1 line-clamp-2 text-xs font-medium text-neutral-100">
        {item.title}
      </p>
      <p className="mt-0.5 line-clamp-1 text-[10px] text-neutral-500">
        {item.statusLine}
      </p>
      {(item.prNumber || item.stage === "qa" || item.stage === "review") && (
        <div className="mt-1.5 flex items-center gap-2 text-[10px] text-neutral-500">
          {item.prNumber && (
            <span className="flex items-center gap-1">
              <GitPullRequest className="h-2.5 w-2.5" aria-hidden />#{item.prNumber}
            </span>
          )}
          {item.stage === "review" && (
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-2.5 w-2.5" aria-hidden />
              review
            </span>
          )}
          {item.stage === "qa" && (
            <span className="flex items-center gap-1">
              <FlaskConical className="h-2.5 w-2.5" aria-hidden />
              QA
            </span>
          )}
        </div>
      )}
    </div>
  );
}

const nodeTypes = { workflow: WorkflowNode, task: TaskNode };

// ─── Layout ─────────────────────────────────────────────────────────────────────

const TASK_W = 230;
const COL_GAP = 28;
const ROW_Y = 150; // vertical gap from workflow node to its task row
const BAND_PAD = 110; // vertical gap between workflow bands

interface WorkflowGroup {
  id: string;
  title: string;
  planStatus: string | null;
  tasks: WorkItemView[];
}

function groupByWorkflow(board: LifecycleBoard): WorkflowGroup[] {
  const items = board.columns.flatMap((c) => c.items);
  const groups = new Map<string, WorkflowGroup>();

  for (const item of items) {
    const id = item.workflowId ?? "__none__";
    let group = groups.get(id);
    if (!group) {
      group = {
        id,
        title: item.workflowTitle ?? "Other work",
        planStatus: null,
        tasks: [],
      };
      groups.set(id, group);
    }
    if (item.kind === "plan") {
      // The plan card carries the workflow title + its draft status.
      group.title = item.workflowTitle ?? item.title;
      group.planStatus = item.stage === "planning" ? "awaiting approval" : null;
    } else {
      group.tasks.push(item);
    }
  }

  // Most active workflows first (live → recent).
  return [...groups.values()].sort((a, b) => {
    const aLive = a.tasks.some((t) => t.isLive) ? 1 : 0;
    const bLive = b.tasks.some((t) => t.isLive) ? 1 : 0;
    if (aLive !== bLive) return bLive - aLive;
    const aRecent = Math.max(0, ...a.tasks.map((t) => t.updatedAt.getTime()));
    const bRecent = Math.max(0, ...b.tasks.map((t) => t.updatedAt.getTime()));
    return bRecent - aRecent;
  });
}

function buildGraph(groups: WorkflowGroup[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  let bandTop = 0;

  for (const group of groups) {
    const n = Math.max(group.tasks.length, 1);
    const rowWidth = n * (TASK_W + COL_GAP) - COL_GAP;
    const wfX = Math.max(0, rowWidth / 2 - 130);

    const wfNodeId = `wf-${group.id}`;
    const doneCount = group.tasks.filter((t) => t.stage === "done").length;
    const liveCount = group.tasks.filter((t) => t.isLive).length;
    nodes.push({
      id: wfNodeId,
      type: "workflow",
      position: { x: wfX, y: bandTop },
      data: {
        title: group.title,
        planStatus: group.planStatus,
        taskCount: group.tasks.length,
        doneCount,
        liveCount,
      } satisfies WorkflowNodeData,
      draggable: false,
    });

    group.tasks.forEach((task, j) => {
      const taskNodeId = `task-${task.id}`;
      nodes.push({
        id: taskNodeId,
        type: "task",
        position: { x: j * (TASK_W + COL_GAP), y: bandTop + ROW_Y },
        data: { item: task } satisfies TaskNodeData,
        draggable: false,
      });
      edges.push({
        id: `e-${wfNodeId}-${taskNodeId}`,
        source: wfNodeId,
        target: taskNodeId,
        animated: task.isLive,
        style: {
          stroke: task.isLive ? "#FF4A1C" : "#46443A",
          strokeWidth: task.isLive ? 2 : 1.5,
        },
      });
    });

    bandTop += ROW_Y + 130 + BAND_PAD;
  }

  return { nodes, edges };
}

// ─── The flow view ──────────────────────────────────────────────────────────────

export function LiveFlow({ board }: { board: LifecycleBoard }) {
  const router = useRouter();

  const { nodes, edges } = useMemo(() => {
    const groups = groupByWorkflow(board);
    return buildGraph(groups);
  }, [board]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
      minZoom={0.25}
      maxZoom={1.5}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable
      panOnScroll
      proOptions={{ hideAttribution: true }}
      onNodeClick={(_e, node) => {
        const data = node.data as Partial<TaskNodeData>;
        if (data.item?.href) router.push(data.item.href);
      }}
      className="bg-neutral-950"
    >
      <Background color="#262626" gap={20} />
      <Controls showInteractive={false} className="!border-neutral-800 !bg-neutral-900" />
    </ReactFlow>
  );
}
