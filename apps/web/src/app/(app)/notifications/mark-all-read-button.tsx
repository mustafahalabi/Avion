"use client";

import { useTransition } from "react";
import { markAllRead } from "@/app/actions/notifications";
import { useRouter } from "next/navigation";

export function MarkAllReadButton() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      await markAllRead();
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={handleClick}
      className="rounded-md border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-400 hover:bg-neutral-800 disabled:opacity-50 transition-colors"
    >
      {pending ? "Marking…" : "Mark all read"}
    </button>
  );
}
