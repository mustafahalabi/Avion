import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { SettingsForm, ExecutionSettingsForm } from "./settings-form";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    include: { settings: true },
  });

  if (!company) redirect("/sign-in");

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <header className="flex h-12 items-center border-b border-neutral-800 px-6">
        <h1 className="text-sm font-semibold text-neutral-100">Settings</h1>
      </header>

      <div className="p-6 flex flex-col gap-8">
        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Account
          </h2>
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 divide-y divide-neutral-800">
            <div className="px-5 py-4">
              <p className="text-xs text-neutral-500 mb-0.5">Name</p>
              <p className="text-sm text-neutral-200">{user.name ?? "—"}</p>
            </div>
            <div className="px-5 py-4">
              <p className="text-xs text-neutral-500 mb-0.5">Email</p>
              <p className="text-sm text-neutral-200">{user.email}</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Company
          </h2>
          <SettingsForm
            companyId={company.id}
            companyName={company.name}
            autonomyLevel={company.settings?.autonomyLevel ?? "assist"}
            cultureProfile={company.settings?.cultureProfile ?? "startup"}
            planningProvider={company.settings?.planningProvider ?? null}
            defaultAgentType={company.settings?.defaultAgentType ?? "claude_code"}
          />
        </section>

        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Execution
          </h2>
          <ExecutionSettingsForm autonomyLevel={company.settings?.autonomyLevel ?? "assist"} />
        </section>

        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            System
          </h2>
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden">
            <Link
              href="/settings/config"
              className="flex items-center justify-between px-5 py-4 transition-colors hover:bg-neutral-800/50"
            >
              <div>
                <p className="text-sm font-medium text-neutral-200">Config Inventory</p>
                <p className="mt-0.5 text-xs text-neutral-600">
                  View all company, integration, and environment configuration in one place.
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-neutral-600" />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
