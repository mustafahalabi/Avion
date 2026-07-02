import {
  AlertTriangle,
  KeyRound,
  ShieldCheck,
  Terminal,
} from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import type { RepositoryValidationView } from "@/lib/repository-validation-service";
import type {
  EnvironmentProfile,
  RepositoryValidationAssessment,
  ValidationProfile,
} from "@/lib/repository-validation-profile";
import { cn } from "@/lib/utils";

export const REPOSITORY_VALIDATION_ANCHOR = "repository-validation" as const;

interface RepositoryValidationPanelProps {
  readonly assessment: RepositoryValidationView;
}

const READINESS_TONE: Record<
  RepositoryValidationAssessment["readiness"],
  string
> = {
  ready: "border-emerald-900 bg-emerald-950 text-emerald-400",
  partial: "border-amber-900 bg-amber-950 text-amber-400",
  blocked: "border-red-900 bg-red-950 text-red-400",
};

const READINESS_LABEL: Record<
  RepositoryValidationAssessment["readiness"],
  string
> = {
  ready: "Ready — completion gate satisfiable",
  partial: "Partial — gaps before completion gate",
  blocked: "Blocked — cannot verify completion",
};

/**
 * Renders the Repository Validation & Environment panel from a structured view.
 *
 * @param props - Validation view derived from the latest analysis snapshot.
 * @returns Environment profile, validation profile, and readiness gate sections.
 */
export function RepositoryValidationPanel({
  assessment: view,
}: RepositoryValidationPanelProps) {
  const { assessment } = view;
  const { environment, validation } = assessment;

  return (
    <section
      id={REPOSITORY_VALIDATION_ANCHOR}
      className="scroll-mt-20 rounded-xl border border-neutral-800 bg-neutral-950/40"
    >
      <div className="border-b border-neutral-800 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-neutral-100">
              Repository Validation &amp; Environment
            </h3>
            <p className="mt-1 text-xs text-neutral-500">
              Completion-gate readiness derived from analysis: detected checks and
              environment documentation.
            </p>
          </div>
          <ReadinessBadge
            readiness={assessment.readiness}
            analyzedAt={view.analyzedAt}
          />
        </div>
      </div>

      <div className="flex flex-col gap-6 p-4">
        {view.missingData.length > 0 && (
          <NoticeBlock title="Missing or incomplete data">
            {view.missingData.map((item) => (
              <p key={item}>{item}</p>
            ))}
          </NoticeBlock>
        )}

        {(assessment.missing.length > 0 || assessment.unknowns.length > 0) && (
          <div className="grid gap-3 lg:grid-cols-2">
            {assessment.missing.length > 0 && (
              <NoticeBlock title="Gaps blocking a clean completion gate" tone="error">
                {assessment.missing.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </NoticeBlock>
            )}
            {assessment.unknowns.length > 0 && (
              <NoticeBlock title="Unknowns">
                {assessment.unknowns.map((item) => (
                  <p key={item}>{item}</p>
                ))}
              </NoticeBlock>
            )}
          </div>
        )}

        <ValidationSection validation={validation} />
        <EnvironmentSection environment={environment} />
      </div>
    </section>
  );
}

function ValidationSection({ validation }: { validation: ValidationProfile }) {
  return (
    <Panel title="Validation Profile" icon={Terminal}>
      <p className="mb-2 text-xs text-neutral-500">
        Detected profile:{" "}
        <span className="text-neutral-300">{validation.profileName}</span>
      </p>

      <div className="mb-3 flex flex-wrap gap-1.5">
        <CapabilityChip label="lint" present={validation.hasLint} />
        <CapabilityChip label="typecheck" present={validation.hasTypecheck} />
        <CapabilityChip label="test" present={validation.hasTest} />
        <CapabilityChip label="build" present={validation.hasBuild} />
      </div>

      {validation.commands.length > 0 ? (
        <EvidenceList
          title="Detected commands"
          items={validation.commands.map(
            (command) => `${command.command}  —  ${command.script}`
          )}
          mono
        />
      ) : (
        <EmptyLine>
          No lint, typecheck, test, or build scripts detected in the latest
          snapshot.
        </EmptyLine>
      )}

      {validation.profileCommands.length > 0 && (
        <EvidenceList
          title="Worker validation commands"
          items={validation.profileCommands}
          mono
        />
      )}
    </Panel>
  );
}

function EnvironmentSection({
  environment,
}: {
  environment: EnvironmentProfile;
}) {
  return (
    <Panel title="Environment Profile" icon={KeyRound}>
      {!environment.evidenceAvailable ? (
        <EmptyLine>
          Environment requirements are unknown — analysis captured no
          .env.example or referenced environment variables.
        </EmptyLine>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-1.5">
            <CapabilityChip
              label={environment.hasEnvExample ? "documented" : "undocumented"}
              present={environment.documented}
            />
          </div>

          {environment.referencedEnvVars.length > 0 ? (
            <EvidenceList
              title="Referenced variables"
              items={environment.referencedEnvVars.map(
                (reference) =>
                  `${reference.name}${reference.isSecret ? "  (secret)" : ""}`
              )}
              mono
            />
          ) : (
            <EmptyLine>No referenced environment variables captured.</EmptyLine>
          )}

          {environment.documentedKeys.length > 0 && (
            <EvidenceList
              title="Documented keys (.env.example)"
              items={environment.documentedKeys}
              mono
            />
          )}

          {environment.secretReferences.length > 0 && (
            <EvidenceList
              title="Secret references"
              items={environment.secretReferences}
              mono
            />
          )}
        </>
      )}
    </Panel>
  );
}

function ReadinessBadge({
  readiness,
  analyzedAt,
}: {
  readiness: RepositoryValidationAssessment["readiness"];
  analyzedAt: Date | null;
}) {
  return (
    <div
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] font-medium",
        READINESS_TONE[readiness]
      )}
    >
      {READINESS_LABEL[readiness]}
      {analyzedAt ? ` · ${analyzedAt.toLocaleString()}` : ""}
    </div>
  );
}

function CapabilityChip({
  label,
  present,
}: {
  label: string;
  present: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium",
        present
          ? "border-emerald-900 bg-emerald-950/60 text-emerald-300"
          : "border-neutral-700 bg-neutral-950 text-neutral-500"
      )}
    >
      {present ? (
        <ShieldCheck className="h-3 w-3" />
      ) : (
        <AlertTriangle className="h-3 w-3" />
      )}
      {label}
    </span>
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
        <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
          {title}
        </h4>
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
