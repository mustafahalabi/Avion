"use client";

import { useState, useEffect, useCallback } from "react";
import type { RunModeConfig } from "@/lib/run-mode";
import { DEFAULT_RUN_MODE_CONFIG } from "@/lib/run-mode";

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
 * SSR-safe: `loaded` starts as false so callers can avoid rendering
 * config-dependent UI until the client has hydrated.
 */
export function useRunModeSettings(): UseRunModeSettingsReturn {
  const [config, setConfig] = useState<RunModeConfig>(DEFAULT_RUN_MODE_CONFIG);
  const [loaded, setLoaded] = useState(false);

  // Read stored config once on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<RunModeConfig>;
        setConfig((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // Corrupt storage — silently ignore and keep default
    }
    setLoaded(true);
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
