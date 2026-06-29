import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, BookOpen } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { AddRecordForm } from "./add-record-form";

interface Props {
  params: Promise<{ id: string }>;
}

const CATEGORY_CONFIG: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  company: {
    label: "Company",
    color: "bg-violet-950/50 border-violet-900/50 text-violet-400",
    icon: "C",
  },
  architecture: {
    label: "Architecture",
    color: "bg-blue-950/50 border-blue-900/50 text-blue-400",
    icon: "A",
  },
  product: {
    label: "Product",
    color: "bg-emerald-950/50 border-emerald-900/50 text-emerald-400",
    icon: "P",
  },
  security: {
    label: "Security",
    color: "bg-red-950/50 border-red-900/50 text-red-400",
    icon: "S",
  },
  operations: {
    label: "Operations",
    color: "bg-amber-950/50 border-amber-900/50 text-amber-400",
    icon: "O",
  },
  employee: {
    label: "Employee",
    color: "bg-neutral-900 border-neutral-700 text-neutral-400",
    icon: "E",
  },
  feature: {
    label: "Feature",
    color: "bg-teal-950/50 border-teal-900/50 text-teal-400",
    icon: "F",
  },
  decision: {
    label: "Decision",
    color: "bg-orange-950/50 border-orange-900/50 text-orange-400",
    icon: "D",
  },
  standards: {
    label: "Standards",
    color: "bg-emerald-950/50 border-emerald-900/50 text-emerald-400",
    icon: "★",
  },
  learnings: {
    label: "Learnings",
    color: "bg-amber-950/50 border-amber-900/50 text-amber-400",
    icon: "L",
  },
  review: {
    label: "Review",
    color: "bg-blue-950/50 border-blue-900/50 text-blue-400",
    icon: "R",
  },
  qa: {
    label: "QA",
    color: "bg-purple-950/50 border-purple-900/50 text-purple-400",
    icon: "Q",
  },
  release: {
    label: "Release",
    color: "bg-teal-950/50 border-teal-900/50 text-teal-400",
    icon: "R",
  },
};

/**
 * Renders a human-friendly provenance label for an auto-captured memory record.
 *
 * @param source - The MemoryRecord.source (e.g. "review:abc", "learning:..."), or null.
 * @returns A readable provenance string.
 */
function formatRecordSource(source: string): string {
  const kind = source.split(":")[0];
  const labels: Record<string, string> = {
    review: "Auto-captured from a review",
    qa: "Auto-captured from QA",
    release: "Auto-captured from a release",
    learning: "Promoted standard (learned)",
  };
  return labels[kind] ?? `Source: ${source}`;
}

export default async function MemoryDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) redirect("/onboarding");

  const memory = await prisma.memory.findFirst({
    where: { id, companyId: company.id },
    include: {
      records: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!memory) notFound();

  const cfg = CATEGORY_CONFIG[memory.category] ?? CATEGORY_CONFIG["company"];

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <header className="flex h-12 items-center gap-3 border-b border-neutral-800 px-6">
        <Link
          href="/memory"
          className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Memory
        </Link>
        <span className="text-neutral-700">/</span>
        <h1 className="text-sm font-semibold text-neutral-100 truncate">
          {memory.title}
        </h1>
      </header>

      <div className="flex flex-col gap-8 p-6 max-w-3xl">
        {/* Header */}
        <section className="flex items-start gap-4">
          <div
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border text-lg font-bold",
              cfg.color
            )}
          >
            {cfg.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-neutral-100">
                {memory.title}
              </h2>
              <span className="rounded-full border border-neutral-700 bg-neutral-900 px-2 py-0.5 text-[10px] font-medium text-neutral-400">
                {cfg.label}
              </span>
            </div>
            {memory.summary && (
              <p className="mt-1 text-sm text-neutral-400">{memory.summary}</p>
            )}
            <p className="mt-1.5 text-xs text-neutral-600">
              {memory.records.length}{" "}
              {memory.records.length === 1 ? "record" : "records"}
            </p>
          </div>
        </section>

        {/* Records */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-medium text-neutral-200">Records</h3>
          </div>

          {memory.records.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-neutral-800 py-10 text-center">
              <BookOpen className="h-5 w-5 text-neutral-600" />
              <div>
                <p className="text-sm font-medium text-neutral-500">
                  No records yet
                </p>
                <p className="mt-0.5 text-xs text-neutral-700">
                  Add a record to capture a piece of knowledge.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {memory.records.map((record) => (
                <div
                  key={record.id}
                  className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3.5"
                >
                  <p className="text-sm text-neutral-200 leading-relaxed whitespace-pre-wrap">
                    {record.content}
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    {record.source && (
                      <span className="text-[11px] text-neutral-600">
                        {formatRecordSource(record.source)}
                      </span>
                    )}
                    <span className="text-[11px] text-neutral-700">
                      Confidence: {Math.round(record.confidence * 100)}%
                    </span>
                    <span className="ml-auto text-[11px] text-neutral-700">
                      {new Date(record.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add record */}
          <div className="mt-4">
            <AddRecordForm memoryId={memory.id} />
          </div>
        </section>
      </div>
    </div>
  );
}
