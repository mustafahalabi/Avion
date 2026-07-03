"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  EmployeeStatusIndicator,
  isEmployeeStatus,
} from "@/components/ui/status-indicator";

export type EmployeeCardData = {
  id: string;
  name: string;
  status: string;
  roleLabel: string;
  manager: { id: string; name: string } | null;
  reportsTo: string | null;
  colorClass: string;
  avatarClass: string;
};

export function EmployeeCard({
  id,
  name,
  status,
  roleLabel,
  manager,
  reportsTo,
  colorClass,
  avatarClass,
}: EmployeeCardData) {
  const router = useRouter();
  const href = `/company/employees/${id}`;

  return (
    // A clickable container (not an <a>) so the manager link below can be a
    // real <Link> without nesting anchors. Navigation is handled here.
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(href)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(href);
        }
      }}
      className={cn(
        "group flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors hover:brightness-110 focus:outline-none focus-visible:ring-1 focus-visible:ring-neutral-500",
        colorClass
      )}
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
          avatarClass
        )}
      >
        {name[0]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-neutral-200 truncate">
            {name}
          </p>
          <EmployeeStatusIndicator
            status={isEmployeeStatus(status) ? status : "idle"}
            showLabel={true}
            size="xs"
            className="shrink-0"
          />
        </div>
        <p className="mt-0.5 text-xs text-neutral-500 truncate">{roleLabel}</p>
        {manager ? (
          <p className="mt-1 text-[11px] text-neutral-600 truncate">
            Reports to{" "}
            <Link
              href={`/company/employees/${manager.id}`}
              onClick={(e) => e.stopPropagation()}
              className="text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              {manager.name}
            </Link>
          </p>
        ) : reportsTo ? (
          <p className="mt-1 text-[11px] text-neutral-600 truncate">
            Reports to {reportsTo}
          </p>
        ) : null}
      </div>
    </div>
  );
}
