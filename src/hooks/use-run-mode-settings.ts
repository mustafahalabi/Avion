"use client";

import { useState, useEffect, useCallback, useSyncExternalStore } from "react";
import type { RunModeConfig } from "@/lib/run-mode";
import { DEFAULT_RUN_MODE_CONFIG, getRunModeConfig } from "@/lib/run-mode";

const STORAGE_KEY = "engineering-os:run-mode-config";

/** No-op subscribe — the hydration flag never changes after mount. */
function noopSubscribe(): () => void {
  return () => {};
}

/**
 * Reads the persisted RunModeConfig from localStorage, merged over the seed.
 *
 * SSR-safe: returns the seed unchanged on the server (no `window`) and when
 * localStorage is unavailable or the stored value is corrupt.
 *
 * @param seed - Fallback config (autonomy-level seed or hard-coded default).
 * @returns The stored config merged over the seed, or the seed.
 */
function readStoredConfig(seed: RunModeConfig): RunModeConfig {
  if (typeof window === "undefined") return seed;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<RunModeConfig>;
      return { ...seed, ...parsed };
    }
  } catch {
    // localStorage unavailable or corrupt — fall back to the seed
  }
  return seed;
}

export interface UseRunModeSettingsReturn {
  config: RunModeConfig;
  updateConfig: (updates: Partial<RunModeConfig>) => void;
  /** False on first render (server-safe), true once localStorage has been read. */
  loaded: boolean;
}

/**
 * Reads and persists RunModeConfig from localStorage.
 *
 * On first use (no stored value) the config is seeded from `autonomyLevel`
 * via `getRunModeConfig`, so new users get a sensible default that matches
 * their company's autonomy setting instead of a hard-coded fallback.
 *
 * SSR-safe: `loaded` starts as false so callers can suppress config-
 * dependent UI until the client has hydrated.
 */
export function useRunModeSettings(autonomyLevel?: string): UseRunModeSettingsReturn {
  const seedConfig = autonomyLevel
    ? getRunModeConfig(autonomyLevel)
    : DEFAULT_RUN_MODE_CONFIG;

  // Read the stored config in the lazy initializer rather than via setState in
  // an effect. The `typeof window` guard keeps it SSR-safe (server returns the
  // seed), and `loaded` stays false until mount so config-dependent UI is
  // suppressed during the first client render — avoiding any hydration mismatch.
  const [config, setConfig] = useState<RunModeConfig>(() =>
    readStoredConfig(seedConfig)
  );

  // SSR-safe "has the client mounted" flag without calling setState in an
  // effect: `false` on the server and during the first (hydrating) client
  // render, then `true`. Callers suppress config-dependent UI until `loaded`.
  const loaded = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );

  // On mount, persist the seed when nothing is stored yet. Side effect only —
  // no setState here (config was already seeded from storage in the initializer).
  useEffect(() => {
    try {
      if (autonomyLevel && localStorage.getItem(STORAGE_KEY) === null) {
        // No stored value yet — persist the seeded defaults so subsequent
        // loads don't recalculate from autonomy level after the user may
        // have changed their company setting.
        localStorage.setItem(STORAGE_KEY, JSON.stringify(seedConfig));
      }
    } catch {
      // localStorage unavailable or corrupt — keep the in-memory seed
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateConfig = useCallback((updates: Partial<RunModeConfig>) => {
    setConfig((prev) => {
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Storage full or unavailable — state still updates in-memory
      }
      return next;
    });
  }, []);

  return { config, updateConfig, loaded };
}
