"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Gauge,
  LayoutDashboard,
  Building2,
  Layers,
  BookOpen,
  Inbox,
  MessageSquare,
  Bell,
  Radio,
  TrendingUp,
  Settings,
  Target,
  ShieldCheck,
  PackageCheck,
  Link2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand";
import { WorkspaceSwitcher } from "@/components/nav/workspace-switcher";
import type { SwitcherWorkspace } from "@/lib/active-workspace";

type NavSection = {
  label?: string;
  items: readonly {
    label: string;
    href: string;
    icon: React.ElementType;
  }[];
};

const navSections: NavSection[] = [
  {
    items: [
      { label: "Control Center", href: "/control-center", icon: Gauge },
      { label: "Live", href: "/work/live", icon: Radio },
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Outcomes", href: "/work/outcomes", icon: Target },
      { label: "Work", href: "/work", icon: Layers },
      { label: "Inbox", href: "/inbox", icon: Inbox },
      { label: "Company", href: "/company", icon: Building2 },
    ],
  },
  {
    label: "Quality",
    items: [
      { label: "Reviews & QA", href: "/work/quality", icon: ShieldCheck },
      { label: "Releases", href: "/work/releases", icon: PackageCheck },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "Timeline", href: "/timeline", icon: TrendingUp },
      { label: "Memory", href: "/memory", icon: BookOpen },
      { label: "Chat", href: "/chat", icon: MessageSquare },
    ],
  },
];

const bottomNavItems = [
  { label: "Connections", href: "/connections", icon: Link2 },
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "Settings", href: "/settings", icon: Settings },
] as const;

function NavItem({
  label,
  href,
  icon: Icon,
  isActive,
  badge,
}: {
  label: string;
  href: string;
  icon: React.ElementType;
  isActive: boolean;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
        isActive
          ? "bg-neutral-800/80 text-neutral-100 font-medium"
          : "text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200"
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-neutral-100" />
      )}
      <Icon
        className={cn(
          "h-4 w-4 shrink-0 transition-colors",
          isActive
            ? "text-neutral-100"
            : "text-neutral-500 group-hover:text-neutral-300"
        )}
        aria-hidden="true"
      />
      {label}
      {typeof badge === "number" && badge > 0 && (
        <span
          className="ml-auto inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-amber-500/20 px-1.5 text-[10px] font-semibold text-amber-400"
          aria-label={`${badge} pending`}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  );
}

export function Sidebar({
  badges = {},
  workspaces,
  activeWorkspaceId,
}: {
  badges?: Record<string, number>;
  workspaces: SwitcherWorkspace[];
  activeWorkspaceId: string | null;
}) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/work") {
      return (
        pathname === "/work" ||
        (pathname.startsWith("/work/") &&
          !pathname.startsWith("/work/live") &&
          !pathname.startsWith("/work/outcomes") &&
          !pathname.startsWith("/work/quality") &&
          !pathname.startsWith("/work/releases") &&
          !pathname.startsWith("/work/workspaces") &&
          !pathname.startsWith("/work/repositories"))
      );
    }
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <aside className="flex h-full w-[220px] shrink-0 flex-col border-r border-neutral-800 bg-neutral-950">
      {/* Logo / workspace header */}
      <div className="flex h-12 items-center gap-2.5 border-b border-neutral-800 px-4">
        <BrandMark className="h-7 w-auto text-neutral-100" />
        <span className="text-sm font-semibold text-neutral-100 truncate">
          Avion
        </span>
      </div>

      {/* Workspace context switcher */}
      <div className="border-b border-neutral-800">
        <WorkspaceSwitcher
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
        />
      </div>

      {/* Navigation sections */}
      <nav className="flex flex-1 flex-col overflow-y-auto p-2 pt-2 gap-4">
        {navSections.map((section, sIdx) => (
          <div key={sIdx} className="flex flex-col gap-0.5">
            {section.label && (
              <p className="mb-0.5 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-neutral-600">
                {section.label}
              </p>
            )}
            {section.items.map(({ label, href, icon }) => (
              <NavItem
                key={href}
                label={label}
                href={href}
                icon={icon}
                isActive={isActive(href)}
                badge={badges[href]}
              />
            ))}
          </div>
        ))}
      </nav>

      {/* Bottom nav */}
      <nav className="flex flex-col gap-0.5 border-t border-neutral-800 p-2">
        {bottomNavItems.map(({ label, href, icon }) => (
          <NavItem
            key={href}
            label={label}
            href={href}
            icon={icon}
            isActive={isActive(href)}
            badge={badges[href]}
          />
        ))}
      </nav>

      {/* Spacer for user menu */}
      <div className="h-12" />
    </aside>
  );
}
