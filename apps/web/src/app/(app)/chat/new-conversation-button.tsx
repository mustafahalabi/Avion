"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { createConversation } from "@/app/actions/chat";
import { Plus, MessageSquare } from "lucide-react";

export function NewConversationButton({
  variant = "icon",
}: {
  variant?: "icon" | "primary";
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      const conv = await createConversation();
      router.push(`/chat/${conv.id}`);
    });
  }

  if (variant === "primary") {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={handleClick}
        className="flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-xs font-medium text-neutral-900 hover:bg-neutral-100 disabled:opacity-50 transition-colors"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        {pending ? "Starting…" : "Start a conversation"}
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={handleClick}
      className="flex items-center gap-1.5 rounded-md bg-neutral-800 px-2.5 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-700 disabled:opacity-50 transition-colors"
    >
      <Plus className="h-3.5 w-3.5" />
      {pending ? "…" : "New"}
    </button>
  );
}
