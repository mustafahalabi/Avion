"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp } from "lucide-react";

import { sendMessage } from "@/app/actions/chat";
import type { LivePipeline } from "@/lib/live-pipeline-data";
import type { TimelineItem } from "@/components/timeline-entry";
import type { ConversationScope } from "@/lib/chat-activity";
import { ChatThread, type ChatThreadMessage } from "./chat-thread";

const REQUEST_TYPES = [
  { value: "feature", label: "Feature" },
  { value: "bug", label: "Bug" },
  { value: "architecture", label: "Architecture" },
  { value: "security", label: "Security" },
  { value: "performance", label: "Performance" },
  { value: "question", label: "Question" },
  { value: "documentation", label: "Docs" },
  { value: "configuration", label: "Config" },
];

/**
 * The interactive chat body: the live thread plus the composer, sharing state so
 * a sent message appears **optimistically** in the thread the instant it's sent
 * (before the server round-trips), then reconciles when the real message lands.
 * Owns both so the send feels instantaneous (MUS-305).
 */
export function ChatSurface({
  conversationId,
  messages,
  seedActivity,
  initialPipeline,
  scope,
}: {
  conversationId: string;
  messages: readonly ChatThreadMessage[];
  seedActivity: readonly TimelineItem[];
  initialPipeline: LivePipeline;
  scope: ConversationScope;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const optimisticCounter = useRef(0);

  // Optimistic user messages, shown until the server thread reflects them.
  const [pending, setPending] = useState<ChatThreadMessage[]>([]);
  const serverCount = messages.length;
  const lastServerCount = useRef(serverCount);
  useEffect(() => {
    if (serverCount !== lastServerCount.current) {
      lastServerCount.current = serverCount;
      // The refreshed thread now carries the real message(s) — drop optimistic.
      setPending([]);
    }
  }, [serverCount]);

  const resetTextareaHeight = (): void => {
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const [state, formAction, isSubmitting] = useActionState(
    async (prev: Awaited<ReturnType<typeof sendMessage>>, formData: FormData) => {
      const content = String(formData.get("content") ?? "").trim();
      if (!content) return prev;

      const optimistic: ChatThreadMessage = {
        id: `optimistic-${(optimisticCounter.current += 1)}`,
        role: "user",
        type: "text",
        content,
        createdAt: new Date(),
        request: null,
        pending: true,
      };
      setPending((prev) => [...prev, optimistic]);

      const result = await sendMessage(conversationId, prev, formData);
      if (result && "error" in result) {
        // The send failed — remove the optimistic bubble so it isn't stranded.
        setPending((prev) => prev.filter((m) => m.id !== optimistic.id));
      } else {
        formRef.current?.reset();
        resetTextareaHeight();
        router.refresh();
      }
      return result;
    },
    undefined
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>): void {
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }

  const allMessages =
    pending.length > 0 ? [...messages, ...pending] : messages;

  return (
    <>
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <ChatThread
          messages={allMessages}
          seedActivity={seedActivity}
          initialPipeline={initialPipeline}
          scope={scope}
        />
      </div>

      <div className="shrink-0 border-t border-neutral-800 px-6 py-4">
        <div className="mx-auto w-full max-w-2xl">
          <form ref={formRef} action={formAction}>
            <div className="flex items-end gap-2 rounded-xl border border-neutral-700 bg-neutral-900 p-2 transition-colors focus-within:border-neutral-500">
              <textarea
                ref={textareaRef}
                name="content"
                rows={1}
                required
                disabled={isSubmitting}
                placeholder="Tell your company what to build… (Enter to send)"
                onKeyDown={handleKeyDown}
                onChange={handleInput}
                className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-neutral-100 placeholder-neutral-600 outline-none disabled:opacity-50"
                style={{ minHeight: "36px", maxHeight: "160px" }}
              />
              <div className="flex shrink-0 items-center gap-2">
                <select
                  name="requestType"
                  defaultValue="feature"
                  className="rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-[11px] text-neutral-400 outline-none transition-colors focus:border-neutral-600"
                >
                  {REQUEST_TYPES.map((t) => (
                    <option key={t.value} value={t.value} className="bg-neutral-900">
                      {t.label}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-neutral-900 transition-colors hover:bg-neutral-200 disabled:opacity-40"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
              </div>
            </div>
            {state && "error" in state && (
              <p className="mt-1.5 px-2 text-xs text-red-400">{state.error}</p>
            )}
            <p className="mt-1.5 px-2 text-[10px] text-neutral-700">
              Shift + Enter for a new line · the company plans, builds, reviews, QAs
              &amp; ships it — you watch here
            </p>
          </form>
        </div>
      </div>
    </>
  );
}
