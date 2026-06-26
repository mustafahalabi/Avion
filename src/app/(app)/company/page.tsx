import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Building2, Users, Layers, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const AUTONOMY_LABELS: Record<string, string> = {
  full: "Full Autonomy",
  assist: "Assisted",
  review: "Review Required",
  manual: "Manual Approval",
};

const CULTURE_LABELS: Record<string, string> = {
  startup: "Startup",
  scaleup: "Scale-up",
  enterprise: "Enterprise",
  research: "Research",
};

const DEPARTMENT_ICONS: Record<string, string> = {
  executive: "E",
  product: "P",
  engineering: "En",
  quality: "Q",
  operations: "Op",
};

const DEPARTMENT_COLORS: Record<string, string> = {
  executive: "bg-violet-950 text-violet-300 border-violet-900",
  product: "bg-blue-950 text-blue-300 border-blue-900",
  engineering: "bg-emerald-950 text-emerald-300 border-emerald-900",
  quality: "bg-amber-950 text-amber-300 border-amber-900",
  operations: "bg-rose-950 text-rose-300 border-rose-900",
};

export default async function CompanyPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const userId = session.user.id;

  const company = await prisma.company.findFirst({
    where: { ownerId: userId },
    include: {
      settings: true,
      departments: {
        include: {
          _count: { select: { employees: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      _count: {
        select: { employees: true },
      },
    },
  });

  if (!company) redirect("/onboarding");

  const autonomyLabel =
    AUTONOMY_LABELS[company.settings?.autonomyLevel ?? ""] ?? "Not configured";
  const cultureLabel =
    CULTURE_LABELS[company.settings?.cultureProfile ?? ""] ?? "Not configured";

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <header className="flex h-12 items-center justify-between border-b border-neutral-800 px-6">
        <h1 className="text-sm font-semibold text-neutral-100">Company</h1>
      </header>

      <div className="flex flex-col gap-8 p-6">
        {/* Company identity */}
        <section>
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-neutral-700 bg-neutral-800">
              <Building2 className="h-5 w-5 text-neutral-300" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-neutral-100 truncate">
                {company.name}
              </h2>
              <p className="mt-0.5 text-sm text-neutral-500">
                Your Engineering OS company
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              label="Employees"
              value={company._count.employees}
              icon={<Users className="h-3.5 w-3.5" />}
            />
            <StatCard
              label="Departments"
              value={company.departments.length}
              icon={<Layers className="h-3.5 w-3.5" />}
            />
            <StatCard label="Autonomy" value={autonomyLabel} />
            <StatCard label="Culture" value={cultureLabel} />
          </div>
        </section>

        {/* Departments */}
        {/* Quick links */}
        <section className="flex flex-wrap gap-2">
          <Link
            href="/company/employees"
            className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-2.5 text-sm text-neutral-300 hover:border-neutral-700 hover:bg-neutral-800 transition-colors"
          >
            <Users className="h-4 w-4 text-neutral-500" />
            View all employees
          </Link>
        </section>

        {/* Departments */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-medium text-neutral-200">
              Departments
            </h3>
            <span className="text-xs text-neutral-600">
              {company.departments.length} total
            </span>
          </div>

          {company.departments.length === 0 ? (
            <EmptyDepartments />
          ) : (
            <div className="grid gap-2">
              {company.departments.map((dept) => (
                <DepartmentRow
                  key={dept.id}
                  name={dept.name}
                  slug={dept.slug}
                  description={dept.description ?? undefined}
                  employeeCount={dept._count.employees}
                  icon={DEPARTMENT_ICONS[dept.slug] ?? dept.name[0]}
                  colorClass={
                    DEPARTMENT_COLORS[dept.slug] ??
                    "bg-neutral-900 text-neutral-300 border-neutral-800"
                  }
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-3">
      <div className="flex items-center gap-1.5 text-neutral-500">
        {icon}
        <span className="text-[11px] font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="mt-1.5 text-sm font-semibold text-neutral-200 truncate">
        {typeof value === "number" ? value.toString() : value}
      </p>
    </div>
  );
}

function DepartmentRow({
  name,
  slug,
  description,
  employeeCount,
  icon,
  colorClass,
}: {
  name: string;
  slug: string;
  description?: string;
  employeeCount: number;
  icon: string;
  colorClass: string;
}) {
  return (
    <Link
      href={`/company/departments/${slug}`}
      className="group flex items-center gap-3.5 rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3 transition-colors hover:border-neutral-700 hover:bg-neutral-800"
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-xs font-bold",
          colorClass
        )}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-neutral-200">{name}</p>
        {description && (
          <p className="mt-0.5 text-xs text-neutral-500 line-clamp-1">
            {description}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="flex items-center gap-1 text-xs text-neutral-500">
          <Users className="h-3 w-3" />
          {employeeCount}
        </span>
        <ChevronRight className="h-3.5 w-3.5 text-neutral-700 transition-colors group-hover:text-neutral-500" />
      </div>
    </Link>
  );
}

function EmptyDepartments() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-neutral-800 py-10 text-center">
      <Layers className="h-6 w-6 text-neutral-600" />
      <div>
        <p className="text-sm font-medium text-neutral-400">
          No departments yet
        </p>
        <p className="mt-0.5 text-xs text-neutral-600">
          Departments are provisioned when you create a company.
        </p>
      </div>
    </div>
  );
}
