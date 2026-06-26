"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Layers,
  BookOpen,
  Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Company",
    href: "/company",
    icon: Building2,
  },
  {
    label: "Work",
    href: "/work",
    icon: Layers,
  },
  {
    label: "Memory",
    href: "/memory",
    icon: BookOpen,
  },
  {
    label: "Inbox",
    href: "/inbox",
    icon: Inbox,
  },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-[220px] shrink-0 flex-col border-r border-neutral-800 bg-neutral-950">
      {/* Logo / workspace header */}
      <div className="flex h-12 items-center gap-2.5 border-b border-neutral-800 px-4">
        <div className="flex h-5 w-5 items-center justify-center rounded bg-white">
          <span className="text-[10px] font-bold text-neutral-900">E</span>
        </div>
        <span className="text-sm font-semibold text-neutral-100 truncate">
          Engineering OS
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-0.5 p-2 pt-3">
        {navItems.map(({ label, href, icon: Icon }) => {
          const isActive =
            pathname === href || pathname.startsWith(href + "/");

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                isActive
                  ? "bg-neutral-800 text-neutral-100 font-medium"
                  : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  isActive
                    ? "text-neutral-200"
                    : "text-neutral-500 group-hover:text-neutral-300"
                )}
                aria-hidden="true"
              />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom spacer for user menu */}
      <div className="h-12 border-t border-neutral-800" />
    </aside>
  );
}
