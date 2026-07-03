"use client";

import { useEffect, useRef, useState } from "react";
import {
  ExternalLink,
  Loader2,
  Play,
  Square,
  TriangleAlert,
} from "lucide-react";
import {
  startPreview,
  stopPreview,
  getPreviewStatus,
  type PreviewStatus,
} from "@/app/actions/preview";
import { cn } from "@/lib/utils";

/** Statuses where the service still owns the preview (keep polling). */
const ACTIVE_STATUSES = ["queued", "starting", "installing", "running", "stopping"];

const STATUS_STYLES: Record<string, string> = {
  running: "bg-emerald-950 text-emerald-400 border-emerald-900",
  queued: "bg-blue-950 text-blue-400 border-blue-900",
  starting: "bg-blue-950 text-blue-400 border-blue-900",
  installing: "bg-amber-950 text-amber-400 border-amber-900",
  stopping: "bg-amber-950 text-amber-400 border-amber-900",
  stopped: "bg-neutral-900 text-neutral-500 border-neutral-700",
  failed: "bg-red-950 text-red-400 border-red-900",
  crashed: "bg-red-950 text-red-400 border-red-900",
};

const STATUS_LABEL: Record<string, string> = {
  queued: "Queued",
  starting: "Starting",
  installing: "Installing deps",
  running: "Running",
  stopping: "Stopping",
  stopped: "Stopped",
  failed: "Failed",
  crashed: "Crashed",
};

function isActive(status: string): boolean {
  return ACTIVE_STATUSES.includes(status);
}

export function PreviewPanel({
  repositoryId,
  initial,
  enabled,
}: {
  repositoryId: string;
  initial: PreviewStatus | null;
  enabled: boolean;
}) {
  const [preview, setPreview] = useState<PreviewStatus | null>(initial);
  const [envVars, setEnvVars] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const logsRef = useRef<HTMLPreElement>(null);

  const status = preview?.status ?? "idle";
  const active = isActive(status);
  const running = status === "running";

  // Poll status + logs while the preview is active; stop on terminal states.
  useEffect(() => {
    if (!preview || !isActive(preview.status)) return;
    const previewId = preview.id;
    let cancelled = false;
    const id = setInterval(async () => {
      const next = await getPreviewStatus({ previewId });
      if (!cancelled && next) setPreview(next);
    }, 1500);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [preview?.id, preview?.status]);

  // Keep the log view pinned to the newest output.
  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight;
  }, [preview?.logs]);

  async function handleStart() {
    setBusy(true);
    setError(null);
    const res = await startPreview({ repositoryId, envVars });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    const s = await getPreviewStatus({ previewId: res.previewId });
    setPreview(
      s ?? {
        id: res.previewId,
        status: "queued",
        desiredState: "running",
        previewUrl: null,
        port: null,
        branch: null,
        command: null,
        logs: "",
        errorMessage: null,
        updatedAt: new Date().toISOString(),
      }
    );
  }

  async function handleStop() {
    if (!preview) return;
    setBusy(true);
    await stopPreview({ previewId: preview.id });
    setBusy(false);
    // The poller will observe the status move to stopping → stopped.
    setPreview({ ...preview, status: "stopping", desiredState: "stopped" });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
            Live preview
          </h3>
          <p className="mt-1 text-xs text-neutral-500">
            Runs your project&apos;s default branch locally so you can interact with it.
          </p>
        </div>
        {preview && (
          <span
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
              STATUS_STYLES[status] ?? STATUS_STYLES.stopped
            )}
          >
            {active && <Loader2 className="h-3 w-3 animate-spin" />}
            {STATUS_LABEL[status] ?? status}
            {preview.branch ? ` · ${preview.branch}` : ""}
          </span>
        )}
      </div>

      {!enabled && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-900 bg-amber-950/40 p-3">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <p className="text-xs leading-relaxed text-amber-300/90">
            Live preview is turned off on this deployment (
            <code className="rounded bg-black/30 px-1">PREVIEW_DISABLED</code>).
          </p>
        </div>
      )}

      {/* Controls: env + Start when idle/terminal; Stop while active. */}
      {!active ? (
        <div className="flex flex-col gap-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            Environment variables{" "}
            <span className="font-normal normal-case text-neutral-600">
              (optional, one <code>KEY=VALUE</code> per line)
            </span>
          </label>
          <textarea
            value={envVars}
            onChange={(e) => setEnvVars(e.target.value)}
            placeholder={"DATABASE_URL=postgres://...\nNEXT_PUBLIC_API_URL=http://localhost:3000"}
            rows={4}
            spellCheck={false}
            className="w-full resize-y rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 font-mono text-xs text-neutral-200 placeholder:text-neutral-700 focus:border-neutral-600 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleStart}
            disabled={busy || !enabled}
            className="inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-md border border-emerald-800 bg-emerald-950 px-4 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Start preview
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <p className="truncate text-xs text-neutral-400">
            {running && preview?.previewUrl
              ? `Serving at ${preview.previewUrl}`
              : "Preparing your app…"}
          </p>
          <button
            type="button"
            onClick={handleStop}
            disabled={busy}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-md border border-red-900 bg-red-950 px-4 text-sm font-medium text-red-300 transition-colors hover:bg-red-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Square className="h-4 w-4" />
            Stop
          </button>
        </div>
      )}

      {error && (
        <p className="rounded-md border border-red-900 bg-red-950/50 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}
      {preview?.errorMessage && !error && (
        <p className="rounded-md border border-red-900 bg-red-950/50 px-3 py-2 text-xs text-red-300 whitespace-pre-wrap">
          {preview.errorMessage}
        </p>
      )}

      {/* The running app, embedded. */}
      {running && preview?.previewUrl && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              Preview
            </span>
            <a
              href={preview.previewUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-200"
            >
              <ExternalLink className="h-3 w-3" />
              Open in new tab
            </a>
          </div>
          <iframe
            src={preview.previewUrl}
            title="Live preview"
            className="h-[600px] w-full rounded-md border border-neutral-800 bg-white"
          />
          <p className="text-[11px] text-neutral-600">
            Blank frame? Some apps block embedding — use “Open in new tab”.
          </p>
        </div>
      )}

      {/* Logs. */}
      {preview && preview.logs && (
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            Logs
          </span>
          <pre
            ref={logsRef}
            className="max-h-72 overflow-auto rounded-md border border-neutral-800 bg-neutral-950 p-3 font-mono text-[11px] leading-relaxed text-neutral-400 whitespace-pre-wrap"
          >
            {preview.logs}
          </pre>
        </div>
      )}
    </div>
  );
}
