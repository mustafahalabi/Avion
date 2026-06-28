"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ClipboardCheck, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  brief: string;
}

export function ReviewBriefSection({ brief }: Props) {
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(brief);
      setCopied(true);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable — no-op
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-500">
          <ClipboardCheck className="h-3 w-3" />
          Codex Review Brief
        </h3>
        <button
          type="button"
          onClick={handleCopy}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            copied
              ? "bg-emerald-900/40 text-emerald-400"
              : "bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-neutral-200"
          )}
        >
          {copied ? (
            <>
              <Check className="h-3 w-3" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              Copy Brief
            </>
          )}
        </button>
      </div>

      <div className="mt-3">
        <pre className="rounded-lg border border-neutral-800 bg-neutral-900/60 p-4 text-xs text-neutral-300 leading-relaxed whitespace-pre-wrap overflow-auto max-h-128 font-mono">
          {brief}
        </pre>
      </div>
    </section>
  );
}
