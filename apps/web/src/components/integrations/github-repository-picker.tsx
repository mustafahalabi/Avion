"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Check, Loader2, Lock, Plus, Search } from "lucide-react";
import {
  createAndImportRepository,
  importRepository,
  loadGitHubRepositories,
  type GitHubRepoPickerItem,
} from "@/app/actions/integration-resources";
import { cn } from "@/lib/utils";

/**
 * Lets the CEO select an existing GitHub repository (search + import) or create
 * a brand-new one, then registers it as a Repository record. Backed by the
 * idempotent import/create server actions. When GitHub isn't connected / lacks
 * the `repo` scope, prompts a (re)connect instead of showing a broken list.
 */
export function GitHubRepositoryPicker({
  returnTo = "/onboarding",
}: {
  returnTo?: string;
}) {
  const router = useRouter();
  const [repos, setRepos] = useState<GitHubRepoPickerItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [filter, setFilter] = useState("");
  const [busyUrl, setBusyUrl] = useState<string | null>(null);
  const [importedUrls, setImportedUrls] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrivate, setNewPrivate] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // State updates happen only AFTER the await, so the effect body itself never
  // calls setState synchronously (avoids cascading-render churn on mount).
  const load = useCallback(async () => {
    const result = await loadGitHubRepositories();
    if (result.ok) {
      setRepos(result.repositories);
      setNeedsReauth(false);
      setError(null);
    } else {
      setRepos(null);
      setError(result.error);
      setNeedsReauth(result.needsReauth);
    }
    setLoading(false);
  }, []);

  // Initial fetch on mount. Inlined (not `load()`) so every setState is clearly
  // after the await — the effect body never sets state synchronously.
  useEffect(() => {
    let active = true;
    void (async () => {
      const result = await loadGitHubRepositories();
      if (!active) return;
      if (result.ok) {
        setRepos(result.repositories);
        setNeedsReauth(false);
        setError(null);
      } else {
        setRepos(null);
        setError(result.error);
        setNeedsReauth(result.needsReauth);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  async function handleImport(repo: GitHubRepoPickerItem) {
    setBusyUrl(repo.url);
    setError(null);
    const result = await importRepository({
      name: repo.name,
      url: repo.url,
      description: repo.description,
      primaryLanguage: repo.primaryLanguage,
    });
    setBusyUrl(null);
    if ("success" in result) {
      setImportedUrls((prev) => new Set(prev).add(repo.url));
      startTransition(() => router.refresh());
    } else {
      setError(result.error);
      if (result.needsReauth) setNeedsReauth(true);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError(null);
    const result = await createAndImportRepository({
      name: newName.trim(),
      private: newPrivate,
    });
    setCreating(false);
    if ("success" in result) {
      setNewName("");
      setShowCreate(false);
      startTransition(() => router.refresh());
      setLoading(true);
      void load();
    } else {
      setCreateError(result.error);
      if (result.needsReauth) setNeedsReauth(true);
    }
  }

  const reconnectHref = `/api/integrations/github/start?returnTo=${encodeURIComponent(
    returnTo
  )}`;

  if (needsReauth) {
    return (
      <div className="rounded-xl border border-amber-900/40 bg-amber-950/10 px-4 py-4">
        <p className="text-xs text-amber-300">
          {error ?? "Connect GitHub to choose a repository."}
        </p>
        <a
          href={reconnectHref}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-medium text-neutral-900 transition-colors hover:bg-neutral-100"
        >
          Connect GitHub
          <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
      </div>
    );
  }

  const filtered = (repos ?? []).filter((r) =>
    r.fullName.toLowerCase().includes(filter.trim().toLowerCase())
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Search + create toggle */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-600" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search repositories…"
            className="w-full rounded-lg border border-neutral-800 bg-neutral-900 py-2 pl-8 pr-3 text-xs text-neutral-100 placeholder-neutral-600 outline-none focus:border-neutral-600"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs font-medium text-neutral-300 transition-colors hover:border-neutral-700"
        >
          <Plus className="h-3.5 w-3.5" />
          New
        </button>
      </div>

      {/* Create-new form */}
      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4"
        >
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="new-repository-name"
            className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-100 placeholder-neutral-600 outline-none focus:border-neutral-600"
          />
          <label className="flex items-center gap-2 text-xs text-neutral-400">
            <input
              type="checkbox"
              checked={newPrivate}
              onChange={(e) => setNewPrivate(e.target.checked)}
              className="h-3.5 w-3.5 accent-white"
            />
            Private repository
          </label>
          {createError && <p className="text-xs text-red-400">{createError}</p>}
          <button
            type="submit"
            disabled={creating || !newName.trim()}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-medium text-neutral-900 transition-colors hover:bg-neutral-100 disabled:opacity-50"
          >
            {creating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Create &amp; add repository
          </button>
        </form>
      )}

      {error && !needsReauth && <p className="text-xs text-red-400">{error}</p>}

      {/* Repo list */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-xs text-neutral-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading repositories…
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-6 text-center text-xs text-neutral-600">
          No repositories found.
        </p>
      ) : (
        <ul className="flex max-h-80 flex-col gap-1.5 overflow-auto">
          {filtered.map((repo) => {
            const imported = repo.alreadyImported || importedUrls.has(repo.url);
            const busy = busyUrl === repo.url;
            return (
              <li
                key={repo.fullName}
                className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-xs font-medium text-neutral-200">
                      {repo.fullName}
                    </p>
                    {repo.private && (
                      <Lock className="h-3 w-3 shrink-0 text-neutral-600" />
                    )}
                  </div>
                  {repo.description && (
                    <p className="mt-0.5 truncate text-[11px] text-neutral-600">
                      {repo.description}
                    </p>
                  )}
                </div>
                {imported ? (
                  <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-emerald-400">
                    <Check className="h-3.5 w-3.5" />
                    Added
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleImport(repo)}
                    disabled={busy}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-lg border border-neutral-700 px-2.5 py-1.5 text-[11px] font-medium text-neutral-200 transition-colors hover:border-neutral-500 disabled:opacity-50"
                    )}
                  >
                    {busy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      "Add"
                    )}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
