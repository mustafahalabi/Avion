import { HeartPulse, MoveDownRight, MoveRight, MoveUpRight } from "lucide-react";
import type {
  CompanyHealthViewModel,
  HealthMetricCard,
  HealthTrendDirection,
} from "@/lib/company-health-view-model";

/**
 * Company Health panel for the Control Center (MUS-263).
 *
 * Renders the honest delivery/quality/learning metrics built by
 * `buildCompanyHealthViewModel`: every card shows a raw count or a
 * ratio-with-denominator, a provenance line naming the rows behind the number,
 * and — once two daily snapshots exist — a neutral snapshot-vs-snapshot delta.
 * Trend arrows are descriptive (which way the number moved), deliberately not
 * colored as good/bad.
 */
export function CompanyHealthPanel({ vm }: { vm: CompanyHealthViewModel }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HeartPulse className="h-3.5 w-3.5 text-neutral-400" />
          <h3 className="text-sm font-medium text-neutral-200">
            Company Health
          </h3>
        </div>
        <span className="text-[11px] text-neutral-600">{vm.snapshotNote}</span>
      </div>

      <div className="flex flex-col gap-4">
        {vm.sections.map((section) => (
          <div key={section.id}>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-neutral-500">
              {section.label}
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {section.metrics.map((metric) => (
                <HealthMetricCardView key={metric.id} metric={metric} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

const TREND_ICONS: Record<HealthTrendDirection, React.ReactNode> = {
  up: <MoveUpRight className="h-3 w-3" />,
  down: <MoveDownRight className="h-3 w-3" />,
  flat: <MoveRight className="h-3 w-3" />,
};

function HealthMetricCardView({ metric }: { metric: HealthMetricCard }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
        {metric.label}
      </p>
      <p className="mt-1.5 text-lg font-semibold tabular-nums text-neutral-200">
        {metric.value}
      </p>
      <p className="mt-1 text-[11px] leading-4 text-neutral-500">
        {metric.provenance}
      </p>
      {metric.delta && (
        <p className="mt-1.5 flex items-center gap-1 text-[11px] tabular-nums text-neutral-400">
          {TREND_ICONS[metric.delta.direction]}
          {metric.delta.text}
        </p>
      )}
    </div>
  );
}
