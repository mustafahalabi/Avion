"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Gauge,
  LayoutDashboard,
  Activity,
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
  ChevronDown,
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

// Chat is the CEO's home surface (MUS-305). Everything else is a drill-down for
// power users, tucked behind a collapsed disclosure so the default path is
// near-zero navigation.
const PRIMARY_ITEM: NavItemDef = {
  label: "Chat",
  href: "/chat",
  icon: MessageSquare,
};

const DRILL_DOWN_SECTIONS: NavSection[] = [
  {
    label: "Company",
    items: [
      { label: "Control Center", href: "/control-center", icon: Gauge },
      { label: "Live", href: "/work/live", icon: Radio },
      { label: "Live Board", href: "/board", icon: Activity },
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
}: {
  label: string;
  href: string;
  icon: React.ElementType;
  isActive: boolean;
  badge?: number;
}) {
  return (
    <Link href={href} className={`av-nav-item${isActive ? " is-active" : ""}`}>
      <Icon className="h-[17px] w-[17px] shrink-0" aria-hidden="true" />
      {label}
      {typeof badge === "number" && badge > 0 && (
        <span className="av-nav-item__count" aria-label={`${badge} pending`}>
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

  // Sum of pending badges hidden inside the collapsed drill-down, so the CEO
  // still sees "something needs me" without expanding.
  const drillItems = DRILL_DOWN_SECTIONS.flatMap((s) => s.items);
  const drillBadgeTotal = drillItems.reduce(
    (sum, item) => sum + (effectiveBadges[item.href] ?? 0),
    0
  );
  const anyDrillActive = drillItems.some((item) => isNavItemActive(pathname, item.href));

  // Auto-expand when the CEO has navigated into a drill-down view; otherwise
  // start collapsed for the chat-first default.
  const [expanded, setExpanded] = useState(anyDrillActive);
  const isOpen = expanded || anyDrillActive;

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

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-0.5 p-3 pt-2">
        {/* Chat — the home surface */}
        <NavItem
          label={PRIMARY_ITEM.label}
          href={PRIMARY_ITEM.href}
          icon={PRIMARY_ITEM.icon}
          isActive={isNavItemActive(pathname, PRIMARY_ITEM.href)}
        />

        {/* Collapsible drill-down to the deeper company views */}
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={isOpen}
          className="av-nav-item mt-1 w-full justify-between text-left"
          style={{ opacity: 0.85 }}
        >
          <span className="flex items-center gap-2">
            <Layers className="h-[17px] w-[17px] shrink-0" aria-hidden="true" />
            Company views
          </span>
          <span className="flex items-center gap-1.5">
            {!isOpen && drillBadgeTotal > 0 && (
              <span className="av-nav-item__count" aria-label={`${drillBadgeTotal} pending`}>
                {drillBadgeTotal > 99 ? "99+" : drillBadgeTotal}
              </span>
            )}
            <ChevronDown
              className="h-3.5 w-3.5 shrink-0 transition-transform"
              style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)" }}
              aria-hidden="true"
            />
          </span>
        </button>

        {isOpen && (
          <div className="mt-0.5 flex flex-col gap-0.5">
            {DRILL_DOWN_SECTIONS.map((section, sIdx) => (
              <div key={sIdx} className="flex flex-col gap-0.5">
                {section.label && (
                  <div className="av-nav-group">{section.label}</div>
                )}
                {section.items.map(({ label, href, icon }) => (
                  <NavItem
                    key={href}
                    label={label}
                    href={href}
                    icon={icon}
                    isActive={isNavItemActive(pathname, href)}
                    badge={effectiveBadges[href]}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
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
