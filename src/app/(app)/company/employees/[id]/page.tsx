import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, Building2, Shield, Users } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Props {
  params: Promise<{ id: string }>;
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-950 text-emerald-400 border-emerald-900",
  planned: "bg-neutral-900 text-neutral-500 border-neutral-700",
  unavailable: "bg-amber-950 text-amber-400 border-amber-900",
  retired: "bg-neutral-900 text-neutral-600 border-neutral-800",
};

const DEPT_AVATAR: Record<string, string> = {
  executive: "bg-violet-800 text-violet-200",
  product: "bg-blue-800 text-blue-200",
  engineering: "bg-emerald-800 text-emerald-200",
  quality: "bg-amber-800 text-amber-200",
  operations: "bg-rose-800 text-rose-200",
};

export default async function EmployeeDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    select: { id: true },
  });
  if (!company) redirect("/onboarding");

  const employee = await prisma.employee.findFirst({
    where: { id, companyId: company.id },
    include: {
      department: { select: { id: true, name: true, slug: true } },
      role: { select: { name: true, level: true } },
    },
  });

  if (!employee) notFound();

  const deptSlug = employee.department?.slug ?? "";
  const avatarClass =
    DEPT_AVATAR[deptSlug] ?? "bg-neutral-700 text-neutral-200";

  const colleagues = employee.departmentId
    ? await prisma.employee.findMany({
        where: {
          companyId: company.id,
          departmentId: employee.departmentId,
          id: { not: employee.id },
          status: "active",
        },
        select: { id: true, name: true, role: { select: { name: true } } },
        take: 5,
      })
    : [];

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <header className="flex h-12 items-center gap-3 border-b border-neutral-800 px-6">
        <Link
          href="/company/employees"
          className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Employees
        </Link>
        <span className="text-neutral-700">/</span>
        <h1 className="text-sm font-semibold text-neutral-100">
          {employee.name}
        </h1>
      </header>

      <div className="flex flex-col gap-8 p-6 max-w-3xl">
        {/* Identity */}
        <section className="flex items-start gap-4">
          <div
            className={cn(
              "flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-xl font-bold",
              avatarClass
            )}
          >
            {employee.name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-neutral-100">
                {employee.name}
              </h2>
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                  STATUS_STYLES[employee.status] ?? STATUS_STYLES["planned"]
                )}
              >
                {employee.status}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-neutral-400">
              {employee.role?.name ?? employee.title ?? "No role assigned"}
            </p>
            {employee.reportsTo && (
              <p className="mt-1 text-xs text-neutral-600">
                Reports to {employee.reportsTo}
              </p>
            )}
          </div>
        </section>

        {/* Mission */}
        {employee.mission && (
          <section>
            <SectionLabel>Mission</SectionLabel>
            <p className="mt-2 text-sm text-neutral-300 leading-relaxed">
              {employee.mission}
            </p>
          </section>
        )}

        {/* Bio */}
        {employee.bio && (
          <section>
            <SectionLabel>About</SectionLabel>
            <p className="mt-2 text-sm text-neutral-400 leading-relaxed">
              {employee.bio}
            </p>
          </section>
        )}

        {/* Details */}
        <section>
          <SectionLabel>Details</SectionLabel>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <DetailCard
              icon={<Building2 className="h-3.5 w-3.5" />}
              label="Department"
              value={employee.department?.name ?? "—"}
            />
            <DetailCard
              icon={<Shield className="h-3.5 w-3.5" />}
              label="Role Level"
              value={
                employee.role?.level ? `Level ${employee.role.level}` : "—"
              }
            />
            <DetailCard
              icon={<Users className="h-3.5 w-3.5" />}
              label="Reports To"
              value={employee.reportsTo ?? "—"}
            />
          </div>
        </section>

        {/* Department colleagues */}
        {colleagues.length > 0 && (
          <section>
            <SectionLabel>Teammates in {employee.department?.name}</SectionLabel>
            <div className="mt-3 flex flex-wrap gap-2">
              {colleagues.map((c) => (
                <Link
                  key={c.id}
                  href={`/company/employees/${c.id}`}
                  className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-300 hover:border-neutral-700 hover:bg-neutral-800 transition-colors"
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold",
                      avatarClass
                    )}
                  >
                    {c.name[0]}
                  </span>
                  {c.name}
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
      {children}
    </h3>
  );
}

function DetailCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 py-3">
      <div className="flex items-center gap-1.5 text-neutral-500">
        {icon}
        <span className="text-[11px] font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="mt-1.5 text-sm font-medium text-neutral-200 truncate">
        {value}
      </p>
    </div>
  );
}
