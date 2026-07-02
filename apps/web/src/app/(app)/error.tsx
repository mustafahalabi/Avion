"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center p-12">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-red-900 bg-red-950">
          <AlertCircle className="h-5 w-5 text-red-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-neutral-200">
            Something went wrong
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            {error.message || "An unexpected error occurred."}
          </p>
        </div>
        <button
          onClick={reset}
          className="rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-sm text-neutral-200 transition-colors hover:bg-neutral-700"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
