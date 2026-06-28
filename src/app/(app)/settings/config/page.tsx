import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ExternalLink } from "lucide-react";

export const metadata = { title: "Config Inventory" };

// ─── Label helpers ─────────────────────────────────────────────────────────────

const AUTONOMY_LABELS: Record<string, string> = {
  manual: "Manual",
  assist: "Assist",
  delegate: "Delegate",
  autonomous: "Autonomous",
};

const CULTURE_LABELS: Record<string, string> = {
  startup: "Startup",
  enterprise: "Enterprise",
  "design-first": "Design First",
  "performance-first": "Performance First",
};

const PROVIDER_NAMES: Record<string, string> = {
  github: "GitHub",
  linear: "Linear",
  vercel: "Vercel",
};

const STATUS_STYLES: Record<string, { dot: string; text: string; label: string }> = {
  connected: { dot: "bg-emerald-500", text: "text-emerald-400", label: "Connected" },
  disconnected: { dot: "bg-neutral-600", text: "text-neutral-500", label: "Not connected" },
  error: { dot: "bg-red-500", text: "text-red-400", label: "Error" },
  expired: { dot: "bg-amber-500", text: "text-amber-400", label: "Token expired" },
  needs_reauth: { dot: "bg-amber-500", text: "text-amber-400", label: "Needs attention" },
  revoked: { dot: "bg-red-500", text: "text-red-400", label: "Revoked" },
};

const ANALYSIS_STYLES: Record<string, { dot: string; text: string; label: string }> = {
  pending: { dot: "bg-neutral-600", text: "text-neutral-500", label: "Pending" },
  running: { dot: "bg-blue-500", text: "text-blue-400", label: "Running" },
  completed: { dot: "bg-emerald-500", text: "text-emerald-400", label: "Analysed" },
  failed: { dot: "bg-red-500", text: "text-red-400", label: "Failed" },
  stale: { dot: "bg-amber-500", text: "text-amber-400", label: "Stale" },
};

// ─── Sub-components ────────────────────────────────────────────────────────────

function SectionCard({
  title,
  editHref,
  editLabel,
  children,
}: {
  title: string;
  editHref?: string;
  editLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          {title}
        </h2>
        {editHref && (
          <Link
            href={editHref}
            className="flex items-center gap-1 text-[11px] text-neutral-600 transition-colors hover:text-neutral-400"
          >
            {editLabel ?? "Edit"}
            <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>
      <div className="rounded-xl border border-neutral-800 bg-neutral-900 divide-y divide-neutral-800">
        {children}
      </div>
    </section>
  );
}

function ConfigRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-3.5">
      <p className="text-xs text-neutral-500 shrink-0">{label}</p>
      <div className={cn("text-right text-sm text-neutral-200", mono && "font-mono text-xs")}>
        {value}
      </div>
    </div>
  );
}

