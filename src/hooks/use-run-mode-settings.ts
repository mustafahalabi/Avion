"use client";

import { useState, useEffect, useCallback } from "react";
import type { RunModeConfig } from "@/lib/run-mode";
import { DEFAULT_RUN_MODE_CONFIG, getRunModeConfig } from "@/lib/run-mode";

const STORAGE_KEY = "engineering-os:run-mode-config";

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

  const [config, setConfig] = useState<RunModeConfig>(seedConfig);
  const [loaded, setLoaded] = useState(false);

  // Read stored config once on mount; fall back to the autonomy-level seed
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<RunModeConfig>;
        setConfig((prev) => ({ ...prev, ...parsed }));
      } else if (autonomyLevel) {
        // No stored value yet — persist the seeded defaults so subsequent
        // loads don't recalculate from autonomy level after the user may
        // have changed their company setting.
        localStorage.setItem(STORAGE_KEY, JSON.stringify(seedConfig));
      }
    } catch {
      // localStorage unavailable or corrupt — keep the in-memory seed
    }
    setLoaded(true);
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
