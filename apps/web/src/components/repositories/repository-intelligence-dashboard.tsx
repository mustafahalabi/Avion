import {
  AlertTriangle,
  Database,
  FolderTree,
  GitBranch,
  Layers,
  Package,
  Route,
  Terminal,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import type { RepositoryIntelligenceView } from "@/lib/repository-intelligence-view";
import { REPOSITORY_INTELLIGENCE_ANCHOR } from "@/lib/repository-intelligence-view";
import { cn } from "@/lib/utils";

interface RepositoryIntelligenceDashboardProps {
  readonly intelligence: RepositoryIntelligenceView;
}

/**
 * Renders the repository intelligence dashboard from a structured analysis view.
 *
 * @param props - Parsed repository intelligence payload.
 * @returns Dashboard sections for file tree, manifests, routing, database, and risks.
 */
export function RepositoryIntelligenceDashboard({
  intelligence,
}: RepositoryIntelligenceDashboardProps) {
  return (
    <section
      id={REPOSITORY_INTELLIGENCE_ANCHOR}
      className="scroll-mt-20 rounded-xl border border-neutral-800 bg-neutral-950/40"
    >
      <div className="border-b border-neutral-800 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-neutral-100">Repository Intelligence</h3>
            <p className="mt-1 text-xs text-neutral-500">
              Structured analysis output for planning, task briefs, and review.
            </p>
          </div>
          <AnalysisStatusBadge
            status={intelligence.snapshotStatus ?? "pending"}
            analyzedAt={intelligence.analyzedAt}
          />
        </div>
      </div>

      <div className="flex flex-col gap-6 p-4">
        {(intelligence.missingData.length > 0 || intelligence.unknowns.length > 0) && (
          <NoticeBlock title="Missing or incomplete data">
            {[...intelligence.missingData, ...intelligence.unknowns].map((item) => (
              <p key={item}>{item}</p>
            ))}
          </NoticeBlock>
        )}

        {intelligence.snapshotError && (
          <NoticeBlock title="Latest analysis failed" tone="error">
            <p>{intelligence.snapshotError}</p>
          </NoticeBlock>
        )}

        <DashboardGrid
          items={[
            {
              icon: FolderTree,
              label: "File Tree",
              value:
                intelligence.fileTree.totalFiles !== null
                  ? `${intelligence.fileTree.totalFiles} files · ${intelligence.fileTree.totalDirs ?? 0} dirs`
                  : "Unavailable",
            },
            {
              icon: Package,
              label: "Package Manager",
              value: intelligence.packageManager.name ?? "Unknown",
            },
            {
              icon: Layers,
              label: "Frameworks",
              value:
                intelligence.frameworks.length > 0
                  ? intelligence.frameworks.join(", ")
                  : "Not detected",
            },
            {
              icon: Database,
              label: "Database Layer",
              value: intelligence.databaseLayer.technology ?? "Not detected",
            },
          ]}
        />

        <Panel title="File Tree Summary" icon={FolderTree}>
          {intelligence.fileTree.topLevelDirs.length > 0 ? (
            <TagList tags={intelligence.fileTree.topLevelDirs} prefix="Top-level:" />
          ) : (
            <EmptyLine>No top-level directories captured.</EmptyLine>
          )}
          {Object.keys(intelligence.fileTree.byExtension).length > 0 && (
            <FileTypeBreakdown byExtension={intelligence.fileTree.byExtension} />
          )}
          {intelligence.fileTree.importantPaths.length > 0 && (
            <EvidenceList
              title="Important paths"
              items={intelligence.fileTree.importantPaths}
              mono
            />
          )}
        </Panel>

        <Panel title="Package Manager & Scripts" icon={Terminal}>
          {intelligence.packageManager.evidence && (
            <EmptyLine>{intelligence.packageManager.evidence}</EmptyLine>
          )}
          {intelligence.scripts ? (
            <EvidenceList
              items={[
                intelligence.scripts.lint ? `lint: ${intelligence.scripts.lint}` : null,
                intelligence.scripts.build ? `build: ${intelligence.scripts.build}` : null,
                intelligence.scripts.test ? `test: ${intelligence.scripts.test}` : null,
                intelligence.scripts.typecheck
                  ? `typecheck: ${intelligence.scripts.typecheck}`
                  : null,
              ].filter((item): item is string => item !== null)}
            />
          ) : (
            <EmptyLine>Scripts not available in latest snapshot.</EmptyLine>
          )}
        </Panel>

        <Panel title="Routes & API Surface" icon={Route}>
          {intelligence.apiSurface.pages.length > 0 && (
            <EvidenceList
              title="Pages"
              items={intelligence.apiSurface.pages.map(
                (route) => `${route.path} — ${route.evidence}`
              )}
              mono
            />
          )}
          {intelligence.apiSurface.apiRoutes.length > 0 && (
            <EvidenceList
              title="API routes"
              items={intelligence.apiSurface.apiRoutes.map(
                (route) => `${route.path} — ${route.evidence}`
              )}
              mono
            />
          )}
          {intelligence.apiSurface.serverActions.length > 0 && (
            <EvidenceList
              title="Server actions"
              items={intelligence.apiSurface.serverActions}
              mono
            />
          )}
          {intelligence.apiSurface.unknowns.map((item) => (
            <EmptyLine key={item}>{item}</EmptyLine>
          ))}
        </Panel>

        <Panel title="Database Layer" icon={Database}>
          {intelligence.databaseLayer.schemaPaths.length > 0 && (
            <EvidenceList title="Schema paths" items={intelligence.databaseLayer.schemaPaths} mono />
          )}
          {intelligence.databaseLayer.models.length > 0 && (
            <TagList tags={intelligence.databaseLayer.models} prefix="Models:" />
          )}
          {intelligence.databaseLayer.unknowns.map((item) => (
            <EmptyLine key={item}>{item}</EmptyLine>
          ))}
        </Panel>

        <Panel title="Risks & Evidence" icon={AlertTriangle}>
          {intelligence.risks.length > 0 ? (
            <div className="flex flex-col gap-2">
              {intelligence.risks.map((risk) => (
                <div
                  key={`${risk.category}-${risk.description}`}
                  className="rounded-md border border-neutral-800 bg-neutral-900/60 px-3 py-2"
                >
                  <p className="text-xs font-medium text-neutral-200">
                    [{risk.severity}] {risk.description}
                  </p>
                  <p className="mt-1 text-xs text-neutral-500">Evidence: {risk.evidence}</p>
                  <p className="mt-1 text-xs text-neutral-500">Mitigation: {risk.mitigation}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyLine>No risks recorded in latest snapshot.</EmptyLine>
          )}
        </Panel>

        {intelligence.analysisSummary && (
          <Panel title="Analysis Summary" icon={GitBranch}>
            <p className="text-sm leading-relaxed text-neutral-400">{intelligence.analysisSummary}</p>
          </Panel>
        )}
      </div>
    </section>
  );
}

function AnalysisStatusBadge({
  status,
  analyzedAt,
}: {
  status: string;
  analyzedAt: Date | null;
}) {
  const tone =
    status === "completed" || status === "complete"
      ? "border-emerald-900 bg-emerald-950 text-emerald-400"
      : status === "failed"
        ? "border-red-900 bg-red-950 text-red-400"
        : "border-neutral-700 bg-neutral-900 text-neutral-400";

  return (
    <div className={cn("rounded-full border px-2.5 py-1 text-[11px] font-medium", tone)}>
      {status}
      {analyzedAt ? ` · ${analyzedAt.toLocaleString()}` : ""}
    </div>
  );
}

function DashboardGrid({
  items,
}: {
  items: ReadonlyArray<{
    icon: ComponentType<{ className?: string }>;
    label: string;
    value: string;
  }>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-lg border border-neutral-800 bg-neutral-900/70 px-3.5 py-3"
        >
          <div className="flex items-center gap-2 text-neutral-500">
            <item.icon className="h-3.5 w-3.5" />
            <p className="text-[11px] font-semibold uppercase tracking-wide">{item.label}</p>
          </div>
          <p className="mt-2 text-sm font-medium text-neutral-200">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

function Panel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-4 w-4 text-neutral-500" />
        <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">{title}</h4>
      </div>
      {children}
    </div>
  );
}

function EvidenceList({
  title,
  items,
  mono = false,
}: {
  title?: string;
  items: readonly string[];
  mono?: boolean;
}) {
  return (
    <div className="mt-2">
      {title && (
        <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-neutral-600">
          {title}
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        {items.map((item) => (
          <div
            key={item}
            className={cn(
              "rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-neutral-400",
              mono && "font-mono"
            )}
          >
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function FileTypeBreakdown({
  byExtension,
}: {
  byExtension: Record<string, number>;
}) {
  const entries = Object.entries(byExtension).sort((a, b) => b[1] - a[1]);
  return (
    <div className="mt-3">
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-neutral-600">
        Files by type
      </p>
      <div className="flex flex-wrap gap-1.5">
        {entries.map(([extension, count]) => (
          <span
            key={extension}
            className="inline-flex items-center gap-1.5 rounded-md border border-neutral-800 bg-neutral-950 py-1 pl-2 pr-1"
          >
            <span className="font-mono text-xs text-neutral-300">{extension}</span>
            <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-neutral-400">
              {count}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

function TagList({ tags, prefix }: { tags: readonly string[]; prefix: string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <span className="text-xs text-neutral-500">{prefix}</span>
      {tags.map((tag) => (
        <span
          key={tag}
          className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-neutral-300"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

function NoticeBlock({
  title,
  tone = "warning",
  children,
}: {
  title: string;
  tone?: "warning" | "error";
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3 text-xs leading-relaxed",
        tone === "warning" && "border-amber-900 bg-amber-950/30 text-amber-200",
        tone === "error" && "border-red-900 bg-red-950/30 text-red-200"
      )}
    >
      <p className="font-medium">{title}</p>
      <div className="mt-1 space-y-1 opacity-90">{children}</div>
    </div>
  );
}

function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="text-xs text-neutral-500">{children}</p>;
}
