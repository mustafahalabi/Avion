"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
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
import { WorkspaceSwitcher } from "@/components/nav/workspace-switcher";
import { useLiveNotifications } from "@/components/notifications/live-notifications-provider";
import { isNavItemActive } from "@/lib/nav-active";
import type { SwitcherWorkspace } from "@/lib/active-workspace";

type NavItemDef = {
  label: string;
  href: string;
  icon: React.ElementType;
};

type NavSection = {
  label?: string;
  items: readonly NavItemDef[];
};

// Flat, always-visible IA (revamp). Chat is home, Mission Control is the live
// surface, and every destination is one click away — no hide-everything
// collapse. Routes were consolidated: `/board` + `/work/board` → Mission
// Control; `/dashboard` → Home (`/control-center`); `/notifications` lives in
// the bottom rail; duplicate entity routes were removed.
const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: "Chat", href: "/chat", icon: MessageSquare },
      { label: "Mission Control", href: "/work/live", icon: Radio },
      { label: "Home", href: "/control-center", icon: LayoutDashboard },
    ],
  },
  {
    label: "Work",
    items: [
      { label: "Outcomes", href: "/work/outcomes", icon: Target },
      { label: "All work", href: "/work", icon: Layers },
      { label: "Reviews & QA", href: "/work/quality", icon: ShieldCheck },
      { label: "Releases", href: "/work/releases", icon: PackageCheck },
    ],
  },
  {
    label: "Company",
    items: [
      { label: "Needs You", href: "/inbox", icon: Inbox },
      { label: "Company", href: "/company", icon: Building2 },
      { label: "Timeline", href: "/timeline", icon: TrendingUp },
      { label: "Memory", href: "/memory", icon: BookOpen },
    ],
  },
];

const bottomNavItems: readonly NavItemDef[] = [
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
  accentBadge,
}: {
  label: string;
  href: string;
  icon: React.ElementType;
  isActive: boolean;
  badge?: number;
  accentBadge?: boolean;
}) {
  return (
    <Link href={href} className={`av-nav-item${isActive ? " is-active" : ""}`}>
      <Icon className="h-[17px] w-[17px] shrink-0" aria-hidden="true" />
      {label}
      {typeof badge === "number" && badge > 0 && (
        <span
          className="av-nav-item__count"
          data-accent={accentBadge ? "" : undefined}
          aria-label={`${badge} ${accentBadge ? "running" : "pending"}`}
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
  const liveNotifications = useLiveNotifications();

  // Prefer the live unread count so the bell badge updates without a page load;
  // fall back to the SSR-seeded badge before the stream connects.
  const effectiveBadges: Record<string, number> = liveNotifications
    ? { ...badges, "/notifications": liveNotifications.unreadCount }
    : badges;

  return (
    <aside
      className="flex h-full w-[248px] shrink-0 flex-col overflow-y-auto"
      style={{
        borderRight: "1.5px solid var(--av-bd)",
        background: "var(--av-surface)",
      }}
    >
      {/* Logo / workspace header */}
      <div style={{ borderBottom: "1.5px solid var(--av-bd)" }}>
        <div className="flex items-center gap-[11px] px-[18px] pt-4">
          <Link href="/chat" className="av-logo">
            <span className="av-logo__mark">
              <span />
            </span>
            <span>
              a<span className="v">v</span>ion
            </span>
          </Link>
          <span
            className="ml-auto"
            style={{
              fontFamily: "var(--av-mono)",
              fontSize: 9,
              fontWeight: 500,
              border: "1px solid var(--av-bd)",
              padding: "2px 5px",
              letterSpacing: ".06em",
            }}
          >
            v2
          </span>
        </div>
        <div className="p-3">
          <WorkspaceSwitcher
            workspaces={workspaces}
            activeWorkspaceId={activeWorkspaceId}
          />
        </div>
      </div>

      {/* Navigation — flat, all destinations visible */}
      <nav className="flex flex-1 flex-col gap-0.5 p-3 pt-2">
        {NAV_SECTIONS.map((section, sIdx) => (
          <div key={sIdx} className="flex flex-col gap-0.5">
            {section.label && <div className="av-nav-group">{section.label}</div>}
            {section.items.map(({ label, href, icon }) => (
              <NavItem
                key={href}
                label={label}
                href={href}
                icon={icon}
                isActive={isNavItemActive(pathname, href)}
                badge={effectiveBadges[href]}
                accentBadge={href === "/work/live"}
              />
            ))}
          </div>
        ))}
      </nav>

      {/* Bottom nav */}
      <nav
        className="flex flex-col gap-0.5 p-3"
        style={{ borderTop: "1.5px solid var(--av-bd)" }}
      >
        {bottomNavItems.map(({ label, href, icon }) => (
          <NavItem
            key={href}
            label={label}
            href={href}
            icon={icon}
            isActive={isNavItemActive(pathname, href)}
            badge={effectiveBadges[href]}
          />
        ))}
      </nav>

      {/* Spacer for the user menu (rendered by the app layout) */}
      <div className="h-12" />
    </aside>
  );
}
