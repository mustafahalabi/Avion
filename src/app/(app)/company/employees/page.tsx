import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { EmployeeStatusIndicator } from "@/components/ui/status-indicator";

const DEPT_COLORS: Record<string, string> = {
  executive: "bg-violet-950/50 border-violet-900/50",
  product: "bg-blue-950/50 border-blue-900/50",
  engineering: "bg-emerald-950/50 border-emerald-900/50",
  quality: "bg-amber-950/50 border-amber-900/50",
  operations: "bg-rose-950/50 border-rose-900/50",
};

const DEPT_AVATAR: Record<string, string> = {
  executive: "bg-violet-800 text-violet-200",
  product: "bg-blue-800 text-blue-200",
  engineering: "bg-emerald-800 text-emerald-200",
  quality: "bg-amber-800 text-amber-200",
  operations: "bg-rose-800 text-rose-200",
};

export default async function EmployeesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) redirect("/onboarding");

  const employees = await prisma.employee.findMany({
    where: { companyId: company.id },
    include: {
      department: { select: { name: true, slug: true } },
      role: { select: { name: true } },
      manager: { select: { id: true, name: true } },
    },
    orderBy: [{ department: { name: "asc" } }, { name: "asc" }],
  });

  const grouped = employees.reduce<
    Record<string, typeof employees>
  >((acc, emp) => {
    const key = emp.department?.name ?? "Unassigned";
    if (!acc[key]) acc[key] = [];
    acc[key].push(emp);
    return acc;
  }, {});

  const deptOrder = [
    "Executive",
    "Product",
    "Engineering",
    "Quality",
    "Operations",
    "Unassigned",
  ];
  const sortedGroups = Object.entries(grouped).sort(
    ([a], [b]) =>
      (deptOrder.indexOf(a) === -1 ? 99 : deptOrder.indexOf(a)) -
      (deptOrder.indexOf(b) === -1 ? 99 : deptOrder.indexOf(b))
  );

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <header className="flex h-12 items-center gap-3 border-b border-neutral-800 px-6">
        <Link
          href="/company"
          className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Company
        </Link>
        <span className="text-neutral-700">/</span>
        <h1 className="text-sm font-semibold text-neutral-100">Employees</h1>
        <span className="ml-auto text-xs text-neutral-600">
          {employees.length} total
        </span>
      </header>

      <div className="flex flex-col gap-8 p-6">
        {employees.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-neutral-800 py-16 text-center">
            <Users className="h-6 w-6 text-neutral-600" />
            <div>
              <p className="text-sm font-medium text-neutral-400">
                No employees yet
              </p>
              <p className="mt-0.5 text-xs text-neutral-600">
                Employees are provisioned when a company is created.
              </p>
            </div>
          </div>
        ) : (
          sortedGroups.map(([deptName, deptEmployees]) => {
            const deptSlug =
              deptEmployees[0]?.department?.slug ?? deptName.toLowerCase();
            return (
              <section key={deptName}>
                <div className="mb-3 flex items-center gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    {deptName}
                  </h3>
                  <span className="text-xs text-neutral-700">
                    {deptEmployees.length}
                  </span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {deptEmployees.map((emp) => (
                    <Link
                      key={emp.id}
                      href={`/company/employees/${emp.id}`}
                      className={cn(
                        "group flex items-start gap-3 rounded-lg border p-4 transition-colors hover:brightness-110",
                        DEPT_COLORS[deptSlug] ??
                          "bg-neutral-900/50 border-neutral-800"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                          DEPT_AVATAR[deptSlug] ??
                            "bg-neutral-700 text-neutral-200"
                        )}
                      >
                        {emp.name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-neutral-200 truncate">
                            {emp.name}
                          </p>
                          <EmployeeStatusIndicator
                            status={
                              (["active", "idle", "working", "unavailable"].includes(emp.status)
                                ? emp.status
                                : "idle") as "active" | "idle" | "working" | "unavailable"
                            }
                            showLabel={true}
                            size="xs"
                            className="shrink-0"
                          />
                        </div>
                        <p className="mt-0.5 text-xs text-neutral-500 truncate">
                          {emp.role?.name ?? emp.title ?? "—"}
                        </p>
                        {emp.manager ? (
                          <p className="mt-1 text-[11px] text-neutral-600 truncate">
                            Reports to{" "}
                            <Link
                              href={`/company/employees/${emp.manager.id}`}
                              className="text-neutral-500 hover:text-neutral-300 transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {emp.manager.name}
                            </Link>
                          </p>
                        ) : emp.reportsTo ? (
                          <p className="mt-1 text-[11px] text-neutral-600 truncate">
                            Reports to {emp.reportsTo}
                          </p>
                        ) : null}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
