"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Boxes,
  FolderGit2,
  Layers,
  ChevronsUpDown,
  Check,
  Search,
  Plus,
  Settings2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { workspaceBadgeClasses } from "@/lib/workspace-badge";
import { writeActiveWorkspaceCookie } from "@/lib/active-workspace-cookie";
import type { SwitcherWorkspace } from "@/lib/active-workspace";

interface Props {
  workspaces: SwitcherWorkspace[];
  /** Cookie-resolved active workspace (server source of truth). URL wins below. */
  activeWorkspaceId: string | null;
}

export function WorkspaceSwitcher({ workspaces, activeWorkspaceId }: Props) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const ref = useRef<HTMLDivElement>(null);

  // URL context wins: /w/[slug]/... means that workspace is active.
  const urlSlug = useMemo(() => {
    const parts = pathname.split("/").filter(Boolean);
    return parts[0] === "w" ? parts[1] : undefined;
  }, [pathname]);

  const active =
    workspaces.find((w) => w.slug === urlSlug) ??
    workspaces.find((w) => w.id === activeWorkspaceId) ??
    workspaces[0] ??
    null;

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 40);
  }, [open]);

  function go(href: string, workspaceId?: string) {
    if (workspaceId) writeActiveWorkspaceCookie(workspaceId);
    setOpen(false);
    setQuery("");
    router.push(href);
    router.refresh();
  }

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return workspaces;
    return workspaces
      .map((w) => {
        const wsMatch = w.name.toLowerCase().includes(q);
        if (wsMatch) return w;
        const repositories = w.repositories.filter((r) =>
          r.name.toLowerCase().includes(q)
        );
        const projects = w.projects.filter((p) =>
          p.name.toLowerCase().includes(q)
        );
        if (repositories.length || projects.length)
          return { ...w, repositories, projects };
        return null;
      })
      .filter((w): w is SwitcherWorkspace => w !== null);
  }, [workspaces, q]);

  return (
    <div ref={ref} className="relative px-2 py-2">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Switch workspace"
        className="flex w-full items-center gap-2.5 rounded-md border border-neutral-800 bg-neutral-900 px-2 py-1.5 text-left transition-colors hover:border-neutral-700 hover:bg-neutral-800"
      >
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border",
            active ? workspaceBadgeClasses(active.id) : "border-neutral-700"
          )}
        >
          <Boxes className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold text-neutral-100">
            {active ? active.name : "No workspace"}
          </span>
          <span className="block truncate text-[10px] text-neutral-500">
            {active
              ? `${active.repositories.length} repo${active.repositories.length !== 1 ? "s" : ""} · ${active.projects.length} project${active.projects.length !== 1 ? "s" : ""}`
              : "Create one to get started"}
          </span>
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
      </button>

      {/* Popover */}
      {open && (
        <div className="absolute left-2 right-2 top-full z-50 mt-1 overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900 shadow-xl">
          <div className="flex h-9 items-center gap-2 border-b border-neutral-800 px-2.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search workspaces…"
              className="w-full bg-transparent text-xs text-neutral-100 placeholder:text-neutral-600 focus:outline-none"
            />
          </div>

          <div className="max-h-[55vh] overflow-y-auto py-1.5">
            {filtered.length === 0 ? (
              <p className="px-3 py-5 text-center text-[11px] text-neutral-600">
                {q ? "No matches" : "No workspaces yet"}
              </p>
            ) : (
              filtered.map((w) => {
                const isActive = w.id === active?.id;
                return (
                  <div key={w.id} className="mb-1 last:mb-0">
                    <button
                      type="button"
                      onClick={() => go(`/w/${w.slug}`, w.id)}
                      className={cn(
                        "flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-neutral-800",
                        isActive && "bg-neutral-800/60"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded border",
                          workspaceBadgeClasses(w.id)
                        )}
                      >
                        <Boxes className="h-3 w-3" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-neutral-200">
                        {w.name}
                      </span>
                      {isActive && (
                        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      )}
                    </button>

                    {/* Repos + projects under the workspace */}
                    {(w.repositories.length > 0 || w.projects.length > 0) && (
                      <div className="ml-3 border-l border-neutral-800 pl-1.5">
                        {w.repositories.map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() =>
                              go(`/w/${w.slug}/repositories/${r.id}`, w.id)
                            }
                            className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px] text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-200"
                          >
                            <FolderGit2 className="h-3 w-3 shrink-0 text-neutral-600" />
                            <span className="truncate">{r.name}</span>
                          </button>
                        ))}
                        {w.projects.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() =>
                              go(`/w/${w.slug}/projects/${p.id}`, w.id)
                            }
                            className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-[11px] text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-200"
                          >
                            <Layers className="h-3 w-3 shrink-0 text-neutral-600" />
                            <span className="truncate">{p.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer actions */}
          <div className="border-t border-neutral-800 p-1">
            <button
              type="button"
              onClick={() => go("/work/workspaces/new")}
              className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-[11px] font-medium text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-neutral-100"
            >
              <Plus className="h-3.5 w-3.5" />
              New workspace
            </button>
            <button
              type="button"
              onClick={() => go("/work/workspaces")}
              className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-[11px] text-neutral-500 transition-colors hover:bg-neutral-800 hover:text-neutral-300"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Manage workspaces
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
