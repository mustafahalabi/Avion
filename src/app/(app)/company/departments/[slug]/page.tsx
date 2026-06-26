import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";
import Link from "next/link";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function DepartmentPage({ params }: Props) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const company = await prisma.company.findFirst({
    where: { ownerId: session.user.id },
    select: { id: true },
  });
  if (!company) redirect("/onboarding");

  const department = await prisma.department.findUnique({
    where: { companyId_slug: { companyId: company.id, slug } },
    include: {
      employees: {
        include: { role: true },
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { employees: true } },
    },
  });

  if (!department) notFound();

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
        <h1 className="text-sm font-semibold text-neutral-100">
          {department.name}
        </h1>
      </header>

      <div className="flex flex-col gap-8 p-6">
        {/* Department header */}
        <section>
          <h2 className="text-base font-semibold text-neutral-100">
            {department.name}
          </h2>
          {department.description && (
            <p className="mt-1.5 text-sm text-neutral-400 max-w-2xl">
              {department.description}
            </p>
          )}
          <div className="mt-3 flex items-center gap-1.5 text-xs text-neutral-500">
            <Users className="h-3.5 w-3.5" />
            {department._count.employees === 0
              ? "No employees"
              : `${department._count.employees} employee${department._count.employees === 1 ? "" : "s"}`}
          </div>
        </section>

        {/* Employees */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-medium text-neutral-200">Employees</h3>
          </div>

          {department.employees.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-neutral-800 py-10 text-center">
              <Users className="h-6 w-6 text-neutral-600" />
              <div>
                <p className="text-sm font-medium text-neutral-400">
                  No employees yet
                </p>
                <p className="mt-0.5 text-xs text-neutral-600">
                  AI employees will appear here once the Employee System is
                  active.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-2">
              {department.employees.map((emp) => (
                <div
                  key={emp.id}
                  className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-700 text-xs font-medium text-neutral-200">
                    {emp.title?.[0] ?? "E"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-200">
                      {emp.title ?? "Unnamed Employee"}
                    </p>
                    {emp.role && (
                      <p className="text-xs text-neutral-500">{emp.role.name}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
