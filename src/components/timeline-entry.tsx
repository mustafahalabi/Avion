import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Bug,
  CheckCircle2,
  Clock,
  Eye,
  FileText,
  GitPullRequest,
  Inbox,
  Map,
  XCircle,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Public type ────────────────────────────────────────────────────────────

export type TimelineItem = {
  id: string;
  type: string;
  description: string;
  contextLabel: string;
  contextHref: string;
  createdAt: Date;
};

// ─── Event config ────────────────────────────────────────────────────────────

type EventConfig = {
  color: string;
  bg: string;
  ring: string;
  icon: React.ElementType;
  label: string;
};

const EXACT_CONFIG: Record<string, Omit<EventConfig, "label">> = {
  intake: {
    color: "text-blue-400",
    bg: "bg-blue-500/15",
    ring: "ring-blue-500/30",
    icon: Inbox,
  },
  planning: {
    color: "text-violet-400",
    bg: "bg-violet-500/15",
    ring: "ring-violet-500/30",
    icon: Map,
  },
  awaiting_approval: {
    color: "text-amber-400",
    bg: "bg-amber-500/15",
    ring: "ring-amber-500/30",
    icon: Clock,
  },
  executing: {
    color: "text-emerald-400",
    bg: "bg-emerald-500/15",
    ring: "ring-emerald-500/30",
    icon: Zap,
  },
  in_review: {
    color: "text-orange-400",
    bg: "bg-orange-500/15",
    ring: "ring-orange-500/30",
    icon: Eye,
  },
  in_qa: {
    color: "text-purple-400",
    bg: "bg-purple-500/15",
    ring: "ring-purple-500/30",
    icon: Bug,
  },
  complete: {
    color: "text-emerald-400",
    bg: "bg-emerald-600/15",
    ring: "ring-emerald-600/30",
    icon: CheckCircle2,
  },
  blocked: {
    color: "text-red-400",
    bg: "bg-red-500/15",
    ring: "ring-red-500/30",
    icon: AlertTriangle,
  },
  cancelled: {
    color: "text-neutral-500",
    bg: "bg-neutral-700/30",
    ring: "ring-neutral-700/30",
    icon: XCircle,
  },
};

const PREFIX_CONFIG: Array<{
  prefix: string;
  base: Omit<EventConfig, "label">;
}> = [
  {
    prefix: "plan.",
    base: { ...EXACT_CONFIG.planning, icon: FileText },
  },
  {
    prefix: "execution.",
    base: EXACT_CONFIG.executing,
  },
  {
    prefix: "outcome.",
    base: EXACT_CONFIG.complete,
  },
  {
    prefix: "review.",
    base: EXACT_CONFIG.in_review,
  },
  {
    prefix: "qa.",
    base: EXACT_CONFIG.in_qa,
  },
  {
    prefix: "release.",
    base: {
      color: "text-emerald-400",
      bg: "bg-emerald-500/15",
      ring: "ring-emerald-500/30",
      icon: GitPullRequest,
    },
  },
];

const DEFAULT_BASE: Omit<EventConfig, "label"> = {
  color: "text-neutral-400",
  bg: "bg-neutral-700/30",
  ring: "ring-neutral-700/30",
  icon: Activity,
};

function getConfig(type: string): EventConfig {
  const exact = EXACT_CONFIG[type];
  if (exact) {
    return {
      ...exact,
      label: type.replace(/_/g, " "),
    };
  }

  for (const { prefix, base } of PREFIX_CONFIG) {
    if (type.startsWith(prefix)) {
      return {
        ...base,
        label: type.slice(prefix.length).replace(/[_.-]/g, " "),
      };
    }
  }

  return {
    ...DEFAULT_BASE,
    label: type.replace(/[_.-]/g, " "),
  };
}

// ─── Relative time ────────────────────────────────────────────────────────────

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Component ────────────────────────────────────────────────────────────────

interface TimelineEntryProps {
  item: TimelineItem;
  /** When true, the vertical connector below the icon is hidden */
  isLast: boolean;
}

export function TimelineEntry({ item, isLast }: TimelineEntryProps) {
  const cfg = getConfig(item.type);
  const Icon = cfg.icon;
  const href = item.contextHref.startsWith("/")
    ? item.contextHref
    : `/inbox/requests/${item.contextHref}`;

  return (
    <div className="flex items-start gap-4">
      {/* Icon + connector line */}
      <div className="flex flex-col items-center shrink-0">
        <div
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full ring-1",
            cfg.bg,
            cfg.ring
          )}
        >
          <Icon className={cn("h-3.5 w-3.5", cfg.color)} />
        </div>
        {!isLast && (
          <div
            className="mt-1 w-px flex-1 bg-neutral-800"
            style={{ minHeight: "24px" }}
          />
        )}
      </div>

      {/* Content */}
      <div className={cn("flex-1 min-w-0", !isLast && "pb-5")}>
        <p className="text-sm text-neutral-200 leading-relaxed">
          {item.description}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
          <Link
            href={href}
            className="text-neutral-500 hover:text-neutral-300 transition-colors truncate max-w-[220px]"
          >
            {item.contextLabel}
          </Link>
          <span className="text-neutral-800" aria-hidden>
            ·
          </span>
          <span className={cn("font-medium capitalize", cfg.color)}>
            {cfg.label}
          </span>
          <span className="text-neutral-800" aria-hidden>
            ·
          </span>
          <time
            className="text-neutral-600 shrink-0"
            dateTime={item.createdAt.toISOString()}
            title={item.createdAt.toLocaleString()}
          >
            {formatRelativeTime(item.createdAt)}
          </time>
        </div>
      </div>
    </div>
  );
}
