// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { render } from "preact";

// The default UI family (JetBrains Mono) ships in the main bundle so it
// precaches for offline first paint; the other families the theme presets
// name load on demand through the framework's fontsource registration.
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-ext-400.css";
import "@fontsource/jetbrains-mono/latin-700.css";
import "@fontsource/jetbrains-mono/latin-ext-700.css";
import "@niclaslindstedt/oss-framework/theme/fontsource";

import "./styles.css";
import { LanguageRoot } from "./app/i18n/index.ts";

// In dev no worker registers (`usePwaUpdate` runs disabled), but a worker
// installed by a previous `vite preview` on this origin would keep serving
// stale bytes — unregister any so the dev server always wins.
if (import.meta.env.DEV && "serviceWorker" in navigator) {
  void navigator.serviceWorker
    .getRegistrations()
    .then((regs) => regs.forEach((reg) => void reg.unregister()));
}

const root = document.getElementById("root");
if (!root) throw new Error("missing #root element");

// A trivial path switch. The build emits `dist/privacy/index.html` (the
// `emit-privacy-alias` plugin in `vite.config.ts`) so GitHub Pages serves the
// same bundle from the clean URL `/privacy/`, and this decides which page to
// mount. A deploy slot nests it one segment deeper (`/preview/privacy/`), so
// the check matches the suffix rather than the whole path. Both pages load
// behind `import()`, so opening the policy never pulls the app in.
const path = window.location.pathname.replace(/\/$/, "");

function loadPage() {
  if (path.endsWith("/privacy")) {
    return import("./app/PrivacyPage.tsx").then((m) => m.PrivacyPage);
  }
  return import("./App.tsx").then((m) => m.App);
}

void loadPage().then((Page) => {
  render(
    <LanguageRoot>
      <Page />
    </LanguageRoot>,
    root,
  );
});
