import { parseReleaseCandidateMetadata } from "@/lib/release-candidate-service";
import Link from "next/link";
import { ExternalLink } from "lucide-react";

interface Props {
  description: string | null;
}

export function ReleaseCandidateEvidence({ description }: Props) {
  const metadata = parseReleaseCandidateMetadata(description);
  if (!metadata) return null;

  return (
    <section className="flex flex-col gap-6">
      <div>
        <SectionLabel>Release Candidate Tasks</SectionLabel>
        <div className="mt-2 flex flex-col gap-2">
          {metadata.tasks.map((task) => (
            <div
              key={task.taskId}
              className="rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-3"
            >
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={`/work/tasks/${task.taskId}`}
                  className="text-sm font-medium text-neutral-200 hover:text-white transition-colors"
                >
                  {task.title}
                </Link>
                {task.outcomeId && (
                  <Link
                    href={`/work/outcomes/${task.outcomeId}`}
                    className="shrink-0 text-[10px] uppercase tracking-wide text-neutral-600 hover:text-neutral-400"
                  >
                    Outcome
                  </Link>
                )}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-neutral-600">
                {task.branchName && <span>Branch: {task.branchName}</span>}
                {task.prUrl && (
                  <a
                    href={task.prUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-400 hover:text-blue-300"
                  >
                    PR #{task.prNumber ?? "?"}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {task.validationSummary && (
                  <span className="text-neutral-500">{task.validationSummary}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {metadata.validationEvidence.length > 0 && (
        <div>
          <SectionLabel>Validation Evidence</SectionLabel>
          <ul className="mt-2 flex flex-col gap-1">
            {metadata.validationEvidence.map((item, i) => (
              <li key={i} className="text-xs text-neutral-400 leading-relaxed">
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

      {metadata.risks.length > 0 && (
        <div className="rounded-lg border border-amber-900/30 bg-amber-950/10 px-4 py-3">
          <SectionLabel>Risks</SectionLabel>
          <ul className="mt-2 flex flex-col gap-1">
            {metadata.risks.map((risk, i) => (
              <li key={i} className="text-xs text-amber-200 leading-relaxed">
                {risk}
              </li>
            ))}
          </ul>
        </div>
      )}

      {metadata.openIssues.length > 0 && (
        <div className="rounded-lg border border-red-900/30 bg-red-950/10 px-4 py-3">
          <SectionLabel>Open Issues</SectionLabel>
          <ul className="mt-2 flex flex-col gap-1">
            {metadata.openIssues.map((issue, i) => (
              <li key={i} className="text-xs text-red-200 leading-relaxed">
                {issue}
              </li>
            ))}
          </ul>
        </div>
      )}

      {metadata.rejectedTasks.length > 0 && (
        <div>
          <SectionLabel>Skipped Tasks</SectionLabel>
          <ul className="mt-2 flex flex-col gap-1">
            {metadata.rejectedTasks.map((r) => (
              <li key={r.taskId} className="text-xs text-neutral-500">
                {r.taskId}: {r.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
      {children}
    </h3>
  );
}
