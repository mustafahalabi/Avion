import * as React from "react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Base Badge
// ---------------------------------------------------------------------------

type BadgeVariant =
  | "default"
  | "secondary"
  | "success"
  | "warning"
  | "destructive"
  | "info"
  | "outline";

const variantClasses: Record<BadgeVariant, string> = {
  default:     "bg-neutral-800 text-neutral-200 border-neutral-700",
  secondary:   "bg-neutral-700 text-neutral-300 border-neutral-600",
  success:     "bg-success-950 text-success-400 border-success-800",
  warning:     "bg-warning-950 text-warning-400 border-warning-800",
  destructive: "bg-danger-950 text-danger-400 border-danger-800",
  info:        "bg-info-950 text-info-400 border-info-800",
  outline:     "bg-transparent text-neutral-400 border-neutral-600",
};

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({
  className,
  variant = "default",
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-badge border px-2 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Shared badge shell — keeps all semantic badges visually consistent
// ---------------------------------------------------------------------------

interface SemanticBadgeProps {
  label: string;
  colorClasses: string;
  dot?: boolean;
  dotColor?: string;
  className?: string;
  "aria-label"?: string;
}

function SemanticBadge({
  label,
  colorClasses,
  dot,
  dotColor,
  className,
  "aria-label": ariaLabel,
}: SemanticBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-none border px-2 py-0.5 text-xs font-medium",
        colorClasses,
        className
      )}
      aria-label={ariaLabel ?? label}
    >
      {dot && (
        <span
          className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotColor)}
          aria-hidden="true"
        />
      )}
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// StatusBadge
// Covers: todo | in-progress | in-review | done | cancelled | blocked | failed
// ---------------------------------------------------------------------------

const STATUS_BADGE_CONFIG: Record<
  string,
  { label: string; colorClasses: string; dotColor: string }
> = {
  todo: {
    label: "To Do",
    colorClasses: "bg-neutral-900 text-neutral-400 border-neutral-700",
    dotColor: "bg-neutral-500",
  },
  "in-progress": {
    label: "In Progress",
    colorClasses: "bg-blue-950 text-blue-400 border-blue-800",
    dotColor: "bg-blue-400",
  },
  "in-review": {
    label: "In Review",
    colorClasses: "bg-amber-950 text-amber-400 border-amber-800",
    dotColor: "bg-amber-400",
  },
  done: {
    label: "Done",
    colorClasses: "bg-emerald-950 text-emerald-400 border-emerald-800",
    dotColor: "bg-emerald-400",
  },
  cancelled: {
    label: "Cancelled",
    colorClasses: "bg-neutral-900 text-neutral-600 border-neutral-800",
    dotColor: "bg-neutral-600",
  },
  blocked: {
    label: "Blocked",
    colorClasses: "bg-red-950 text-red-400 border-red-800",
    dotColor: "bg-red-400",
  },
  failed: {
    label: "Failed",
    colorClasses: "bg-red-950 text-red-400 border-red-800",
    dotColor: "bg-red-500",
  },
};

export function StatusBadge({
  status,
  dot = true,
  className,
}: {
  status: string;
  dot?: boolean;
  className?: string;
}) {
  const cfg = STATUS_BADGE_CONFIG[status] ?? {
    label: status,
    colorClasses: "bg-neutral-900 text-neutral-400 border-neutral-700",
    dotColor: "bg-neutral-500",
  };
  return (
    <SemanticBadge
      label={cfg.label}
      colorClasses={cfg.colorClasses}
      dot={dot}
      dotColor={cfg.dotColor}
      className={className}
      aria-label={`Status: ${cfg.label}`}
    />
  );
}

// ---------------------------------------------------------------------------
// PriorityBadge
// Covers: urgent | high | medium | low | none
// ---------------------------------------------------------------------------

const PRIORITY_BADGE_CONFIG: Record<
  string,
  { label: string; colorClasses: string; dotColor: string }
> = {
  urgent: {
    label: "Urgent",
    colorClasses: "bg-red-950 text-red-400 border-red-800",
    dotColor: "bg-red-400",
  },
  high: {
    label: "High",
    colorClasses: "bg-orange-950 text-orange-400 border-orange-800",
    dotColor: "bg-orange-400",
  },
  medium: {
    label: "Medium",
    colorClasses: "bg-amber-950 text-amber-400 border-amber-800",
    dotColor: "bg-amber-400",
  },
  low: {
    label: "Low",
    colorClasses: "bg-neutral-900 text-neutral-500 border-neutral-700",
    dotColor: "bg-neutral-500",
  },
  none: {
    label: "None",
    colorClasses: "bg-neutral-900 text-neutral-600 border-neutral-800",
    dotColor: "bg-neutral-700",
  },
};

