"use client";

import { useCallback, useState } from "react";
import { Copy, Check } from "lucide-react";

interface Props {
  markdown: string;
}

export function CeoReleaseSummaryPanel({ markdown }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [markdown]);

  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50">
      <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          CEO Release Summary
        </h3>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-800 px-2.5 py-1.5 text-xs font-medium text-neutral-300 hover:bg-neutral-700 hover:text-neutral-100 transition-colors"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              Copy summary
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-xs text-neutral-300 leading-relaxed whitespace-pre-wrap font-mono">
        {markdown}
      </pre>
    </section>
  );
}
