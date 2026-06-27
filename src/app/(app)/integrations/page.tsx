import { getCurrentUser } from "@/lib/current-user";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { INTEGRATION_PROVIDERS } from "@/lib/integrations";

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  connected: { label: "Connected", color: "text-emerald-400", dot: "bg-emerald-500" },
  disconnected: { label: "Not connected", color: "text-neutral-600", dot: "bg-neutral-700" },
  error: { label: "Error", color: "text-red-400", dot: "bg-red-500" },
  syncing: { label: "Syncing…", color: "text-blue-400", dot: "bg-blue-500" },
};

const CATEGORY_LABELS: Record<string, string> = {
  work: "Work Management",
  code: "Code & Repositories",
  communication: "Communication",
  infrastructure: "Infrastructure",
};

export default async function IntegrationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const company = await prisma.company.findFirst({
    where: { ownerId: user.id },
    include: {
      integrations: {
        orderBy: { updatedAt: "desc" },
      },
    },
  });
  if (!company) redirect("/onboarding");

  const connectedMap = new Map(
    company.integrations.map((i) => [i.provider, i])
  );

  const connectedCount = company.integrations.filter(
    (i) => i.status === "connected"
  ).length;

  // Group providers by category
  const byCategory = INTEGRATION_PROVIDERS.reduce<
    Record<string, typeof INTEGRATION_PROVIDERS[number][]>
  >((acc, p) => {
    const cat = p.category;
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(p);
    return acc;
  }, {});

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <header className="flex h-12 items-center justify-between border-b border-neutral-800 px-6">
        <h1 className="text-sm font-semibold text-neutral-100">Integrations</h1>
        {connectedCount > 0 && (
          <span className="text-xs text-neutral-500">
            {connectedCount} connected
          </span>
        )}
      </header>

      <div className="flex flex-col gap-8 p-6 max-w-3xl">
        {/* Intro */}
        <section>
          <p className="text-sm text-neutral-500">
            Connect external tools to keep Engineering OS in sync with your work.
            Credentials are stored securely and only used to read and write data
            on your behalf.
          </p>
        </section>

        {/* Provider groups */}
        {Object.entries(byCategory).map(([category, providers]) => (
          <section key={category}>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-600">
              {CATEGORY_LABELS[category] ?? category}
            </h2>
            <div className="flex flex-col gap-2">
              {providers.map((provider) => {
                const existing = connectedMap.get(provider.id);
                const status = existing?.status ?? "disconnected";
                const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG["disconnected"];

                return (
                  <Link
                    key={provider.id}
                    href={`/integrations/${provider.id}`}
                    className="group flex items-center gap-4 rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-4 transition-colors hover:border-neutral-700 hover:bg-neutral-800"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-800 border border-neutral-700 group-hover:border-neutral-600 transition-colors">
                      <ProviderIcon provider={provider.id} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-neutral-200">
                          {provider.name}
                        </p>
                        {existing?.lastSyncAt && (
                          <span className="text-[10px] text-neutral-700">
                            Synced{" "}
                            {new Date(existing.lastSyncAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-neutral-600 truncate">
                        {provider.description}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <div className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
                        <span className={cn("text-xs", cfg.color)}>
                          {cfg.label}
                        </span>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-neutral-700 group-hover:text-neutral-500 transition-colors" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function ProviderIcon({ provider }: { provider: string }) {
  const icons: Record<string, string> = {
    linear: "L",
    github: "GH",
    slack: "S",
    vercel: "▲",
  };
  return (
    <span className="text-[11px] font-bold text-neutral-400">
      {icons[provider] ?? provider.charAt(0).toUpperCase()}
    </span>
  );
}
