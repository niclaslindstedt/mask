// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useCallback } from "react";

import { useLocalStorageState } from "@niclaslindstedt/oss-framework/hooks";

import type { PlaceholderStyle } from "../generic/placeholders.ts";
import { ALL_DETECTORS_ON, type DetectorId } from "./detectors/index.ts";

// The app's own (non-theme) settings — how the side menu opens, developer
// mode, log capture, the default placeholder style, and which built-in
// detectors run. Persisted to localStorage so a reload keeps the choices.
// (The active *language* is owned by the framework i18n runtime.)

export type MenuMode = "swipe" | "button";

export type AppSettings = {
  menuMode: MenuMode;
  devMode: boolean;
  captureLogs: boolean;
  /** The placeholder style a project uses unless it overrides it. */
  placeholderStyle: PlaceholderStyle;
  detectors: Record<DetectorId, boolean>;
};

export const DEFAULT_SETTINGS: AppSettings = {
  menuMode: "button",
  devMode: false,
  captureLogs: false,
  placeholderStyle: "kindNumber",
  detectors: ALL_DETECTORS_ON,
};

const STORAGE_KEY = "mask:settings";

function parseSettings(raw: string): AppSettings {
  const parsed = JSON.parse(raw) as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return DEFAULT_SETTINGS;
  }
  const stored = parsed as Partial<AppSettings>;
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    detectors: { ...ALL_DETECTORS_ON, ...(stored.detectors ?? {}) },
  };
}

export function useAppSettings() {
  const [settings, setSettings] = useLocalStorageState<AppSettings>(
    STORAGE_KEY,
    DEFAULT_SETTINGS,
    { parse: parseSettings },
  );

  const update = useCallback(
    <K extends keyof AppSettings>(key: K, value: AppSettings[K]) =>
      setSettings((prev) => ({ ...prev, [key]: value })),
    [setSettings],
  );

  const reset = useCallback(() => setSettings(DEFAULT_SETTINGS), [setSettings]);

  return { settings, update, reset, setSettings };
}
