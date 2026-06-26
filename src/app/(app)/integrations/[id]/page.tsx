import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { INTEGRATION_PROVIDERS } from "@/lib/integrations";
import { ConnectForm } from "./connect-form";
import { DisconnectButton } from "./disconnect-button";
import { SyncButton } from "./sync-button";

interface Props {
  params: Promise<{ id: string }>;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bgColor: string; icon: React.ElementType }
> = {
  connected: {
    label: "Connected",
    color: "text-emerald-400",
    bgColor: "bg-emerald-950/20 border-emerald-900/40",
    icon: CheckCircle2,
  },
  disconnected: {
    label: "Not connected",
    color: "text-neutral-500",
    bgColor: "bg-neutral-900 border-neutral-800",
    icon: AlertCircle,
  },
  error: {
    label: "Connection error",
    color: "text-red-400",
    bgColor: "bg-red-950/10 border-red-900/40",
    icon: AlertCircle,
  },
};

export default async function IntegrationDetailPage({ params }: Props) {
  const { id: providerId } = await params;

  const providerDef = INTEGRATION_PROVIDERS.find((p) => p.id === providerId);
  if (!providerDef) notFound();

  const session = await auth();
  if (!session?.user) redirect("/login");

  const company = await prisma.company.findFirst({
    where: { ownerId: session.user.id },
    select: { id: true },
  });
  if (!company) redirect("/onboarding");

  const integration = await prisma.integration.findFirst({
    where: { companyId: company.id, provider: providerId },
    include: {
      syncLogs: {
        orderBy: { createdAt: "desc" },
        take: 15,
      },
    },
  });

  const status = integration?.status ?? "disconnected";
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG["disconnected"];
  const StatusIcon = cfg.icon;
  const isConnected = status === "connected";

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <header className="flex h-12 items-center gap-3 border-b border-neutral-800 px-6">
        <Link
          href="/integrations"
          className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Integrations
        </Link>
        <span className="text-neutral-700">/</span>
        <h1 className="text-sm font-semibold text-neutral-100">
          {providerDef.name}
        </h1>
      </header>

      <div className="flex flex-col gap-8 p-6 max-w-2xl">
        {/* Provider header */}
        <section className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-800 border border-neutral-700 text-sm font-bold text-neutral-300">
            {providerDef.id === "vercel" ? "▲" : providerDef.name.charAt(0)}
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-neutral-100">
              {providerDef.name}
            </h2>
            <p className="mt-0.5 text-sm text-neutral-500">
              {providerDef.description}
            </p>
            <Link
              href={providerDef.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 text-xs text-neutral-600 hover:text-neutral-400 transition-colors"
            >
              Get credentials
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </section>

        {/* Status */}
        <section
          className={cn(
            "flex items-center gap-3 rounded-lg border px-4 py-3",
            cfg.bgColor
          )}
        >
          <StatusIcon className={cn("h-4 w-4 shrink-0", cfg.color)} />
          <div className="flex-1">
            <p className={cn("text-sm font-medium", cfg.color)}>{cfg.label}</p>
            {integration?.lastSyncAt && (
              <p className="mt-0.5 text-xs text-neutral-600">
                Last synced{" "}
                {new Date(integration.lastSyncAt).toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            )}
            {integration?.errorMessage && (
              <p className="mt-0.5 text-xs text-red-400">
                {integration.errorMessage}
              </p>
            )}
          </div>
          {isConnected && integration && (
            <div className="flex items-center gap-2">
              <SyncButton integrationId={integration.id} />
              <DisconnectButton integrationId={integration.id} />
            </div>
          )}
        </section>

        {/* Connect / reconfigure form */}
        <section>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
            {isConnected ? "Update Credentials" : "Connect"}
          </h3>
          <ConnectForm provider={providerDef} />
        </section>

        {/* Sync log */}
        {integration && integration.syncLogs.length > 0 && (
          <section>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Activity Log
            </h3>
            <div className="flex flex-col gap-1">
              {integration.syncLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 rounded-lg border border-neutral-800 bg-neutral-900/50 px-3 py-2.5"
                >
                  <div
                    className={cn(
                      "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
                      log.status === "success"
                        ? "bg-emerald-500"
                        : log.status === "error"
                        ? "bg-red-500"
                        : "bg-neutral-600"
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-neutral-400">{log.message}</p>
                    {log.recordsCount > 0 && (
                      <p className="mt-0.5 text-[11px] text-neutral-600">
                        {log.recordsCount} record{log.recordsCount === 1 ? "" : "s"} synced
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-[10px] text-neutral-700">
                    {new Date(log.createdAt).toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