export function PriorityBadge({
  priority,
  dot = true,
  className,
}: {
  priority: string;
  dot?: boolean;
  className?: string;
}) {
  const cfg = PRIORITY_BADGE_CONFIG[priority] ?? PRIORITY_BADGE_CONFIG["none"];
  return (
    <SemanticBadge
      label={cfg.label}
      colorClasses={cfg.colorClasses}
      dot={dot}
      dotColor={cfg.dotColor}
      className={className}
      aria-label={`Priority: ${cfg.label}`}
    />
  );
}

// ---------------------------------------------------------------------------
// AgentTypeBadge
// Covers employee roles / agent types across the org
// ---------------------------------------------------------------------------

const AGENT_TYPE_BADGE_CONFIG: Record<
  string,
  { label: string; colorClasses: string }
> = {
  // Executive
  cto: {
    label: "CTO",
    colorClasses: "bg-neutral-950 text-neutral-400 border-neutral-800",
  },
  // Product
  "product-manager": {
    label: "Product Manager",
    colorClasses: "bg-blue-950 text-blue-400 border-blue-800",
  },
  "product-analyst": {
    label: "Product Analyst",
    colorClasses: "bg-blue-950 text-blue-400 border-blue-800",
  },
  "technical-writer": {
    label: "Technical Writer",
    colorClasses: "bg-sky-950 text-sky-400 border-sky-800",
  },
  // Engineering
  "tech-lead": {
    label: "Tech Lead",
    colorClasses: "bg-emerald-950 text-emerald-400 border-emerald-800",
  },
  "frontend-engineer": {
    label: "Frontend",
    colorClasses: "bg-emerald-950 text-emerald-400 border-emerald-800",
  },
  "backend-engineer": {
    label: "Backend",
    colorClasses: "bg-teal-950 text-teal-400 border-teal-800",
  },
  "mobile-engineer": {
    label: "Mobile",
    colorClasses: "bg-cyan-950 text-cyan-400 border-cyan-800",
  },
  "ai-engineer": {
    label: "AI Engineer",
    colorClasses: "bg-neutral-950 text-neutral-400 border-neutral-800",
  },
  "infrastructure-engineer": {
    label: "Infrastructure",
    colorClasses: "bg-slate-900 text-slate-400 border-slate-700",
  },
  // Quality
  reviewer: {
    label: "Reviewer",
    colorClasses: "bg-amber-950 text-amber-400 border-amber-800",
  },
  "qa-engineer": {
    label: "QA",
    colorClasses: "bg-amber-950 text-amber-400 border-amber-800",
  },
  "security-engineer": {
    label: "Security",
    colorClasses: "bg-red-950 text-red-400 border-red-800",
  },
  // Operations
  devops: {
    label: "DevOps",
    colorClasses: "bg-rose-950 text-rose-400 border-rose-800",
  },
  "release-manager": {
    label: "Release Manager",
    colorClasses: "bg-rose-950 text-rose-400 border-rose-800",
  },
  "monitoring-engineer": {
    label: "Monitoring",
    colorClasses: "bg-rose-950 text-rose-400 border-rose-800",
  },
  // Growth
  "seo-specialist": {
    label: "SEO",
    colorClasses: "bg-neutral-950 text-neutral-400 border-neutral-800",
  },
  analytics: {
    label: "Analytics",
    colorClasses: "bg-neutral-950 text-neutral-400 border-neutral-800",
  },
  marketing: {
    label: "Marketing",
    colorClasses: "bg-pink-950 text-pink-400 border-pink-800",
  },
};

export function AgentTypeBadge({
  agentType,
  className,
}: {
  agentType: string;
  className?: string;
}) {
  const cfg = AGENT_TYPE_BADGE_CONFIG[agentType.toLowerCase()] ?? {
    label: agentType,
    colorClasses: "bg-neutral-800 text-neutral-300 border-neutral-700",
  };
  return (
    <SemanticBadge
      label={cfg.label}
      colorClasses={cfg.colorClasses}
      className={className}
      aria-label={`Role: ${cfg.label}`}
    />
  );
}

