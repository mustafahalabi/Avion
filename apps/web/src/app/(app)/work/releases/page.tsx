import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import {
  Rocket,
  CheckCircle2,
  AlertCircle,
  Circle,
  ChevronRight,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; dot: string; icon: React.ElementType }
> = {
  draft: { label: "Draft", color: "text-neutral-500", dot: "bg-neutral-600", icon: Circle },
  ready: { label: "Ready", color: "text-emerald-400", dot: "bg-emerald-500", icon: CheckCircle2 },
  released: { label: "Released", color: "text-emerald-400", dot: "bg-emerald-600", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", color: "text-neutral-700", dot: "bg-neutral-800", icon: Circle },
  blocked: { label: "Blocked", color: "text-red-400", dot: "bg-red-500", icon: AlertCircle },
};

const DEPLOY_STATUS: Record<string, string> = {
  not_started: "Not started",
  in_progress: "Deploying…",
  deployed: "Deployed",
  failed: "Failed",
  rolled_back: "Rolled back",
};

export default async function ReleasesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) redirect("/onboarding");

  const releases = await prisma.release.findMany({
    where: { companyId: company.id },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const stats = {
    total: releases.length,
    ready: releases.filter((r) => r.status === "ready").length,
    released: releases.filter((r) => r.status === "released").length,
    draft: releases.filter((r) => r.status === "draft").length,
  };

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <header className="flex h-12 items-center justify-between border-b border-neutral-800 px-6">
        <div className="flex items-center gap-3">
          <Link
            href="/work"
            className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            Work
          </Link>
          <span className="text-neutral-700">/</span>
          <h1 className="text-sm font-semibold text-neutral-100">Releases</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/work/releases/candidate/new"
            className="inline-flex items-center gap-1.5 border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs font-medium text-neutral-200 transition hover:border-neutral-600"
          >
            <Rocket className="h-3.5 w-3.5" />
            From completed tasks
          </Link>
          <Link
            href="/work/releases/new"
            className="inline-flex items-center gap-1.5 border border-brand-500 bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:brightness-110"
          >
            <Plus className="h-3.5 w-3.5" />
            New release
          </Link>
        </div>
      </header>

      <div className="flex flex-col gap-8 p-6">
        {/* Stats */}
        {releases.length > 0 && (
          <section className="grid grid-cols-4 gap-3">
            <StatCard label="Total" value={stats.total} />
            <StatCard label="Draft" value={stats.draft} />
            <StatCard label="Ready" value={stats.ready} color="text-emerald-400" />
            <StatCard label="Released" value={stats.released} color="text-emerald-600" />
          </section>
        )}

        {/* Release list */}
        {releases.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-neutral-800 py-14 text-center">
            <div className="flex h-10 w-10 items-center justify-center border border-neutral-800 bg-neutral-900">
              <Rocket className="h-5 w-5 text-neutral-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-300">
                No releases yet
              </p>
              <p className="mt-1 text-xs text-neutral-600 max-w-xs">
                Group completed work into a release, verify readiness, and track
                deployment status.
              </p>
            </div>
            <Link
              href="/work/releases/new"
              className="inline-flex items-center gap-1.5 border border-brand-500 bg-brand-500 px-4 py-2 text-xs font-semibold text-white transition hover:brightness-110"
            >
              <Plus className="h-3 w-3" />
              Create first release
            </Link>
          </div>
        ) : (
          <section>
            <div className="flex flex-col gap-2">
              {releases.map((release) => {
                const cfg = STATUS_CONFIG[release.status] ?? STATUS_CONFIG["draft"];
                const Icon = cfg.icon;
                let checklist: { checked: boolean }[] = [];
                try {
                  checklist = JSON.parse(release.checklist);
                } catch {}
                const readyCount = checklist.filter((c) => c.checked).length;

                return (
                  <Link
                    key={release.id}
                    href={`/work/releases/${release.id}`}
                    className="group flex items-center gap-4 rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-4 transition-colors hover:border-neutral-700 hover:bg-neutral-800"
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", cfg.color)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-semibold text-neutral-400 bg-neutral-800 px-1.5 py-0.5 rounded">
                          {release.version}
                        </span>
                        {release.title && (
                          <span className="text-sm font-medium text-neutral-200 truncate">
                            {release.title}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-neutral-600">
                        <span className={cn("font-medium", cfg.color)}>
                          {cfg.label}
                        </span>
                        {checklist.length > 0 && (
                          <span>
                            {" "}· {readyCount}/{checklist.length} checks
                          </span>
                        )}
                        {release.releasedAt && (
                          <span>
                            {" "}· Released{" "}
                            {new Date(release.releasedAt).toLocaleDateString(
                              "en-US",
                              { month: "short", day: "numeric" }
                            )}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {release.deploymentStatus !== "not_started" && (
                        <span className="text-[10px] text-neutral-600">
                          {DEPLOY_STATUS[release.deploymentStatus]}
                        </span>
                      )}
                      <ChevronRight className="h-3.5 w-3.5 text-neutral-700 group-hover:text-neutral-500 transition-colors" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color = "text-neutral-200",
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      <p className={cn("mt-1 text-xl font-semibold tabular-nums", color)}>
        {value}
      </p>
    </div>
  );
}
