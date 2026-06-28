import * as React from "react";
import { cn } from "@/lib/utils";

// ── Type definitions ────────────────────────────────────────────────────────

export type EmployeeStatus = "active" | "idle" | "working" | "unavailable";

export type TaskStatus =
  | "todo"
  | "in-progress"
  | "in-review"
  | "done"
  | "cancelled"
  | "blocked";

export type ExecutionSessionStatus =
  | "queued"
  | "prepared"
  | "running"
  | "completed"
  | "failed"
  | "canceled"
  | "needs_clarification";

export type IntegrationStatus =
  | "connected"
  | "disconnected"
  | "error"
  | "syncing";

export type RepositoryAnalysisStatus =
  | "pending"
  | "analyzing"
  | "complete"
  | "failed";

// Union of all statuses understood by StatusDot / StatusIndicator
export type AnyStatus =
  | EmployeeStatus
  | TaskStatus
  | ExecutionSessionStatus
  | IntegrationStatus
  | RepositoryAnalysisStatus;

type DotSize = "xs" | "sm" | "md";

// ── Color mapping ───────────────────────────────────────────────────────────

const DOT_COLOR: Record<string, string> = {
  // Green — active / live / success
  active: "bg-emerald-400",
  running: "bg-emerald-400",
  connected: "bg-emerald-400",
  "in-progress": "bg-emerald-400",

  // Green (solid, no pulse) — finished / done
  done: "bg-emerald-500",
  completed: "bg-emerald-500",
  complete: "bg-emerald-500",

  // Gray — idle / queued / not started
  idle: "bg-neutral-500",
  queued: "bg-neutral-500",
  pending: "bg-neutral-500",
  todo: "bg-neutral-500",
  disconnected: "bg-neutral-600",

  // Blue — working / prepared
  working: "bg-blue-400",
  prepared: "bg-blue-400",
  syncing: "bg-blue-400",

  // Purple / violet — in review
  "in-review": "bg-violet-400",

  // Amber / orange — blocked / needs clarification
  blocked: "bg-amber-400",
  needs_clarification: "bg-amber-400",

  // Red — failed / error / cancelled
  failed: "bg-red-400",
  error: "bg-red-400",
  cancelled: "bg-red-400",
  canceled: "bg-red-400",

  // Analyzing — blue-ish pulse
  analyzing: "bg-blue-400",
};

/** Statuses that should pulse to indicate live activity. */
const ANIMATE_STATUSES = new Set<string>([
  "running",
  "syncing",
  "analyzing",
  "active",
]);

const SIZE_CLASSES: Record<DotSize, string> = {
  xs: "h-1.5 w-1.5",
  sm: "h-2 w-2",
  md: "h-2.5 w-2.5",
};

// ── Label mapping (human-readable) ─────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  idle: "Idle",
  working: "Working",
  unavailable: "Unavailable",
  todo: "To Do",
  "in-progress": "In Progress",
  "in-review": "In Review",
  done: "Done",
  cancelled: "Cancelled",
  blocked: "Blocked",
  queued: "Queued",
  prepared: "Prepared",
  running: "Running",
  completed: "Completed",
  failed: "Failed",
  canceled: "Canceled",
  needs_clarification: "Needs Clarification",
  connected: "Connected",
  disconnected: "Disconnected",
  error: "Error",
  syncing: "Syncing",
  pending: "Pending",
  analyzing: "Analyzing",
  complete: "Complete",
};

// ── Components ──────────────────────────────────────────────────────────────

interface StatusDotProps {
  status: AnyStatus;
  size?: DotSize;
  /** Override auto-pulse behaviour. Pass `true` to force pulse, `false` to suppress. */
  animate?: boolean;
  className?: string;
}

/**
 * A small colored circle that represents a status at a glance.
 * Automatically pulses for live states (running, syncing, analyzing, active).
 */
export function StatusDot({
  status,
  size = "sm",
  animate,
  className,
}: StatusDotProps) {
  const shouldAnimate = animate ?? ANIMATE_STATUSES.has(status);
  const color = DOT_COLOR[status] ?? "bg-neutral-500";

  return (
    <span
      aria-label={STATUS_LABEL[status] ?? status}
      className={cn(
        "inline-block shrink-0 rounded-full",
        SIZE_CLASSES[size],
        color,
        shouldAnimate && "animate-pulse",
        className
      )}
    />
  );
}

interface StatusIndicatorProps {
  status: AnyStatus;
  /** Override the auto-derived label. */
  label?: string;
  size?: DotSize;
  className?: string;
}

/**
 * A dot + label pair for inline status display.
 */
export function StatusIndicator({
  status,
  label,
  size = "sm",
  className,
}: StatusIndicatorProps) {
  const text = label ?? STATUS_LABEL[status] ?? status;
  const textSize = size === "xs" ? "text-[10px]" : "text-xs";

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <StatusDot status={status} size={size} />
      <span className={cn(textSize, "text-neutral-400 capitalize")}>{text}</span>
    </span>
  );
}

// ── Domain-specific wrappers ────────────────────────────────────────────────

interface ExecutionStatusIndicatorProps {
  status: ExecutionSessionStatus;
  showLabel?: boolean;
  size?: DotSize;
  className?: string;
}

/**
 * Status indicator scoped to execution sessions.
 */
export function ExecutionStatusIndicator({
  status,
  showLabel = true,
  size = "sm",
  className,
}: ExecutionStatusIndicatorProps) {
  if (showLabel) {
    return <StatusIndicator status={status} size={size} className={className} />;
  }
  return <StatusDot status={status} size={size} className={className} />;
}

interface EmployeeStatusIndicatorProps {
  status: EmployeeStatus;
  showLabel?: boolean;
  size?: DotSize;
  className?: string;
}

/**
 * Status indicator scoped to employees.
 */
export function EmployeeStatusIndicator({
  status,
  showLabel = false,
  size = "sm",
  className,
}: EmployeeStatusIndicatorProps) {
  if (showLabel) {
    return <StatusIndicator status={status} size={size} className={className} />;
  }
  return <StatusDot status={status} size={size} className={className} />;
}

interface IntegrationStatusIndicatorProps {
  status: IntegrationStatus;
  showLabel?: boolean;
  size?: DotSize;
  className?: string;
}

/**
 * Status indicator scoped to provider integrations.
 */
export function IntegrationStatusIndicator({
  status,
  showLabel = true,
  size = "sm",
  className,
}: IntegrationStatusIndicatorProps) {
  if (showLabel) {
    return <StatusIndicator status={status} size={size} className={className} />;
  }
  return <StatusDot status={status} size={size} className={className} />;
}
