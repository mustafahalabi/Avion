"use client";

import { useActionState, useEffect } from "react";
import { createRelease } from "@/app/actions/releases";
import { useRouter } from "next/navigation";
import Link from "next/link";

export function NewReleaseForm() {
  const [state, action, pending] = useActionState(createRelease, undefined);
  const router = useRouter();

  useEffect(() => {
    if (state && "success" in state) {
      router.push(`/work/releases/${state.id}`);
    }
  }, [state, router]);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-neutral-400">
          Version <span className="text-red-500">*</span>
        </label>
        <input
          name="version"
          type="text"
          required
          placeholder="v1.0.0"
          className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 font-mono outline-none focus:border-neutral-500 transition-colors"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-neutral-400">
          Title <span className="text-neutral-700">(optional)</span>
        </label>
        <input
          name="title"
          type="text"
          placeholder="Initial launch"
          className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 outline-none focus:border-neutral-500 transition-colors"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-neutral-400">
          Description <span className="text-neutral-700">(optional)</span>
        </label>
        <textarea
          name="description"
          rows={3}
          placeholder="What does this release include?"
          className="rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 outline-none focus:border-neutral-500 transition-colors resize-none"
        />
      </div>

      {state && "error" in state && (
        <p className="text-xs text-red-400">{state.error}</p>
      )}

      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-100 disabled:opacity-50 transition-colors"
        >
          {pending ? "Creating…" : "Create release"}
        </button>
        <Link
          href="/work/releases"
          className="rounded-lg border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-400 hover:bg-neutral-800 transition-colors"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
