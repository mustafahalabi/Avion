"use client";

import { useTransition } from "react";
import { disconnectProvider } from "@/app/actions/provider-connection-actions";
import { useRouter } from "next/navigation";

export function ProviderDisconnectButton({ connectionId }: { connectionId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      await disconnectProvider(connectionId);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={handleClick}
      className="rounded-lg border border-red-900 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-950/40 disabled:opacity-50 transition-colors"
    >
      {pending ? "Disconnecting…" : "Disconnect"}
    </button>
  );
}
