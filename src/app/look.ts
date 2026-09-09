// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  DEFAULT_CUSTOM_THEME_COLORS_DARK,
  DEFAULT_THEME_APPEARANCE,
  type ThemeAppearance,
} from "@niclaslindstedt/oss-framework/theme";

// The look the app boots in — a Custom theme seeded from the dark palette
// with near-black surfaces and an amber accent (the "redacted" colour, and
// distinct from the sibling apps' green). The Appearance settings tab still
// swaps to any preset; the global UI style keeps the framework defaults.
export const APP_LOOK: ThemeAppearance = {
  ...DEFAULT_THEME_APPEARANCE,
  theme: "custom",
  customTheme: {
    colors: {
      ...DEFAULT_CUSTOM_THEME_COLORS_DARK,
      pageBg: "#000000",
      surface: "#0b0d10",
      surface2: "#111418",
      surface3: "#171b20",
      fg: "#c9ced6",
      fgBright: "#ffffff",
      muted: "#7c828d",
      line: "#23272e",
      accent: "#fbbf24",
      success: "#86efac",
    },
  },
};

/** The accent used for generated icons and the tab badge. */
export const ACCENT = "#fbbf24";
export const SURFACE = "#0b0d10";
