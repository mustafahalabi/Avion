import Link from "next/link";
import { AlertCircle, AlertTriangle, ChevronRight, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  AttentionItem,
  AttentionSeverity,
} from "@/lib/control-center-view-model";
import { ApprovalActions } from "@/app/(app)/inbox/approval-actions";

const SEVERITY_STYLES: Record<
  AttentionSeverity,
  { border: string; bg: string; icon: React.ElementType; iconColor: string }
> = {
  critical: {
    border: "border-amber-900/50",
    bg: "bg-amber-950/20",
    icon: AlertCircle,
    iconColor: "text-amber-400",
  },
  warning: {
    border: "border-red-900/40",
    bg: "bg-red-950/10",
    icon: AlertTriangle,
    iconColor: "text-red-400",
  },
  info: {
    border: "border-neutral-800",
    bg: "bg-neutral-900",
    icon: Circle,
    iconColor: "text-neutral-500",
  },
};

/**
 * Renders the CEO's prioritized "needs attention" queue. Inline review/QA
 * checkpoints get Approve/Reject controls wired to the real approval services.
 */
export function AttentionPanel({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-neutral-800 py-8 text-center">
        <Circle className="h-5 w-5 text-neutral-700" />
        <div>
          <p className="text-sm font-medium text-neutral-500">All clear</p>
          <p className="mt-0.5 text-xs text-neutral-700">
            Nothing needs your attention right now.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      {items.map((item) => {
        const styles = SEVERITY_STYLES[item.severity];
        const Icon = styles.icon;
        return (
          <div
            key={item.id}
            className={cn(
              "flex items-start gap-3 rounded-lg border px-4 py-3",
              styles.border,
              styles.bg
            )}
          >
            <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", styles.iconColor)} />
            <div className="flex-1 min-w-0">
              <Link
                href={item.href}
                className="group flex items-center gap-1 text-sm font-medium text-neutral-200 hover:text-neutral-50 transition-colors"
              >
                <span className="truncate">{item.title}</span>
                <ChevronRight className="h-3 w-3 shrink-0 text-neutral-600 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <p className="mt-0.5 text-xs text-neutral-500">{item.detail}</p>
            </div>
            {item.checkpoint && (
              <div className="shrink-0">
                <ApprovalActions
                  kind={item.checkpoint.kind}
                  id={item.checkpoint.id}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
