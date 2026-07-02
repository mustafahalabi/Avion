import { Suspense } from "react";
import { redirect } from "next/navigation";
import { CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { getCurrentUser } from "@/lib/current-user";
import { cn } from "@/lib/utils";
import { loadProviderCards } from "@/app/actions/provider-connection-actions";
import { OAuthConnectButton } from "@/components/integrations/oauth-connect-button";
import { ConnectionResultBanner } from "@/components/integrations/connection-result-banner";
import { ProviderDisconnectButton } from "@/app/(app)/integrations/provider-disconnect-button";
import { ProviderConnectForm } from "@/app/(app)/integrations/provider-connect-form";

const RETURN_TO = "/connections";

function ProviderIcon({ id }: { id: string }) {
  const icons: Record<string, string> = { github: "GH", linear: "L" };
  return (
    <span className="text-[11px] font-bold text-neutral-400">
      {icons[id] ?? id.charAt(0).toUpperCase()}
    </span>
  );
}

export default async function ConnectionsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const cards = await loadProviderCards();
  if (cards === null) redirect("/onboarding");

  const connectedCount = cards.filter((c) => c.isConnected).length;

  return (
    <div className="flex flex-1 flex-col overflow-auto">
      <header className="flex h-12 items-center justify-between border-b border-neutral-800 px-6">
        <h1 className="text-sm font-semibold text-neutral-100">Connections</h1>
        <span className="text-xs text-neutral-500">
          {connectedCount} of {cards.length} connected
        </span>
      </header>

      <div className="flex flex-col gap-6 p-6">
        <p className="text-sm text-neutral-500">
          Connect GitHub and Linear so your company can reach your code and
          issues. Sign in with each provider via OAuth — tokens are encrypted at
          rest. You can disconnect at any time.
        </p>

        <Suspense fallback={null}>
          <ConnectionResultBanner />
        </Suspense>

        <section className="flex flex-col gap-4">
          {cards.map((card) => {
            const connected = card.isConnected;
            const isError =
              card.cardStatus === "error" ||
              card.cardStatus === "expired" ||
              card.cardStatus === "needs_reauth";

            return (
              <div
                key={card.providerId}
                className="flex flex-col overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900"
              >
                <div className="flex items-center gap-4 px-5 py-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-neutral-700 bg-neutral-800">
                    <ProviderIcon id={card.providerId} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-neutral-200">{card.name}</p>
                    <p className="mt-0.5 truncate text-xs text-neutral-600">
                      {connected && card.accountName
                        ? card.accountName
                        : card.description}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-3">
                    <span
                      className={cn(
                        "flex items-center gap-1.5 text-xs",
                        connected
                          ? "text-emerald-400"
                          : isError
                            ? "text-amber-400"
                            : "text-neutral-500"
                      )}
                    >
                      {connected ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : isError ? (
                        <RefreshCw className="h-3.5 w-3.5" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 text-neutral-700" />
                      )}
                      {card.statusLabel}
                    </span>

                    {connected ? (
                      card.connectionId && (
                        <ProviderDisconnectButton connectionId={card.connectionId} />
                      )
                    ) : (
                      <OAuthConnectButton
                        provider={card.providerId}
                        configured={card.oauthConfigured}
                        returnTo={RETURN_TO}
                        label={card.cardStatus === "disconnected" ? "Connect" : "Reconnect"}
                      />
                    )}
                  </div>
                </div>

                {/* Manual token fallback (advanced) when not connected */}
                {!connected && (
                  <details className="border-t border-neutral-800 px-5 py-3">
                    <summary className="cursor-pointer text-[11px] text-neutral-600 hover:text-neutral-400">
                      Advanced · connect with a manual token instead
                    </summary>
                    <div className="mt-3">
                      <p className="mb-2 text-[11px] text-neutral-600">
                        <span className="font-medium text-neutral-500">Required access:</span>{" "}
                        {card.requiredScopeSummary}
                      </p>
                      <ProviderConnectForm
                        providerId={card.providerId}
                        tokenFieldLabel={card.tokenFieldLabel}
                        tokenFieldPlaceholder={card.tokenFieldPlaceholder}
                        docsUrl={card.docsUrl}
                      />
                    </div>
                  </details>
                )}
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}
