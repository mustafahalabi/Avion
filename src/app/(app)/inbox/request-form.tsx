"use client";

import { useActionState, useEffect, useRef } from "react";
import { submitRequest } from "@/app/actions/runtime";
import { useRouter } from "next/navigation";

const REQUEST_TYPES = [
  { value: "feature", label: "New feature" },
  { value: "bug", label: "Bug fix" },
  { value: "architecture", label: "Architecture question" },
  { value: "security", label: "Security concern" },
  { value: "documentation", label: "Documentation" },
  { value: "configuration", label: "Configuration change" },
  { value: "performance", label: "Performance concern" },
  { value: "question", label: "General question" },
];

export function RequestForm() {
  const [state, action, pending] = useActionState(submitRequest, undefined);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.id) {
      formRef.current?.reset();
      router.push(`/inbox/requests/${state.id}`);
    }
  }, [state?.id, router]);

  return (
    <form
      ref={formRef}
      action={action}
      className="flex flex-col gap-3 rounded-lg border border-neutral-700 bg-neutral-900 p-4"
    >
      <input
        name="title"
        type="text"
        required
        placeholder="Short title for this request"
        className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 outline-none focus:border-neutral-500 transition-colors"
      />

      <textarea
        name="goal"
        rows={3}
        required
        placeholder="Describe what you want the company to do. Be specific about the outcome."
        className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 outline-none focus:border-neutral-500 transition-colors resize-none"
      />

      <div className="flex items-center gap-3">
        <select
          name="requestType"
          defaultValue="feature"
          className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-xs text-neutral-300 outline-none focus:border-neutral-500 transition-colors"
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
          className="ml-auto rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-100 disabled:opacity-50 transition-colors"
        >
          {pending ? "Submitting…" : "Submit"}
        </button>
      </div>

      {state?.errors?.title && (
        <p className="text-xs text-red-400">{state.errors.title[0]}</p>
      )}
      {state?.errors?.goal && (
        <p className="text-xs text-red-400">{state.errors.goal[0]}</p>
      )}
      {state?.message && (
        <p className="text-xs text-red-400">{state.message}</p>
      )}
    </form>
  );
}
