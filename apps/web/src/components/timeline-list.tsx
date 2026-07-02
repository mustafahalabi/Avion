import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { TimelineEntry, type TimelineItem } from "./timeline-entry";

// ─── Date grouping ────────────────────────────────────────────────────────────

type DateGroup = {
  key: string;
  label: string;
  date: Date;
  items: TimelineItem[];
};

function groupByDate(items: TimelineItem[]): DateGroup[] {
  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
  const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);

  const map = new Map<string, DateGroup>();

  for (const item of items) {
    const d = new Date(item.createdAt);
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const key = dayStart.toISOString();

    if (!map.has(key)) {
      let label: string;
      if (dayStart.getTime() === todayStart.getTime()) {
        label = "Today";
      } else if (dayStart.getTime() === yesterdayStart.getTime()) {
        label = "Yesterday";
      } else {
        label = d.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        });
      }
      map.set(key, { key, label, date: dayStart, items: [] });
    }

    map.get(key)!.items.push(item);
  }

  // Most-recent day first
  return Array.from(map.values()).sort(
    (a, b) => b.date.getTime() - a.date.getTime()
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-neutral-800 py-14 text-center">
      <TrendingUp className="h-5 w-5 text-neutral-700" />
      <div>
        <p className="text-sm font-medium text-neutral-500">
          No timeline events yet
        </p>
        <p className="mt-0.5 text-xs text-neutral-700">
          Events appear here as your company processes requests and moves work
          through the pipeline.
        </p>
      </div>
      <Link
        href="/inbox"
        className="rounded-lg border border-neutral-700 px-4 py-2 text-xs font-medium text-neutral-400 hover:bg-neutral-800 transition-colors"
      >
        Submit first request →
      </Link>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface TimelineListProps {
  items: TimelineItem[];
}

export function TimelineList({ items }: TimelineListProps) {
  if (items.length === 0) {
    return <EmptyState />;
  }

  const groups = groupByDate(items);

  return (
    <div className="flex flex-col gap-8">
      {groups.map((group) => (
        <section key={group.key} aria-label={group.label}>
          {/* Date header */}
          <div className="mb-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-neutral-800" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-600">
              {group.label}
            </span>
            <div className="h-px flex-1 bg-neutral-800" />
          </div>

          {/* Entries */}
          <div className="flex flex-col">
            {group.items.map((item, i) => (
              <TimelineEntry
                key={item.id}
                item={item}
                isLast={i === group.items.length - 1}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
