import * as React from "react";
import { cn } from "@/lib/utils";

// ── Type definitions ────────────────────────────────────────────────────────

export const EMPLOYEE_STATUSES = [
  "active",
  "idle",
  "working",
  "unavailable",
] as const;

export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export const TASK_STATUSES = [
  "todo",
  "in-progress",
  "in-review",
  "done",
  "cancelled",
  "blocked",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

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

interface StatusConfigEntry {
  color: string;
  animate: boolean;
  label: string;
}

const STATUS_CONFIG: Record<string, StatusConfigEntry> = {
  active: { color: "bg-emerald-400", animate: true, label: "Active" },
  running: { color: "bg-emerald-400", animate: true, label: "Running" },
  connected: { color: "bg-emerald-400", animate: false, label: "Connected" },
  "in-progress": {
    color: "bg-emerald-400",
    animate: false,
    label: "In Progress",
  },
  done: { color: "bg-emerald-500", animate: false, label: "Done" },
  completed: { color: "bg-emerald-500", animate: false, label: "Completed" },
  complete: { color: "bg-emerald-500", animate: false, label: "Complete" },
  idle: { color: "bg-neutral-500", animate: false, label: "Idle" },
  queued: { color: "bg-neutral-500", animate: false, label: "Queued" },
  pending: { color: "bg-neutral-500", animate: false, label: "Pending" },
  todo: { color: "bg-neutral-500", animate: false, label: "To Do" },
  disconnected: {
    color: "bg-neutral-600",
    animate: false,
    label: "Disconnected",
  },
  unavailable: { color: "bg-gray-300", animate: false, label: "Unavailable" },
  working: { color: "bg-blue-400", animate: false, label: "Working" },
  prepared: { color: "bg-blue-400", animate: false, label: "Prepared" },
  syncing: { color: "bg-blue-400", animate: true, label: "Syncing" },
  "in-review": {
    color: "bg-violet-400",
    animate: false,
    label: "In Review",
  },
  blocked: { color: "bg-amber-400", animate: false, label: "Blocked" },
  needs_clarification: {
    color: "bg-amber-400",
    animate: false,
    label: "Needs Clarification",
  },
  failed: { color: "bg-red-400", animate: false, label: "Failed" },
  error: { color: "bg-red-400", animate: false, label: "Error" },
  cancelled: { color: "bg-red-400", animate: false, label: "Cancelled" },
  canceled: { color: "bg-red-400", animate: false, label: "Canceled" },
  analyzing: { color: "bg-blue-400", animate: true, label: "Analyzing" },
};

const DOT_COLOR: Record<string, string> = Object.fromEntries(
  Object.entries(STATUS_CONFIG).map(([status, config]) => [status, config.color])
);

const ANIMATE_STATUSES = new Set<string>(
  Object.entries(STATUS_CONFIG)
    .filter(([, config]) => config.animate)
    .map(([status]) => status)
);

const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(STATUS_CONFIG).map(([status, config]) => [status, config.label])
);

const SIZE_CLASSES: Record<DotSize, string> = {
  xs: "h-1.5 w-1.5",
  sm: "h-2 w-2",
  md: "h-2.5 w-2.5",
};

/**
 * Checks whether a string is a valid employee status.
 *
 * @param s - Raw status value from the database
 * @returns True when the value is a known employee status
 */
export function isEmployeeStatus(s: string): s is EmployeeStatus {
  return (EMPLOYEE_STATUSES as readonly string[]).includes(s);
}

/**
 * Checks whether a string is a valid task status.
 *
 * @param s - Raw status value from the database
 * @returns True when the value is a known task status
 */
export function isTaskStatus(s: string): s is TaskStatus {
  return (TASK_STATUSES as readonly string[]).includes(s);
}

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
      role="img"
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