// ---------------------------------------------------------------------------
// AnalysisStatusBadge
// Covers repository / execution analysis pipeline statuses
// ---------------------------------------------------------------------------

const ANALYSIS_STATUS_BADGE_CONFIG: Record<
  string,
  { label: string; colorClasses: string; dotColor: string }
> = {
  pending: {
    label: "Pending",
    colorClasses: "bg-neutral-900 text-neutral-400 border-neutral-700",
    dotColor: "bg-neutral-500",
  },
  queued: {
    label: "Queued",
    colorClasses: "bg-neutral-900 text-neutral-400 border-neutral-700",
    dotColor: "bg-neutral-500",
  },
  running: {
    label: "Running",
    colorClasses: "bg-blue-950 text-blue-400 border-blue-800",
    dotColor: "bg-blue-400",
  },
  prepared: {
    label: "Prepared",
    colorClasses: "bg-neutral-950 text-neutral-400 border-neutral-800",
    dotColor: "bg-neutral-400",
  },
  completed: {
    label: "Completed",
    colorClasses: "bg-emerald-950 text-emerald-400 border-emerald-800",
    dotColor: "bg-emerald-400",
  },
  complete: {
    label: "Complete",
    colorClasses: "bg-emerald-950 text-emerald-400 border-emerald-800",
    dotColor: "bg-emerald-400",
  },
  failed: {
    label: "Failed",
    colorClasses: "bg-red-950 text-red-400 border-red-800",
    dotColor: "bg-red-500",
  },
  needs_clarification: {
    label: "Needs Clarification",
    colorClasses: "bg-amber-950 text-amber-400 border-amber-800",
    dotColor: "bg-amber-400",
  },
  cancelled: {
    label: "Cancelled",
    colorClasses: "bg-neutral-900 text-neutral-600 border-neutral-800",
    dotColor: "bg-neutral-600",
  },
  stale: {
    label: "Stale",
    colorClasses: "bg-neutral-900 text-neutral-600 border-neutral-800",
    dotColor: "bg-neutral-600",
  },
};

// ---------------------------------------------------------------------------
// AdapterBadge — WHICH real agent ran the work (claude_code | codex | human).
// Distinct from AgentTypeBadge (org role). A sharp mono chip with a colored
// glyph so Claude Code vs Codex reads at a glance across the whole app.
// ---------------------------------------------------------------------------

const ADAPTER_CONFIG: Record<string, { label: string; glyph: string }> = {
  claude_code: { label: "Claude Code", glyph: "bg-[#C98A3E]" },
  "claude-code": { label: "Claude Code", glyph: "bg-[#C98A3E]" },
  claude: { label: "Claude Code", glyph: "bg-[#C98A3E]" },
  codex: { label: "Codex", glyph: "bg-[#3E8E7E]" },
  human: { label: "Human", glyph: "bg-neutral-400" },
};

/** Human label for a raw agentType, e.g. "claude_code" → "Claude Code". */
export function adapterLabel(agentType: string): string {
  return ADAPTER_CONFIG[agentType.toLowerCase()]?.label ?? agentType;
}

export function AdapterBadge({
  agentType,
  className,
}: {
  agentType: string;
  className?: string;
}) {
  const cfg = ADAPTER_CONFIG[agentType.toLowerCase()] ?? {
    label: agentType,
    glyph: "bg-neutral-400",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-none border border-neutral-600 bg-neutral-900 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-neutral-100",
        className
      )}
      aria-label={`Agent: ${cfg.label}`}
    >
      <span className={cn("h-2 w-2 shrink-0", cfg.glyph)} aria-hidden="true" />
      {cfg.label}
    </span>
  );
}

export function AnalysisStatusBadge({
  status,
  dot = true,
  className,
}: {
  status: string;
  dot?: boolean;
  className?: string;
}) {
  const cfg = ANALYSIS_STATUS_BADGE_CONFIG[status] ?? {
    label: status,
    colorClasses: "bg-neutral-900 text-neutral-400 border-neutral-700",
    dotColor: "bg-neutral-500",
  };
  return (
    <SemanticBadge
      label={cfg.label}
      colorClasses={cfg.colorClasses}
      dot={dot}
      dotColor={cfg.dotColor}
      className={className}
      aria-label={`Analysis status: ${cfg.label}`}
    />
  );
}
