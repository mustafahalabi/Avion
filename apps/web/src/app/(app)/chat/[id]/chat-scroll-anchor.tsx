"use client";

import { useEffect, useRef } from "react";

/**
 * Invisible anchor at the bottom of the message thread. Whenever the message
 * count changes (a new message lands after `router.refresh()`), it scrolls the
 * thread to the latest message — so the conversation always shows the newest
 * turn instead of leaving it below the fold.
 */
export function ChatScrollAnchor({ count }: { count: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [count]);

  return <div ref={ref} aria-hidden />;
}
