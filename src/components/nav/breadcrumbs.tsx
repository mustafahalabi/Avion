import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type Crumb = { label: string; href?: string };

/** Workspace → section → entity breadcrumb trail, rendered in a page header. */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-xs">
      {items.map((c, i) => {
        const last = i === items.length - 1;
        return (
          <span key={i} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && (
              <ChevronRight className="h-3 w-3 shrink-0 text-neutral-700" />
            )}
            {c.href && !last ? (
              <Link
                href={c.href}
                className="truncate text-neutral-500 transition-colors hover:text-neutral-300"
              >
                {c.label}
              </Link>
            ) : (
              <span
                className={
                  last
                    ? "truncate font-semibold text-neutral-100"
                    : "truncate text-neutral-500"
                }
              >
                {c.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
