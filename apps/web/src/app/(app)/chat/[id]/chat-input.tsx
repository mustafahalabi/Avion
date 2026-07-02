"use client";

import { useActionState, useEffect, useRef } from "react";
import { sendMessage } from "@/app/actions/chat";
import { useRouter } from "next/navigation";
import { ArrowUp } from "lucide-react";

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

export function ChatInput({ conversationId }: { conversationId: string }) {
  const boundAction = sendMessage.bind(null, conversationId);
  const [state, action, pending] = useActionState(boundAction, undefined);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (state && "conversationId" in state) {
      formRef.current?.reset();
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      router.refresh();
    }
  }, [state, router]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }

  return (
    <form ref={formRef} action={action}>
      <div className="flex items-end gap-2 rounded-xl border border-neutral-700 bg-neutral-900 p-2 focus-within:border-neutral-500 transition-colors">
        <textarea
          ref={textareaRef}
          name="content"
          rows={1}
          required
          disabled={pending}
          placeholder="State a goal, ask a question, or give direction… (Enter to send)"
          onKeyDown={handleKeyDown}
          onChange={handleInput}
          className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-neutral-100 placeholder-neutral-600 outline-none disabled:opacity-50"
          style={{ minHeight: "36px", maxHeight: "160px" }}
        />
        <div className="flex shrink-0 items-center gap-2">
          <select
            name="requestType"
            defaultValue="feature"
            className="rounded-lg border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-[11px] text-neutral-400 outline-none focus:border-neutral-600 transition-colors"
          >
            {REQUEST_TYPES.map((t) => (
              <option key={t.value} value={t.value} className="bg-neutral-900">
                {t.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={pending}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-neutral-900 hover:bg-neutral-200 disabled:opacity-40 transition-colors"
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        </div>
      </div>
      {state && "error" in state && (
        <p className="mt-1.5 px-2 text-xs text-red-400">{state.error}</p>
      )}
      <p className="mt-1.5 px-2 text-[10px] text-neutral-700">
        Shift + Enter for a new line · first message becomes a request
      </p>
    </form>
  );
}
