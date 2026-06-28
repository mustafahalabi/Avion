import { getCurrentUser } from "@/lib/current-user";
import { redirect } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { CheckCircle2, AlertCircle, XCircle, RefreshCw, ExternalLink } from "lucide-react";
import { loadProviderCards } from "@/app/actions/provider-connection-actions";
import { ProviderConnectForm } from "./provider-connect-form";
import { ProviderDisconnectButton } from "./provider-disconnect-button";

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    dotColor: string;
    textColor: string;
    bgColor: string;
    borderColor: string;
    icon: React.ElementType;
  }
> = {
  connected: {
    label: "Connected",
    dotColor: "bg-emerald-500",
    textColor: "text-emerald-400",
    bgColor: "bg-emerald-950/20",
    borderColor: "border-emerald-900/40",
    icon: CheckCircle2,
  },
  disconnected: {
    label: "Not connected",
    dotColor: "bg-neutral-700",
    textColor: "text-neutral-500",
    bgColor: "bg-neutral-900",
    borderColor: "border-neutral-800",
    icon: AlertCircle,
  },
  error: {
    label: "Connection error",
    dotColor: "bg-red-500",
    textColor: "text-red-400",
    bgColor: "bg-red-950/10",
    borderColor: "border-red-900/40",
    icon: XCircle,
  },
  expired: {
    label: "Token expired",
    dotColor: "bg-amber-500",
    textColor: "text-amber-400",
    bgColor: "bg-amber-950/10",
    borderColor: "border-amber-900/40",
    icon: RefreshCw,
  },
  needs_reauth: {
    label: "Needs attention",
    dotColor: "bg-amber-500",
    textColor: "text-amber-400",
    bgColor: "bg-amber-950/10",
    borderColor: "border-amber-900/40",
    icon: RefreshCw,
  },
  warning: {
    label: "Warning",
    dotColor: "bg-amber-500",
    textColor: "text-amber-400",
    bgColor: "bg-amber-950/10",
    borderColor: "border-amber-900/40",
    icon: AlertCircle,
  },
};

const FALLBACK_STATUS = STATUS_CONFIG["disconnected"];

// ─── Provider icon ────────────────────────────────────────────────────────────

