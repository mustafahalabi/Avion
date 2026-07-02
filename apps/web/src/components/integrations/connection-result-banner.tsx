"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, X, XCircle } from "lucide-react";

const PROVIDER_LABELS: Record<string, string> = {
  github: "GitHub",
  linear: "Linear",
};

const ERROR_MESSAGES: Record<string, string> = {
  not_configured:
    "This provider's OAuth app isn't configured yet. Add its credentials to the environment, or use a manual token.",
  no_company: "No company found for your account.",
  invalid_state: "The connection request expired or was invalid. Please try again.",
  session_mismatch: "That connection didn't match your session. Please try again.",
  session_required: "Your session expired during the connection. Sign in and retry.",
  missing_code: "The provider didn't return an authorization code. Please try again.",
  access_denied: "Authorization was declined.",
  denied: "Authorization was declined.",
  exchange_failed: "Could not complete the connection with the provider. Please try again.",
};

/**
 * Reads the `?connected=<provider>` / `?error=<code>` query the OAuth callback
 * redirects back with and shows a dismissable success/error banner.
 */
export function ConnectionResultBanner() {
  const params = useSearchParams();
  const connected = params.get("connected");
  const error = params.get("error");
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || (!connected && !error)) return null;

  if (connected) {
    const label = PROVIDER_LABELS[connected] ?? connected;
    return (
      <Banner tone="success" onDismiss={() => setDismissed(true)}>
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
        <span>{label} connected successfully.</span>
      </Banner>
    );
  }

  const message =
    (error && ERROR_MESSAGES[error]) ?? "Something went wrong. Please try again.";
  return (
    <Banner tone="error" onDismiss={() => setDismissed(true)}>
      <XCircle className="h-4 w-4 shrink-0 text-red-400" />
      <span>{message}</span>
    </Banner>
  );
}

function Banner({
  tone,
  children,
  onDismiss,
}: {
  tone: "success" | "error";
  children: React.ReactNode;
  onDismiss: () => void;
}) {
  const styles =
    tone === "success"
      ? "border-emerald-900/40 bg-emerald-950/20 text-emerald-300"
      : "border-red-900/40 bg-red-950/20 text-red-300";
  return (
    <div
      className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs ${styles}`}
    >
      <div className="flex items-center gap-2">{children}</div>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 text-current/60 transition-opacity hover:opacity-100"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
