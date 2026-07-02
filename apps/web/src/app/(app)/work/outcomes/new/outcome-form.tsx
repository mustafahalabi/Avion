"use client";

import { useActionState } from "react";
import { submitOutcome, type SubmitOutcomeState } from "@/app/actions/outcomes";

interface Repository {
  id: string;
  name: string;
  primaryLanguage: string | null;
}

interface OutcomeFormProps {
  repositories: Repository[];
}

export function OutcomeForm({ repositories }: OutcomeFormProps) {
  const [state, action, pending] = useActionState<SubmitOutcomeState, FormData>(
    submitOutcome,
    undefined
  );

  return (
    <form action={action} className="flex flex-col gap-5">
      {state?.message && (
        <p className="rounded-md bg-red-950/30 border border-red-900/50 px-3 py-2 text-xs text-red-400">
          {state.message}
        </p>
      )}

      {/* Title */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className="text-xs font-medium text-neutral-300">
          Outcome
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          autoFocus
          placeholder="e.g. Build repository intelligence to understand any codebase"
          className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none"
        />
        {state?.errors?.title?.map((e) => (
          <p key={e} className="text-xs text-red-400">
            {e}
          </p>
        ))}
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="rawRequest"
          className="text-xs font-medium text-neutral-300"
        >
          Description
          <span className="ml-1 text-neutral-600 font-normal">
            — What should be built and why?
          </span>
        </label>
        <textarea
          id="rawRequest"
          name="rawRequest"
          required
          rows={5}
          placeholder="Describe the desired outcome in plain language. What problem does it solve? What does success look like?"
          className="resize-y rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-neutral-500 focus:outline-none"
        />
        {state?.errors?.rawRequest?.map((e) => (
          <p key={e} className="text-xs text-red-400">
            {e}
          </p>
        ))}
      </div>

      {/* Repository (optional) */}
      {repositories.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="repositoryId"
            className="text-xs font-medium text-neutral-300"
          >
            Repository
            <span className="ml-1 text-neutral-600 font-normal">
              — optional
            </span>
          </label>
          <select
            id="repositoryId"
            name="repositoryId"
            defaultValue=""
            className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none"
          >
            <option value="">No specific repository</option>
            {repositories.map((repo) => (
              <option key={repo.id} value={repo.id}>
                {repo.name}
                {repo.primaryLanguage ? ` · ${repo.primaryLanguage}` : ""}
              </option>
            ))}
          </select>
          {state?.errors?.repositoryId?.map((e) => (
            <p key={e} className="text-xs text-red-400">
              {e}
            </p>
          ))}
        </div>
      )}

      {/* Priority */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="priority"
          className="text-xs font-medium text-neutral-300"
        >
          Priority
        </label>
        <select
          id="priority"
          name="priority"
          defaultValue="medium"
          className="rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-100 focus:border-neutral-500 focus:outline-none"
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-white px-4 py-2 text-xs font-medium text-neutral-900 hover:bg-neutral-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {pending ? "Submitting…" : "Submit outcome"}
        </button>
        <p className="text-[11px] text-neutral-700">
          A planning draft will be generated. No work records are created yet.
        </p>
      </div>
    </form>
  );
}
