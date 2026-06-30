"use client";

import Lottie from "lottie-react";
import loadingAnimation from "@merittdev/avion/brand/lottie/loading.json";
import { cn } from "@/lib/utils";

/**
 * Avion loading indicator — the canonical seamless "glide + sweep" loop from
 * `@merittdev/avion`. Use for data/sync/processing waits and empty states; use
 * the static {@link BrandMark}/{@link BrandLockup} for chrome that should not
 * animate (sidebar, headers, legal, docs).
 */
export function BrandLoading({
  className,
  label = "Loading",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn("flex items-center justify-center", className)}
    >
      <Lottie
        animationData={loadingAnimation}
        loop
        autoplay
        className="w-24"
      />
      <span className="sr-only">{label}…</span>
    </div>
  );
}
