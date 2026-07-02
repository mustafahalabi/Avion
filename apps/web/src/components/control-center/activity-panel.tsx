import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { TimelineList } from "@/components/timeline-list";
import type { TimelineItem } from "@/components/timeline-entry";

/**
 * Compact activity feed for the Control Center — a header row plus the shared
 * {@link TimelineList} rendering of recent company + planning events.
 */
export function ActivityPanel({
  items,
  title = "Recent Activity",
  viewAllHref,
}: {
  items: TimelineItem[];
  title?: string;
  viewAllHref?: string;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-3.5 w-3.5 text-neutral-400" />
          <h3 className="text-sm font-medium text-neutral-200">{title}</h3>
        </div>
        {viewAllHref && (
          <Link
            href={viewAllHref}
            className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors"
          >
            View all
          </Link>
        )}
      </div>
      <TimelineList items={items} />
    </section>
  );
}
