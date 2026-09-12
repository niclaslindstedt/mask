// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";

import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";

import { appPwa } from "./pwa-plugin.ts";

// The canonical production origin. The alias page below points its canonical
// and Open Graph URLs here whichever slot built it, since the `/` release is
// the one search engines should index.
const SITE_URL = "https://mask.niclaslindstedt.se";

// The standalone privacy policy `src/main.tsx` mounts by pathname. The
// homepage's SEO lives statically in `index.html`; this page carries its own
// title, description, canonical and social-card copy, spliced into a copy of
// the built shell by the plugin below.
const PRIVACY_TITLE = "Privacy — Mask";
const PRIVACY_DESCRIPTION =
  "Mask privacy: everything runs in your browser. No document you paste or " +
  "upload ever leaves it — no server, no account, no cloud storage, no " +
  "cookies, no analytics, no third parties.";

// HTML-escape a string destined for an attribute value or text node.
const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Rewrite the per-route <head> signals in a copy of the built `index.html`.
// The homepage shell is the single source of the tag *shape* (asset links,
// icons, JSON-LD); this only swaps the title / description / canonical / OG /
// Twitter copy so the alias reads as its own page. It throws loudly when an
// expected tag is missing rather than silently shipping a page that inherits
// the homepage's title — the signal that `index.html`'s head changed shape and
// this splice needs to follow.
function splicePrivacySeo(html: string): string {
  const canonical = `${SITE_URL}/privacy/`;
  const title = escapeHtml(PRIVACY_TITLE);
  const desc = escapeHtml(PRIVACY_DESCRIPTION);

  const sub = (re: RegExp, replacement: string, label: string): void => {
    if (!re.test(html)) {
      throw new Error(
        `seo-alias: could not splice ${label} for /privacy/ — did ` +
          `index.html's <head> change shape?`,
      );
    }
    html = html.replace(re, replacement);
  };

  sub(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`, "title");
  sub(
    /(<meta\s+name="description"\s+content=")[\s\S]*?("\s*\/>)/,
    `$1${desc}$2`,
    "description",
  );
  sub(
    /(<link rel="canonical" href=")[^"]*("\s*\/>)/,
    `$1${canonical}$2`,
    "canonical",
  );
  sub(
    /(<meta property="og:type" content=")[^"]*("\s*\/>)/,
    `$1article$2`,
    "og:type",
  );
  sub(
    /(<meta property="og:title" content=")[\s\S]*?("\s*\/>)/,
    `$1${title}$2`,
    "og:title",
  );
  sub(
    /(<meta\s+property="og:description"\s+content=")[\s\S]*?("\s*\/>)/,
    `$1${desc}$2`,
    "og:description",
  );
  sub(
    /(<meta property="og:url" content=")[^"]*("\s*\/>)/,
    `$1${canonical}$2`,
    "og:url",
  );
  sub(
    /(<meta\s+name="twitter:title"\s+content=")[\s\S]*?("\s*\/>)/,
    `$1${title}$2`,
    "twitter:title",
  );
  sub(
    /(<meta\s+name="twitter:description"\s+content=")[\s\S]*?("\s*\/>)/,
    `$1${desc}$2`,
    "twitter:description",
  );
  return html;
}

// Mirror the built `index.html` to `privacy/index.html` so Pages serves the
// bundle from the clean URL `/privacy/` (and `/preview/privacy/`, …). The copy
// loads the same hashed asset URLs, so only the <head> copy is re-spliced.
// Runs late (`enforce: "post"`, after `appPwa`) so the PWA plugin's manifest
// and icon tags are already baked into the shell being copied, and so the
// alias stays out of its precache — the worker's shell fallback covers it.
function emitPrivacyAlias(): Plugin {
  return {
    name: "emit-privacy-alias",
    apply: "build",
    enforce: "post",
    generateBundle(_options, bundle) {
      const index = bundle["index.html"];
      if (index && index.type === "asset") {
        this.emitFile({
          type: "asset",
          fileName: "privacy/index.html",
          source: splicePrivacySeo(String(index.source)),
        });
      }
    },
  };
}

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
  build: {
    modulePreload: {
      // Vite wraps every `import()` in a preload helper carrying that call's
      // dependency list, and the minifier folds the two route branches in
      // `main.tsx` back into one call however the source is written — so the
      // helper would preload the UNION of both, and `/privacy/` would eagerly
      // fetch the whole app. Dropping the JS-side hints lets each branch pull
      // only what it imports; the entry's own `<link rel="modulepreload">`
      // tags in the HTML are kept.
      resolveDependencies: (_url, deps, { hostType }) =>
        hostType === "js" ? [] : deps,
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __BUILD_LABEL__: JSON.stringify(buildLabel),
    __BUILD_COMMIT__: JSON.stringify(commit),
    __BUILD_NUMBER__: JSON.stringify(buildNumber),
  },
  // The runtime is Preact: `@preact/preset-vite` compiles JSX against
  // `preact/jsx-runtime` and aliases `react` / `react-dom` onto
  // `preact/compat`, so the framework's pre-built chunks resolve to Preact.
  plugins: [
    preact(),
    tailwindcss(),
    appPwa({ base, version, ignorePaths }),
    emitPrivacyAlias(),
  ],
});
