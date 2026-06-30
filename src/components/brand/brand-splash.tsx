"use client";

import { useEffect, useRef, useState } from "react";
import Lottie, { type LottieRefCurrentProps } from "lottie-react";
import { colors } from "@merittdev/avion/brand";
import splashAnimation from "@merittdev/avion/brand/lottie/splash.json";
import { cn } from "@/lib/utils";

type Phase = "hidden" | "playing" | "fading";

/**
 * Avion launch splash — the canonical one-shot "reveal → brand" animation from
 * `@merittdev/avion`. Plays once per browser session on top of the app, then
 * fades out to reveal the dark workspace underneath.
 *
 * The animation is authored on the light brand canvas (slate reveal → ink
 * fill), so the overlay paints that canvas while it plays. SSR renders nothing
 * (initial phase is "hidden") to avoid a hydration mismatch and a flash for
 * returning visitors who have already seen it this session.
 */
export function BrandSplash({ once = true }: { once?: boolean }) {
  const [phase, setPhase] = useState<Phase>("hidden");
  const lottieRef = useRef<LottieRefCurrentProps>(null);

  useEffect(() => {
    if (once && sessionStorage.getItem("avion-splash-seen")) return;
    setPhase("playing");
  }, [once]);

  function handleComplete() {
    if (once) sessionStorage.setItem("avion-splash-seen", "1");
    setPhase("fading");
  }

  if (phase === "hidden") return null;

  return (
    <div
      aria-hidden
      onTransitionEnd={() => phase === "fading" && setPhase("hidden")}
      className={cn(
        "fixed inset-0 z-[200] flex items-center justify-center transition-opacity duration-500 ease-out",
        phase === "fading" ? "pointer-events-none opacity-0" : "opacity-100",
      )}
      style={{ backgroundColor: colors.canvasLight }}
    >
      <Lottie
        lottieRef={lottieRef}
        animationData={splashAnimation}
        loop={false}
        autoplay
        onComplete={handleComplete}
        className="w-56 max-w-[60vw] sm:w-72"
      />
    </div>
  );
}