function ProviderIcon({ id }: { id: string }) {
  const icons: Record<string, string> = {
    github: "GH",
    linear: "L",
    vercel: "▲",
  };
  return (
    <span className="text-[11px] font-bold text-neutral-400">
      {icons[id] ?? id.charAt(0).toUpperCase()}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function IntegrationsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const cards = await loadProviderCards();
  if (cards === null) redirect("/onboarding");

  const connectedCount = cards.filter((c) => c.isConnected).length;

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
            Connect external tools to Engineering OS. Credentials are encrypted at rest.
            Connect once — credentials are reused across all Engineering OS features.
          </p>
        </section>

        {/* Provider cards */}
        <section className="flex flex-col gap-4">
          {cards.map((card) => {
            const cfg = STATUS_CONFIG[card.cardStatus] ?? FALLBACK_STATUS;
            const StatusIcon = cfg.icon;
            const needsAction = !card.isConnected;

            return (
              <div
                key={card.providerId}
                className="flex flex-col rounded-xl border border-neutral-800 bg-neutral-900 overflow-hidden"
              >
                {/* Card header */}
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-neutral-700 bg-neutral-800">
                    <ProviderIcon id={card.providerId} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-neutral-200">{card.name}</p>
                    </div>
                    <p className="mt-0.5 text-xs text-neutral-600 truncate">
                      {card.description}
                    </p>
                  </div>

                  {/* Status badge */}
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <div className={cn("h-1.5 w-1.5 rounded-full", cfg.dotColor)} />
                      <span className={cn("text-xs", cfg.textColor)}>{card.statusLabel}</span>
                    </div>
                  </div>
                </div>

                {/* Connected details */}
                {card.isConnected && (
                  <div
                    className={cn(
                      "flex items-center justify-between gap-4 border-t px-5 py-3",
                      cfg.borderColor,
                      cfg.bgColor
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <StatusIcon className={cn("h-3.5 w-3.5 shrink-0", cfg.textColor)} />
                      <div className="min-w-0">
                        {card.accountName && (
                          <p className="text-xs font-medium text-neutral-300 truncate">
                            {card.accountName}
                          </p>
                        )}
                        {card.accountEmail && (
                          <p className="text-[11px] text-neutral-600 truncate">
                            {card.accountEmail}
                          </p>
                        )}
                        {!card.accountName && !card.accountEmail && (
                          <p className="text-xs text-neutral-500">Connected</p>
                        )}
                        {card.lastConnectedAt && (
                          <p className="mt-0.5 text-[11px] text-neutral-700">
                            Connected{" "}
                            {new Date(card.lastConnectedAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                    {card.connectionId && (
                      <ProviderDisconnectButton connectionId={card.connectionId} />
                    )}
                  </div>
                )}

                {/* Error state */}
                {!card.isConnected && card.cardStatus === "error" && card.errorMessage && (
                  <div className={cn("border-t px-5 py-3", cfg.borderColor, cfg.bgColor)}>
                    <div className="flex items-start gap-2">
                      <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-red-400" />
                      <p className="text-xs text-red-400">{card.errorMessage}</p>
                    </div>
                  </div>
                )}

                {/* Expired / needs_reauth state */}
                {!card.isConnected &&
                  (card.cardStatus === "expired" || card.cardStatus === "needs_reauth") && (
                    <div className={cn("border-t px-5 py-3", cfg.borderColor, cfg.bgColor)}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <RefreshCw className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                          <p className="text-xs text-amber-400">
                            {card.cardStatus === "expired"
                              ? "Token expired — reconnect to restore access."
                              : "Re-authentication required."}
                          </p>
                        </div>
                        {card.connectionId && (
                          <ProviderDisconnectButton connectionId={card.connectionId} />
                        )}
                      </div>
                    </div>
                  )}

                {/* Manual token form — shown when not connected or needing reconnect */}
                {needsAction && (
                  <div className="border-t border-neutral-800 px-5 py-4">
                    <div className="mb-3 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wider text-neutral-600">
                        {card.cardStatus === "disconnected" ? "Connect" : "Reconnect"}
                      </p>
                      <div className="flex items-center gap-1 rounded-full border border-neutral-800 bg-neutral-800/50 px-2 py-0.5">
                        <span className="text-[10px] text-neutral-600">Advanced · manual token</span>
                      </div>
                    </div>
                    <div className="mb-3 rounded-lg border border-neutral-800 bg-neutral-950/40 px-3 py-2">
                      <p className="text-[11px] text-neutral-600">
                        <span className="font-medium text-neutral-500">Required access:</span>{" "}
                        {card.requiredScopeSummary}
                      </p>
                    </div>
                    <ProviderConnectForm
                      providerId={card.providerId}
                      tokenFieldLabel={card.tokenFieldLabel}
                      tokenFieldPlaceholder={card.tokenFieldPlaceholder}
                      docsUrl={card.docsUrl}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </section>

        {/* Empty state */}
        {cards.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-sm text-neutral-500">No integrations configured yet.</p>
          </div>
        )}

        {/* Legacy credential management note */}
        <section className="rounded-lg border border-neutral-800/50 bg-neutral-900/30 px-4 py-3">
          <div className="flex items-start gap-2">
            <ExternalLink className="h-3.5 w-3.5 shrink-0 mt-0.5 text-neutral-700" />
            <p className="text-[11px] text-neutral-700">
              Previously saved legacy credentials remain available via{" "}
              <Link
                href="/integrations/github"
                className="underline hover:text-neutral-500 transition-colors"
              >
                per-provider settings
              </Link>
              .
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
