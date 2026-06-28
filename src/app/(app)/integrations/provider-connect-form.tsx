"use client";

import { useActionState } from "react";
import { connectProviderManualToken } from "@/app/actions/provider-connection-actions";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface Props {
  providerId: string;
  tokenFieldLabel: string;
  tokenFieldPlaceholder: string;
  docsUrl: string;
}

export function ProviderConnectForm({
  providerId,
  tokenFieldLabel,
  tokenFieldPlaceholder,
  docsUrl,
}: Props) {
  const [state, action, pending] = useActionState(connectProviderManualToken, undefined);
  const router = useRouter();

  useEffect(() => {
    if (state && "success" in state) {
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="provider" value={providerId} />

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-neutral-400">
          {tokenFieldLabel}
        </label>
        <input
          name="accessToken"
          type="password"
          placeholder={tokenFieldPlaceholder}
          required
          autoComplete="off"
          className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 outline-none focus:border-neutral-500 transition-colors font-mono"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-neutral-400">
          Account name <span className="text-neutral-700">(optional)</span>
        </label>
        <input
          name="accountName"
          type="text"
          placeholder="e.g. my-org or username"
          autoComplete="off"
          className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 outline-none focus:border-neutral-500 transition-colors"
        />
      </div>

      {state && "error" in state && (
        <p className="text-xs text-red-400">{state.error}</p>
      )}
      {state && "success" in state && (
        <p className="text-xs text-emerald-400">Connected successfully.</p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-100 disabled:opacity-50 transition-colors"
        >
          {pending ? "Saving…" : "Save token"}
        </button>
        <a
          href={docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors"
        >
          Get token ↗
        </a>
      </div>

      <p className="text-[11px] text-neutral-700">
        Token is encrypted at rest (AES-256-GCM) and never shared with other users.
      </p>
    </form>
  );
}
