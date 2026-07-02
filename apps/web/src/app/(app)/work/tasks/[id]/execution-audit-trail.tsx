import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  buildSessionAuditView,
  type AuditEventView,
  type AuditViewSessionInput,
} from "@/lib/worker-audit-log";

/**
 * CEO-facing execution audit trail (MUS-215).
 *
 * Surfaces, per execution session, the chronological record of what the agent
 * did, attempted, and was blocked from doing — commands run, files touched,
 * guardrail blocks, and final outcome. Safety blocks are visually distinct.
 *
 * Reads existing audit data: a serialized worker audit log when present,
 * otherwise a trail derived from the session's recorded facts (no silent gap).
 */
export function ExecutionAuditTrail({
  session,
}: {
  session: AuditViewSessionInput;
}) {
  const view = buildSessionAuditView(session);
  if (view.events.length === 0) {
    return null;
  }

  return (
    <section>
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Execution Audit Trail
        </h3>
        {view.hasSafetyBlock ? (
          <Badge variant="destructive">
            {view.blockedCount} safety block{view.blockedCount === 1 ? "" : "s"}
          </Badge>
        ) : (
          <Badge variant="outline">No blocks</Badge>
        )}
      </div>

      <p className="mt-1 text-[11px] text-neutral-600">
        {view.source === "audit_log"
          ? "From the worker audit log."
          : "Reconstructed from recorded session facts."}
      </p>

      <ol className="mt-3 flex flex-col gap-2">
        {view.events.map((event, index) => (
          <AuditRow key={`${event.type}-${index}`} event={event} />
        ))}
      </ol>
    </section>
  );
}

function AuditRow({ event }: { event: AuditEventView }) {
  return (
    <li
      className={cn(
        "rounded-lg border px-3.5 py-2.5",
        event.isSafetyBlock
          ? "border-danger-800 bg-danger-950/40"
          : "border-neutral-800 bg-neutral-900"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p
          className={cn(
            "text-xs font-medium",
            event.isSafetyBlock ? "text-danger-300" : "text-neutral-200"
          )}
        >
          {event.label}
        </p>
        <Badge variant={severityVariant(event)}>{severityLabel(event)}</Badge>
      </div>
      {event.detail && (
        <p
          className={cn(
            "mt-1 break-words font-mono text-[11px]",
            event.isSafetyBlock ? "text-danger-400" : "text-neutral-500"
          )}
        >
          {event.detail}
        </p>
      )}
    </li>
  );
}

function severityVariant(
  event: AuditEventView
): "destructive" | "warning" | "secondary" {
  if (event.isSafetyBlock || event.severity === "error") return "destructive";
  if (event.severity === "warn") return "warning";
  return "secondary";
}

function severityLabel(event: AuditEventView): string {
  if (event.isSafetyBlock) return "Blocked";
  if (event.severity === "error") return "Error";
  if (event.severity === "warn") return "Warning";
  return "Info";
}
