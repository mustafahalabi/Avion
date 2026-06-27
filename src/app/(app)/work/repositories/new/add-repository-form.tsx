"use client";

import { useActionState } from "react";
import { addRepository } from "@/app/actions/repository";

export function AddRepositoryForm() {
  const [state, action, pending] = useActionState(addRepository, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <Field
        id="name"
        name="name"
        label="Repository name"
        required
        placeholder="e.g., engineering-os"
        error={state?.errors?.name?.[0]}
      />

      <Field
        id="url"
        name="url"
        label="Repository URL"
        placeholder="https://github.com/org/repo"
        type="url"
        error={state?.errors?.url?.[0]}
      />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="text-xs font-medium text-neutral-400">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={2}
          placeholder="What does this repository contain?"
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 outline-none focus:border-neutral-500 transition-colors resize-none"
        />
      </div>

      <Field
        id="primaryLanguage"
        name="primaryLanguage"
        label="Primary language"
        placeholder="e.g., TypeScript"
      />

      <Field
        id="techStack"
        name="techStack"
        label="Tech stack"
        placeholder="Next.js, React, Tailwind CSS, Prisma (comma-separated)"
        hint="Separate items with commas"
      />

      <Field
        id="frameworks"
        name="frameworks"
        label="Frameworks & libraries"
        placeholder="Next.js, React, Tailwind CSS, Zod (comma-separated)"
        hint="Separate items with commas"
      />

      <Field
        id="dependencies"
        name="dependencies"
        label="Key dependencies"
        placeholder="prisma, clerk, tailwindcss (comma-separated)"
        hint="Separate items with commas"
      />

      <Field
        id="importantFiles"
        name="importantFiles"
        label="Important files"
        placeholder="prisma/schema.prisma, src/auth.ts, next.config.ts (comma-separated)"
        hint="Key configuration and entry files"
      />

      {state?.message && (
        <p className="rounded-lg border border-red-900 bg-red-950 px-3 py-2 text-sm text-red-400">
          {state.message}
        </p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-100 disabled:opacity-50 transition-colors"
        >
          {pending ? "Adding…" : "Add repository"}
        </button>
      </div>
    </form>
  );
}

function Field({
  id,
  name,
  label,
  required,
  placeholder,
  type = "text",
  hint,
  error,
}: {
  id: string;
  name: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  type?: string;
  hint?: string;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-neutral-400">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-600 transition-colors"
      />
      {hint && <p className="text-[11px] text-neutral-600">{hint}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
