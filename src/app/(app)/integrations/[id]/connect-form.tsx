"use client";

import { useActionState } from "react";
import { connectIntegration } from "@/app/actions/integrations";
import type { ProviderConfig } from "@/lib/integrations";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function ConnectForm({ provider }: { provider: ProviderConfig }) {
  const [state, action, pending] = useActionState(connectIntegration, undefined);
  const router = useRouter();

  useEffect(() => {
    if (state && "success" in state) {
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="provider" value={provider.id} />

      {provider.fields.map((field) => (
        <div key={field.key} className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-neutral-400">
            {field.label}
            {!field.required && (
              <span className="ml-1 text-neutral-700">(optional)</span>
            )}
          </label>
          <input
            name={field.key}
            type={field.type === "password" ? "password" : "text"}
            placeholder={field.placeholder}
            required={field.required}
            autoComplete="off"
            className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 outline-none focus:border-neutral-500 transition-colors font-mono"
          />
        </div>
      ))}

      {state && "error" in state && (
        <p className="text-xs text-red-400">{state.error}</p>
      )}
      {state && "success" in state && (
        <p className="text-xs text-emerald-400">Integration connected successfully.</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-100 disabled:opacity-50 transition-colors"
      >
        {pending ? "Connecting…" : "Save credentials"}
      </button>

      <p className="text-[11px] text-neutral-700">
        Credentials are encrypted at rest (AES-256-GCM) and never exposed to other users. Live provider sync is coming in a future release.
      </p>
    </form>
  );
}
