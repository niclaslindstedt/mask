// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
/// <reference types="vite/client" />
//
// Vite's ambient client types: `import.meta.env`, the `?raw` / `?url` asset
// imports, and `import.meta.glob`.

// The app version, inlined by Vite's `define` (see `vite.config.ts`).
declare const __APP_VERSION__: string;

// The build identifier shown in the About dropdown and the update toast,
// composed at build time: `<version>[.<run>][-<slot>][+<commit>]`.
declare const __BUILD_LABEL__: string;

// Build identity shown in the Developer tab.
declare const __BUILD_COMMIT__: string;
declare const __BUILD_NUMBER__: string;

interface ImportMetaEnv {
  // Donate link target for the side-menu footer. Unset hides the row.
  readonly VITE_DONATE_URL?: string;
}
