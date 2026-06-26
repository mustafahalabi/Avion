"use client";

import { useTransition } from "react";
import { markReleased } from "@/app/actions/releases";
import { useRouter } from "next/navigation";
import { Rocket } from "lucide-react";

export function ReleaseButton({ releaseId }: { releaseId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    if (!confirm("Mark this release as deployed? This action cannot be undone.")) return;
    startTransition(async () => {
      await markReleased(releaseId);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={handleClick}
      className="flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-100 disabled:opacity-50 transition-colors"
    >
      <Rocket className="h-3.5 w-3.5" />
      {pending ? "Releasing…" : "Mark released"}
    </button>
  );
}
