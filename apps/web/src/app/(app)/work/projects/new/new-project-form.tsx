"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { Boxes, FolderGit2, Plus } from "lucide-react";
import { createProject } from "@/app/actions/work";

export type ProjectRepoOption = {
  id: string;
  name: string;
  workspaceId: string;
  workspaceName: string;
};

export function NewProjectForm({
  repos,
  defaultRepositoryId,
}: {
  repos: ProjectRepoOption[];
  defaultRepositoryId?: string;
}) {
  const [state, action, pending] = useActionState(createProject, undefined);

  const initialRepo =
    repos.find((r) => r.id === defaultRepositoryId)?.id ?? repos[0]?.id ?? "";
  const [repositoryId, setRepositoryId] = useState(initialRepo);

  // Group repos by workspace for the picker's optgroups + the inferred-workspace hint.
  const groups = useMemo(() => {
    const byWorkspace = new Map<string, ProjectRepoOption[]>();
    for (const repo of repos) {
      const list = byWorkspace.get(repo.workspaceName) ?? [];
      list.push(repo);
      byWorkspace.set(repo.workspaceName, list);
    }
    return [...byWorkspace.entries()];
  }, [repos]);

  const selectedWorkspace = repos.find((r) => r.id === repositoryId)?.workspaceName;

  // No repositories anywhere — a project needs one, so route the user to add one.
  if (repos.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-neutral-800 py-12 text-center">
        <FolderGit2 className="h-6 w-6 text-neutral-600" />
        <div>
          <p className="text-sm font-medium text-neutral-400">
            Add a repository first
          </p>
          <p className="mt-0.5 text-xs text-neutral-600">
            A project targets a repository. Connect one, then come back to create
            your project.
          </p>
        </div>
        <Link
          href="/work/repositories/new"
          className="mt-1 flex items-center gap-1.5 rounded-md bg-white px-3 py-1.5 text-xs font-medium text-neutral-900 hover:bg-neutral-100 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          Add repository
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-xs font-medium text-neutral-400">
          Project name <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          autoFocus
          placeholder="e.g., Authentication System"
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-600 transition-colors"
        />
        {state?.errors?.name && (
          <p className="text-xs text-red-400">{state.errors.name[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="repositoryId"
          className="text-xs font-medium text-neutral-400"
        >
          Repository <span className="text-red-500">*</span>
        </label>
        <select
          id="repositoryId"
          name="repositoryId"
          required
          value={repositoryId}
          onChange={(e) => setRepositoryId(e.target.value)}
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-600 transition-colors"
        >
          {groups.map(([workspaceName, workspaceRepos]) => (
            <optgroup key={workspaceName} label={workspaceName}>
              {workspaceRepos.map((repo) => (
                <option key={repo.id} value={repo.id}>
                  {repo.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <div className="flex items-center justify-between">
          {selectedWorkspace ? (
            <p className="flex items-center gap-1.5 text-[11px] text-neutral-500">
              <Boxes className="h-3 w-3" />
              Lives in workspace{" "}
              <span className="font-medium text-neutral-300">
                {selectedWorkspace}
              </span>
            </p>
          ) : (
            <span />
          )}
          <Link
            href="/work/repositories/new"
            className="flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            <Plus className="h-3 w-3" />
            Add repository
          </Link>
        </div>
        {state?.errors?.repositoryId && (
          <p className="text-xs text-red-400">{state.errors.repositoryId[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="description"
          className="text-xs font-medium text-neutral-400"
        >
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          placeholder="What is this project delivering?"
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-600 transition-colors resize-none"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="status" className="text-xs font-medium text-neutral-400">
          Initial status
        </label>
        <select
          id="status"
          name="status"
          defaultValue="planning"
          className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-600 transition-colors"
        >
          <option value="planning">Planning</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
        </select>
      </div>

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
          {pending ? "Creating…" : "Create project"}
        </button>
      </div>
    </form>
  );
}
