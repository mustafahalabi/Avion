"use client";

import { useTransition } from "react";
import { disconnectIntegration } from "@/app/actions/integrations";
import { useRouter } from "next/navigation";

export function DisconnectButton({ integrationId }: { integrationId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      await disconnectIntegration(integrationId);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={handleClick}
      className="rounded-lg border border-red-900 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-950 disabled:opacity-50 transition-colors"
    >
      {pending ? "Disconnecting…" : "Disconnect"}
    </button>
  );
}
