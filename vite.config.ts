// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";

import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

import { appPwa } from "./pwa-plugin.ts";

// The base path is injected by the deploy workflows via VITE_BASE, one per
// release channel: the released app at `/`, the rolling main build at
// `/preview/`, and a parked branch at `/branch/`. Defaults to `/` for local
// dev and preview builds.
const base = process.env.VITE_BASE ?? "/";

// Sibling release channels that live *under* this build's base and must be
// disowned by its service worker (see pwa-plugin.ts `ignorePaths`).
const ignorePaths = (process.env.VITE_PWA_IGNORE_PATHS ?? "")
  .split(",")
  .map((p) => p.trim())
  .filter(Boolean);

const commit =
  process.env.GITHUB_SHA?.slice(0, 7) ??
  (() => {
    try {
      return execSync("git rev-parse --short HEAD", {
        encoding: "utf8",
      }).trim();
    } catch {
      return "unknown";
    }
  })();
const buildNumber = process.env.GITHUB_RUN_NUMBER ?? "dev";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
const appVersion = (
  JSON.parse(readFileSync(here("./package.json"), "utf8")) as {
    version: string;
  }
).version;

// `<version>[.<run>][-<slot>][+<commit>]` — the label the About dropdown and
// the update toast show (OSS_SPEC §11.5.4).
const buildSlot =
  base === "/preview/" ? "pre" : base === "/branch/" ? "br" : "";
const buildLabel =
  appVersion +
  (process.env.GITHUB_RUN_NUMBER ? `.${process.env.GITHUB_RUN_NUMBER}` : "") +
  (buildSlot ? `-${buildSlot}` : "") +
  (process.env.GITHUB_SHA ? `+${process.env.GITHUB_SHA.slice(0, 7)}` : "");

// The service worker embeds this, so its bytes change every deploy; a local
// build appends a timestamp for the same per-build uniqueness.
const version = process.env.GITHUB_SHA
  ? buildLabel
  : `${buildLabel}+${new Date().toISOString()}`;

export default defineConfig({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __BUILD_LABEL__: JSON.stringify(buildLabel),
    __BUILD_COMMIT__: JSON.stringify(commit),
    __BUILD_NUMBER__: JSON.stringify(buildNumber),
  },
  // The runtime is Preact: `@preact/preset-vite` compiles JSX against
  // `preact/jsx-runtime` and aliases `react` / `react-dom` onto
  // `preact/compat`, so the framework's pre-built chunks resolve to Preact.
  plugins: [preact(), tailwindcss(), appPwa({ base, version, ignorePaths })],
});
