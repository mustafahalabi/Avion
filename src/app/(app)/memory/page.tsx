import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { BookOpen, Plus, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

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
};

export default async function MemoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    include: {
      memories: {
        include: {
          _count: { select: { records: true } },
        },
        orderBy: { updatedAt: "desc" },
      },
    },
  });

  if (!company) redirect("/onboarding");

  const totalRecords = company.memories.reduce(
    (sum, m) => sum + m._count.records,
    0
  );

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <header className="flex h-12 items-center justify-between border-b border-neutral-800 px-6">
        <h1 className="text-sm font-semibold text-neutral-100">Memory</h1>
        <Link
          href="/memory/new"
          className="flex items-center gap-1.5 rounded-md bg-neutral-800 px-2.5 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-700 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          New memory
        </Link>
      </header>

      <div className="flex flex-col gap-8 p-6">
        {/* Stats */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label="Memories" value={company.memories.length} />
          <StatCard label="Records" value={totalRecords} />
          <StatCard
            label="Categories"
            value={
              new Set(company.memories.map((m) => m.category)).size
            }
          />
        </section>

        {/* Memory list */}
        <section>
          <div className="mb-4 text-sm font-medium text-neutral-200">
            Memory Banks
          </div>

          {company.memories.length === 0 ? (
            <EmptyMemory />
          ) : (
            <div className="grid gap-2">
              {company.memories.map((memory) => {
                const cfg =
                  CATEGORY_CONFIG[memory.category] ??
                  CATEGORY_CONFIG["company"];
                return (
                  <Link
                    key={memory.id}
                    href={`/memory/${memory.id}`}
                    className="group flex items-center gap-3.5 rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3.5 transition-colors hover:border-neutral-700 hover:bg-neutral-800"
                  >
                    <div
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-xs font-bold",
                        cfg.color
                      )}
                    >
                      {cfg.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-200">
                        {memory.title}
                      </p>
                      {memory.summary && (
                        <p className="mt-0.5 text-xs text-neutral-500 line-clamp-1">
                          {memory.summary}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-neutral-600">
                        {memory._count.records}{" "}
                        {memory._count.records === 1 ? "record" : "records"}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-neutral-700 group-hover:text-neutral-500 transition-colors" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums text-neutral-200">
        {value}
      </p>
    </div>
  );
}

function EmptyMemory() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-neutral-800 py-12 text-center">
      <BookOpen className="h-6 w-6 text-neutral-600" />
      <div>
        <p className="text-sm font-medium text-neutral-400">No memories yet</p>
        <p className="mt-0.5 text-xs text-neutral-600">
          Memories are created as your company accumulates knowledge.
        </p>
      </div>
    </div>
  );
}
