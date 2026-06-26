"use client";

import { useTransition } from "react";
import { triggerSync } from "@/app/actions/integrations";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function SyncButton({ integrationId }: { integrationId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      await triggerSync(integrationId);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={handleClick}
      className="flex items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:bg-neutral-800 disabled:opacity-50 transition-colors"
    >
      <RefreshCw className={`h-3 w-3 ${pending ? "animate-spin" : ""}`} />
      {pending ? "Syncing…" : "Sync now"}
    </button>
  );
}