function StatusDot({
  status,
  map,
}: {
  status: string;
  map: Record<string, { dot: string; text: string; label: string }>;
}) {
  const cfg = map[status] ?? { dot: "bg-neutral-600", text: "text-neutral-500", label: status };
  return (
    <span className="flex items-center justify-end gap-1.5">
      <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
      <span className={cn("text-xs", cfg.text)}>{cfg.label}</span>
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ConfigInventoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    include: {
      settings: true,
      providerConnections: {
        where: { userId: null },
        orderBy: { provider: "asc" },
      },
      workspaces: {
        include: {
          repositories: {
            select: {
              id: true,
              name: true,
              url: true,
              primaryLanguage: true,
              analysisStatus: true,
            },
          },
        },
      },
    },
  });

  if (!company) redirect("/sign-in");

  const settings = company.settings;
  const connections = company.providerConnections;
  const allRepos = company.workspaces.flatMap((w) => w.repositories);

  const knownProviders = ["github", "linear", "vercel"] as const;

  // Build a map of provider → connection (or undefined if not set up)
  const connectionMap = Object.fromEntries(
    connections.map((c) => [c.provider, c])
  );

  const repoCount = allRepos.length;
  const analysedCount = allRepos.filter((r) => r.analysisStatus === "completed").length;

  const nextVersion = "16.2.9";
  const nodeEnv = process.env.NODE_ENV ?? "—";

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <header className="flex h-12 items-center justify-between border-b border-neutral-800 px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/settings"
            className="text-xs text-neutral-600 transition-colors hover:text-neutral-400"
          >
            Settings
          </Link>
          <span className="text-neutral-700">/</span>
          <h1 className="text-sm font-semibold text-neutral-100">Config Inventory</h1>
        </div>
      </header>

      <div className="mx-auto w-full max-w-2xl p-6 flex flex-col gap-8">

        {/* ── 1. Company Configuration ─────────────────────────────────── */}
        <SectionCard title="Company Configuration" editHref="/settings" editLabel="Edit settings">
          <ConfigRow label="Company name" value={company.name} />
          <ConfigRow
            label="Autonomy level"
            value={
              AUTONOMY_LABELS[settings?.autonomyLevel ?? "assist"] ??
              settings?.autonomyLevel ??
              "—"
            }
          />
          <ConfigRow
            label="Culture profile"
            value={
              CULTURE_LABELS[settings?.cultureProfile ?? "startup"] ??
              settings?.cultureProfile ??
              "—"
            }
          />
          <ConfigRow label="Timezone" value={settings?.timezone ?? "UTC"} mono />
          <ConfigRow label="Locale" value={settings?.locale ?? "en"} mono />
          <ConfigRow label="Currency" value={settings?.currency ?? "USD"} mono />
        </SectionCard>

        {/* ── 2. Integration Status ─────────────────────────────────────── */}
        <SectionCard title="Integration Status" editHref="/integrations" editLabel="Manage">
          {knownProviders.map((provider) => {
            const conn = connectionMap[provider];
            const status = conn?.status ?? "disconnected";
            return (
              <ConfigRow
                key={provider}
                label={PROVIDER_NAMES[provider] ?? provider}
                value={<StatusDot status={status} map={STATUS_STYLES} />}
              />
            );
          })}
          {connections
            .filter(
              (c) =>
                !knownProviders.includes(c.provider as (typeof knownProviders)[number])
            )
            .map((c) => (
              <ConfigRow
                key={c.provider}
                label={c.provider}
                value={<StatusDot status={c.status} map={STATUS_STYLES} />}
              />
            ))}
        </SectionCard>

        {/* ── 3. Repository Configuration ───────────────────────────────── */}
        <SectionCard title="Repository Configuration" editHref="/repositories" editLabel="Manage">
          <ConfigRow label="Connected repositories" value={String(repoCount)} />
          <ConfigRow
            label="Analysed"
            value={repoCount === 0 ? "—" : `${analysedCount} / ${repoCount}`}
          />
          {allRepos.map((repo) => (
            <div
              key={repo.id}
              className="flex items-center justify-between gap-4 px-5 py-3"
            >
              <div className="min-w-0">
                <p className="text-xs font-medium text-neutral-300 truncate">{repo.name}</p>
                {repo.primaryLanguage && (
                  <p className="text-[11px] text-neutral-600">{repo.primaryLanguage}</p>
                )}
              </div>
              <StatusDot status={repo.analysisStatus} map={ANALYSIS_STYLES} />
            </div>
          ))}
          {repoCount === 0 && (
            <div className="px-5 py-4">
              <p className="text-xs text-neutral-600">No repositories connected yet.</p>
            </div>
          )}
        </SectionCard>

        {/* ── 4. Environment ────────────────────────────────────────────── */}
        <SectionCard title="Environment">
          <ConfigRow label="Next.js version" value={nextVersion} mono />
          <ConfigRow label="NODE_ENV" value={nodeEnv} mono />
          <ConfigRow label="Runtime" value="Node.js" mono />
        </SectionCard>

      </div>
    </div>
  );
}
