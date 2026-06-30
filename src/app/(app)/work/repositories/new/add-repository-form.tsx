"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { Lock, Search, Check } from "lucide-react";
import { addRepository } from "@/app/actions/repository";
import type { GitHubRepoSummary } from "@/lib/github-repository-list";

/** GitHub mark — lucide dropped its brand icons, so we inline it. */
function Github({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.03c-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.17 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.25 2.87.12 3.17.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.62-5.49 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12 12 0 0 0 24 12.5C24 5.87 18.63.5 12 .5Z" />
    </svg>
  );
}

type Tab = "github" | "manual";

export function AddRepositoryForm({
  githubConnected = false,
  githubRepos = [],
  githubError = null,
  workspaces = [],
  defaultWorkspaceId,
}: {
  githubConnected?: boolean;
  githubRepos?: GitHubRepoSummary[];
  githubError?: string | null;
  workspaces?: { id: string; name: string }[];
  defaultWorkspaceId?: string;
}) {
  const [state, action, pending] = useActionState(addRepository, undefined);

  // Default to the GitHub tab only when there's actually a list to pick from.
  const canImport = githubConnected && githubRepos.length > 0;
  const [tab, setTab] = useState<Tab>(canImport ? "github" : "manual");

  // Which workspace the repo lands in. Only surfaced when there's a choice (>1).
  const [workspaceId, setWorkspaceId] = useState(
    defaultWorkspaceId ?? workspaces[0]?.id ?? ""
  );

  // Controlled values for the fields a GitHub repo can prefill.
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [primaryLanguage, setPrimaryLanguage] = useState("");
  const [selectedFullName, setSelectedFullName] = useState<string | null>(null);

  function selectRepo(repo: GitHubRepoSummary) {
    setSelectedFullName(repo.fullName);
    setName(repo.name);
    setUrl(repo.url);
    setDescription(repo.description ?? "");
    setPrimaryLanguage(repo.primaryLanguage ?? "");
  }

  const submitDisabled = pending || (tab === "github" && !selectedFullName);

  return (
    <form action={action} className="flex flex-col gap-4">
      {/* Target workspace — only shown when the company has more than one. */}
      {workspaces.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="workspaceId"
            className="text-xs font-medium text-neutral-400"
          >
            Workspace
          </label>
          <select
            id="workspaceId"
            name="workspaceId"
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-600 transition-colors"
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-neutral-600">
            Which workspace this repository belongs to.
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-neutral-800 bg-neutral-900/50 p-1">
        <TabButton active={tab === "github"} onClick={() => setTab("github")}>
          <Github className="h-3.5 w-3.5" />
          Import from GitHub
        </TabButton>
        <TabButton active={tab === "manual"} onClick={() => setTab("manual")}>
          Enter manually
        </TabButton>
      </div>

      {tab === "github" ? (
        <>
          <GitHubRepoPicker
            connected={githubConnected}
            repos={githubRepos}
            error={githubError}
            selectedFullName={selectedFullName}
            onSelect={selectRepo}
          />
          {/* Selected repo's details ride along as hidden inputs. */}
          <input type="hidden" name="name" value={name} />
          <input type="hidden" name="url" value={url} />
          <input type="hidden" name="description" value={description} />
          <input type="hidden" name="primaryLanguage" value={primaryLanguage} />
          {selectedFullName && (
            <p className="text-xs text-neutral-500">
              Selected{" "}
              <span className="font-medium text-neutral-300">
                {selectedFullName}
              </span>
              . Tech stack and dependencies are detected automatically on
              analysis.
            </p>
          )}
        </>
      ) : (
        <>
          <Field
            id="name"
            name="name"
            label="Repository name"
            required
            placeholder="e.g., engineering-os"
            value={name}
            onChange={setName}
            error={state?.errors?.name?.[0]}
          />

          <Field
            id="url"
            name="url"
            label="Repository URL"
            placeholder="https://github.com/org/repo"
            type="url"
            value={url}
            onChange={setUrl}
            error={state?.errors?.url?.[0]}
          />

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
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this repository contain?"
              className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 outline-none focus:border-neutral-500 transition-colors resize-none"
            />
          </div>

          <Field
            id="primaryLanguage"
            name="primaryLanguage"
            label="Primary language"
            placeholder="e.g., TypeScript"
            value={primaryLanguage}
            onChange={setPrimaryLanguage}
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
        </>
      )}

      {state?.message && (
        <p className="rounded-lg border border-red-900 bg-red-950 px-3 py-2 text-sm text-red-400">
          {state.message}
        </p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={submitDisabled}
          className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-100 disabled:opacity-50 transition-colors"
        >
          {pending ? "Adding…" : "Add repository"}
        </button>
      </div>
    </form>
  );
}

// ─── Tab button ───────────────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? "bg-neutral-800 text-neutral-100"
          : "text-neutral-400 hover:text-neutral-200"
      }`}
    >
      {children}
    </button>
  );
}

// ─── GitHub repository picker ─────────────────────────────────────────────────

function GitHubRepoPicker({
  connected,
  repos,
  error,
  selectedFullName,
  onSelect,
}: {
  connected: boolean;
  repos: GitHubRepoSummary[];
  error: string | null;
  selectedFullName: string | null;
  onSelect: (repo: GitHubRepoSummary) => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return repos;
    return repos.filter((r) => r.fullName.toLowerCase().includes(q));
  }, [repos, query]);

  // Not connected → prompt to connect, with manual entry still available below.
  if (!connected) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-neutral-800 bg-neutral-900/40 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <Github className="h-4 w-4 text-neutral-500" />
          <p className="text-xs text-neutral-400">
            Connect GitHub to pick from your repositories instead of typing the
            URL.
          </p>
        </div>
        <Link
          href="/connections"
          className="shrink-0 rounded-md bg-neutral-800 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:bg-neutral-700 transition-colors"
        >
          Connect GitHub
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-3">
      <div className="mb-2.5 flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-medium text-neutral-300">
          <Github className="h-3.5 w-3.5" />
          Import from GitHub
        </p>
        {repos.length > 0 && (
          <span className="text-[11px] text-neutral-600">
            {repos.length} {repos.length === 1 ? "repo" : "repos"}
          </span>
        )}
      </div>

      {error ? (
        <p className="rounded-md border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-500">
          {error}
        </p>
      ) : repos.length === 0 ? (
        <p className="px-1 py-2 text-xs text-neutral-600">
          No repositories found for the connected account.
        </p>
      ) : (
        <>
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-600" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search repositories…"
              className="w-full rounded-md border border-neutral-700 bg-neutral-900 py-1.5 pl-8 pr-3 text-xs text-neutral-100 placeholder-neutral-600 outline-none focus:border-neutral-500 transition-colors"
            />
          </div>

          <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-1 py-2 text-xs text-neutral-600">
                No repositories match “{query}”.
              </p>
            ) : (
              filtered.map((repo) => {
                const selected = repo.fullName === selectedFullName;
                return (
                  <button
                    key={repo.fullName}
                    type="button"
                    onClick={() => onSelect(repo)}
                    className={`group flex items-center gap-2.5 rounded-md border px-2.5 py-2 text-left transition-colors ${
                      selected
                        ? "border-neutral-600 bg-neutral-800"
                        : "border-transparent hover:bg-neutral-800/60"
                    }`}
                  >
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center">
                      {selected ? (
                        <Check className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <Github className="h-3.5 w-3.5 text-neutral-600" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-xs font-medium text-neutral-200">
                        {repo.fullName}
                        {repo.isPrivate && (
                          <Lock className="h-3 w-3 shrink-0 text-neutral-500" />
                        )}
                      </p>
                      {repo.description && (
                        <p className="mt-0.5 truncate text-[11px] text-neutral-600">
                          {repo.description}
                        </p>
                      )}
                    </div>
                    {repo.primaryLanguage && (
                      <span className="shrink-0 text-[10px] text-neutral-600">
                        {repo.primaryLanguage}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Field ────────────────────────────────────────────────────────────────────

function Field({
  id,
  name,
  label,
  required,
  placeholder,
  type = "text",
  hint,
  error,
  value,
  onChange,
}: {
  id: string;
  name: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  type?: string;
  hint?: string;
  error?: string;
  value?: string;
  onChange?: (value: string) => void;
}) {
  const controlled = value !== undefined && onChange !== undefined;
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
        {...(controlled
          ? { value, onChange: (e) => onChange!(e.target.value) }
          : {})}
        className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-600 transition-colors"
      />
      {hint && <p className="text-[11px] text-neutral-600">{hint}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
