import Link from "next/link";
import type { ReactNode } from "react";
import { ExternalLink, GitBranch } from "lucide-react";

import type { RepositoryTaskContext } from "@/lib/repository-task-context";

interface TaskRepositoryContextPanelProps {
  readonly context: RepositoryTaskContext;
}

/**
 * Displays repository-safe implementation context on the task detail page.
 *
 * @param props - Resolved repository task context.
 * @returns Repository metadata, validation commands, and warnings.
 */
export function TaskRepositoryContextPanel({
  context,
}: TaskRepositoryContextPanelProps) {
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
        Repository Context
      </h3>
      <div className="mt-3 flex flex-col gap-3 rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-3">
        {context.warnings.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {context.warnings.map((warning) => (
              <li key={warning} className="text-xs text-amber-400/90">
                {warning}
              </li>
            ))}
          </ul>
        )}

        <dl className="grid gap-2 text-xs">
          <ContextRow label="Repository" value={context.repositoryName ?? "Not attached"} />
          {context.repositoryUrl && (
            <ContextRow
              label="URL"
              value={
                <a
                  href={context.repositoryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-neutral-300 hover:text-neutral-100"
                >
                  {context.repositoryUrl}
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              }
            />
          )}
          <ContextRow
            label="Branch"
            value={
              <span className="inline-flex items-center gap-1 font-mono text-neutral-200">
                <GitBranch className="h-3 w-3 text-neutral-500" />
                {context.intendedBranch}
                <span className="text-neutral-600">from {context.baseBranch}</span>
              </span>
            }
          />
          <ContextRow
            label="Analysis"
            value={context.analysisStatus ?? "unknown"}
          />
        </dl>

        {context.validationCommands.length > 0 && (
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
              Validation Commands
            </p>
            <ul className="mt-1.5 flex flex-col gap-1">
              {context.validationCommands.map((command) => (
                <li key={command} className="font-mono text-[11px] text-neutral-400">
                  {command}
                </li>
              ))}
            </ul>
          </div>
        )}

        {context.intelligenceDashboardUrl && (
          <Link
            href={context.intelligenceDashboardUrl}
            className="text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            View repository intelligence →
          </Link>
        )}
      </div>
    </section>
  );
}

function ContextRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
      <dt className="w-24 shrink-0 text-neutral-500">{label}</dt>
      <dd className="min-w-0 text-neutral-300">{value}</dd>
    </div>
  );
}
