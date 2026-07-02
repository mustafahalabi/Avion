"use client";

import { useTransition } from "react";
import { markNotificationRead } from "@/app/actions/notifications";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";

export function MarkReadButton({ notificationId }: { notificationId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      await markNotificationRead(notificationId);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={handleClick}
      title="Mark as read"
      className="shrink-0 rounded-md p-1 text-neutral-700 hover:bg-neutral-700 hover:text-neutral-400 disabled:opacity-50 transition-colors"
    >
      <Check className="h-3.5 w-3.5" />
    </button>
  );
}
