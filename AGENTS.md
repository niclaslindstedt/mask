# Agent guidance for mask

This file is the canonical source of truth for AI coding agents working in this
repo. `CLAUDE.md`, `.cursorrules`, `.windsurfrules`, `GEMINI.md`, and
`.github/copilot-instructions.md` are symlinks to this file.

## OSS Spec conformance

This repository adheres to [`OSS_SPEC.md`](OSS_SPEC.md), a prescriptive
specification for open source project layout, documentation, automation, and
governance. A copy of the spec lives at the repository root; its version is in
the YAML front matter at the top of the file.

Run `oss-spec validate .` (or the standalone
[`validate.sh`](https://github.com/niclaslindstedt/oss-spec/blob/main/scripts/validate.sh))
to verify conformance. When in doubt about a layout, naming, or workflow
decision, consult the relevant section of `OSS_SPEC.md`.

## Build and test commands

```sh
make install       # npm install (needs GitHub Packages auth — see below)
make build         # production build (vite build)
make test          # full test suite (vitest)
make lint          # eslint + tsc --noEmit
make fmt           # prettier --write
make fmt-check     # verify formatting (CI)
make check-seo     # build, then the §11.3 structural SEO / PWA assertions
make icons         # regenerate the PWA icons + og image from the app mark
make dictionaries  # regenerate the name / locality dictionaries from source
```

The `@niclaslindstedt/oss-framework` dependency comes from the **GitHub
Packages** npm registry (see `.npmrc`). GitHub Packages requires auth even for
public packages, so local installs need a `read:packages` token in `~/.npmrc`
(`//npm.pkg.github.com/:_authToken=<token>`); CI authenticates with the
workflow's `GITHUB_TOKEN`.

### Dependency install in web sessions

Claude Code on the web runs `.claude/hooks/session-start.sh` on `SessionStart`
(wired up in `.claude/settings.json`), so **dependencies install automatically
in the background** — an agent shouldn't run `make install` by hand first. The
hook resolves a GitHub Packages token from the environment
(`NODE_AUTH_TOKEN` / `GITHUB_PAT` / `GH_TOKEN` / `GITHUB_TOKEN`, first wins),
writes it to `~/.npmrc`, and runs `npm install` — the committed project
`.npmrc` stays token-free. It runs in **async** mode, so `node_modules` may
still be populating for a moment after the session opens; if a `make` target
fails on a missing dependency, wait and retry. The hook is a no-op outside the
web environment (`CLAUDE_CODE_REMOTE`).

### No errors get through

Never land work while `make lint`, `make test`, `make build`, or
`make fmt-check` is red. A pre-existing failure is a bug to close, not a reason
to route around it.

## Commit and PR conventions

- All commits follow [Conventional Commits](https://www.conventionalcommits.org/).
  Scope is the module: `feat(detectors): …`, `fix(review): …`.
- PRs are squash-merged; the **PR title** becomes the single commit on `main`,
  so it must follow conventional-commit format.
- Breaking changes use `<type>!:` or a `BREAKING CHANGE:` footer.
- Every PR touching user-visible behaviour drops a changeset fragment (see
  "Changelog and feature docs").

### Watching a PR after you open it

Don't babysit a PR with polling. **Do not** schedule `send_later`, cron jobs,
`ScheduleWakeup`, or timed self-check-ins to re-check CI or merge state. Open
the PR, confirm the checks you can see are green, then stop. CI failures and
review comments are delivered to the session as webhook events; react to those
when they arrive.

## Architecture summary

A **frontend-only, local-first PWA** — there is no server; nothing a user
uploads or pastes leaves the browser. It is an adoption of the
[`oss-framework`](https://github.com/niclaslindstedt/oss-framework) reference
app (see its `demo/ADOPTION.md` seam manifest), rescoped to masking personal
data in Swedish, public-sector documents before they go to an LLM.

The framework owns the UI kit and the generic mechanics: the `Sidebar` shell,
modals, theme engine, search matcher, namespaces, logging, i18n runtime, toast
store, and the PWA update state machine. The app owns the domain and the
stores ("store stays in the app"):

- `src/app/types.ts` — `Project` / `Doc` / `Variable` / `GlobalRules`.
- `src/app/detectors/` — the Swedish-context detectors (personal identity and
  organisation numbers with Luhn, phone, e-mail, postal code, street, city,
  name), the generated dictionaries under `data/`, and the lazy loader
  (`dictionaries.ts`) that keeps the ~200 KB of names off the boot path.
- `src/app/masking.ts` — the pure pipeline: `detectCandidates` →
  `buildMaskPlan` → `maskText` / `unmaskText`.
- `src/app/useMaskStore.ts` — the per-workspace project document (localStorage,
  undo/redo, every edit action). `useRules.ts` holds the global always / never
  / pattern rules in one key across workspaces. `useAppSettings.ts`,
  `useNamespaces.ts`, `migrations.ts` as in the sibling apps.
- `src/app/ProjectScreen.tsx` → `DocumentsTab` / `ReviewPanel` /
  `VariablesTab` / `RestoreTab`, `RulesScreen.tsx`, `SideMenuContent.tsx`,
  `SettingsModal.tsx` + `settings/`, `SearchOverlay.tsx` — the screens.
- `src/generic/` — **framework candidates**: placeholder schemes, text
  scanning / substitution, Luhn, file → text extraction (including the pass
  that lays a PDF's positioned runs back out into paragraphs, and the one that
  translates a Word package's XML), a ZIP reader and a small XML reader, a PDF
  page renderer and the viewer over it, an IndexedDB blob vault, and the
  components.
  Written to the framework's rules (no domain names, labels injected); nothing
  here imports from `src/app/`. Lift into the framework when a second app
  needs it. See `src/generic/README.md`.
- `src/output.ts` — the §19.4 central output module.
- `pwa-plugin.ts` — emits the service worker + manifests `usePwaUpdate` reads.

Dependency direction: screens → stores → `masking` → `detectors` → `generic`.
Nothing imports the framework's internals — only its published subpaths.

### The renderer is Preact

`preact` is the only renderer dependency — **never add `react` or `react-dom`
back.** `@preact/preset-vite` compiles JSX against `preact/jsx-runtime` and
aliases `react` / `react-dom` onto `preact/compat`; `tsconfig.json` `paths` and
`package.json` `overrides` mirror that. App code imports hooks and types from
`"react"`; only `src/main.tsx` uses Preact's `render`. Two differences bite:
use `e.currentTarget` rather than `e.target` in handlers, and spell
string-valued SVG attributes like `focusable` as `"false"`.

### Keep boot small

Everything on the entry path is downloaded before the user sees anything. The
dictionaries, pdf.js, the Swedish catalog, the Settings modal, and the
changelog payload all sit behind `import()`; keep it that way, and put any new
heavy thing behind one too.

### Reach for the framework first

Before building any UI primitive, gesture, or generic mechanic, check whether
`@niclaslindstedt/oss-framework` already ships it (the `.d.ts` files under
`node_modules/@niclaslindstedt/oss-framework/dist/**` list every export). Only
build app-local UI when the framework has no fit — and when what you build is
generic, put it in `src/generic/` so it can migrate.

### Then read the sibling `contacts` app

Almost everything mask needs that **isn't a masking concern** has been solved
once already, in
[`niclaslindstedt/contacts`](https://github.com/niclaslindstedt/contacts) — the
other, more mature adoption of the same framework. Settings tabs, glyph
handling, the sidebar, buttons, dropdowns, pickers and popovers, toasts,
theming, routing and the back button, native-feel details (safe-area insets,
swipe gestures, standalone/install behaviour), the PWA and service-worker
plumbing, CI and the deployment slots: read how `contacts` does it and follow
that shape instead of inventing a second one. The two apps staying in step is
what keeps a mechanic cheap to lift into the framework later.

The order of preference is **framework → `contacts` → new code here**. If the
framework ships it, use the framework; `contacts` then shows how to consume it.
If `contacts` solves it app-locally and the solution carries no domain, it
belongs in `src/generic/` here rather than `src/app/`. mask's own half is the
domain and nothing else: detectors, dictionaries, the masking pipeline, rules,
review and restore.

Clone it read-only when you need to look — never vendor it, never commit it:

```sh
git clone --depth 1 https://github.com/niclaslindstedt/contacts /tmp/contacts
```

| Looking for                              | Read in `contacts`                                                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Settings modal, adding a settings tab    | `src/app/SettingsModal.tsx`, `src/app/settings/{tabs,shared}.tsx`                                       |
| Glyphs, icons, per-item marks            | `src/app/contactGlyphs.ts`, `src/app/icons.tsx`, the framework's glyph catalogue                        |
| Sidebar / side-menu rows                 | `src/app/SideMenuContent.tsx`, `src/app/SideMenuRows.tsx`                                               |
| Buttons, dropdowns, pickers, popovers    | `src/app/ContactListFilters.tsx`, `MassEditModal.tsx`, `ContactAppearancePopover.tsx`                   |
| Theme / accent handling                  | `src/app/look.ts`                                                                                       |
| Toasts                                   | `src/app/toast.ts`, `AppToastViewport.tsx`, `SelectToast.tsx`                                           |
| Routing, history, the back button        | `src/app/route.ts`, `useAppRoute.ts`, `useNavigation.ts`                                                |
| Native feel: safe areas, swipe, keyboard | `src/styles.css`, `src/app/swipeNavigation.ts`, `useCardEdgeSwipeOpen.ts`, `useSwipeNavigationGuard.ts` |
| PWA, service worker, update prompt       | `pwa-plugin.ts`, `src/app/pwa.ts`                                                                       |
| CI, release, deployment slots, mirroring | `.github/workflows/{ci,pages,release,mirror}.yml`, `scripts/release/`                                   |
| Changelog fragments, feature docs        | `.changes/`, `docs/features/`, `src/app/changelog.ts`                                                   |
| i18n catalogue shape (`en` + `sv`)       | `src/app/i18n/`                                                                                         |
| Maintenance skills                       | `.agent/skills/` — note mask's own tree is `.agents/skills/` per §21                                    |

Two parts of `contacts` are **not** for mask: it syncs to Dropbox / Google
Drive and it stores photos and attachments. mask is local-only by design —
nothing a user pastes or uploads leaves the browser — so never port the sync,
storage-adapter, or encryption paths across. And borrowing is never copying
wholesale: keep this repo's naming, its `src/generic/` boundary, the `en`/`sv`
parity rule, and the 1000-line file cap.

### Keep the framework current

Before starting a task, check the newest release with
`npm view @niclaslindstedt/oss-framework version`, bump the `package.json`
range if a newer one exists, reinstall, and work against that.

### The dictionaries are data, not code

`src/app/detectors/data/*.ts` are **generated** by
`scripts/dictionaries/build.mjs` from SCB's name statistics, the Swedish tätort
list, and the DSSO spelling dictionary (used only as a build-time filter for
names that are also everyday words). Never edit them by hand — change the
generator (thresholds, the manual word-like list) and run `make dictionaries`.
They carry the `oss-spec:allow-large-file` marker and are Prettier-ignored.

## Where new code goes

| Change type                 | Goes in                                                                                         |
| --------------------------- | ----------------------------------------------------------------------------------------------- |
| A new detector              | `src/app/detectors/<id>.ts` + `DETECTORS` in `index.ts` + a settings toggle + `en`/`sv` strings |
| Masking / restore behaviour | `src/app/masking.ts` (pure) — never in a component                                              |
| A screen or panel           | `src/app/*.tsx`                                                                                 |
| A generic, reusable piece   | `src/generic/` (+ a row in its README)                                                          |
| Tests                       | `tests/<subject>_test.ts`                                                                       |
| Docs                        | `docs/` (conceptual) / `docs/features/` (changelog-linked, one per feature)                     |
| A user-visible change       | a `.changes/unreleased/` fragment                                                               |
| LLM prompts                 | `prompts/<name>/<major>_<minor>_<patch>.md` (none today — the app makes no LLM calls)           |

## Test conventions

- **All tests live in separate files** in `tests/` — never inline in source.
- Test files are named with a `_test` suffix (e.g. `detectors_test.ts`), per
  §20 of `OSS_SPEC.md`; vitest picks up `tests/**/*_test.ts`.
- Tests run in a node environment — no DOM. They cover the generic primitives,
  every detector (fixture strings in Swedish), the masking pipeline round trip,
  migrations, and the search corpus. Detector and pipeline tests
  `await loadDictionaries()` in `beforeAll`.
- Binary fixtures live in `tests/fixtures/`. `pdfExtract_test.ts` runs the real
  pdf.js over the PDF there; because the app's worker URL is a bundler URL, it
  points `pdfjs.GlobalWorkerOptions.workerSrc` at the copy in `node_modules`
  first — so that test needs `make install` to have run.
- A Word fixture is built rather than committed: `tests/fixtures/zip.ts` is a
  ZIP _writer_ (the app only ever reads archives), so `docx_test.ts` spells its
  document out as the XML parts Word would have written.

## Source file size

- Non-test source files must stay under **1000 physical lines** (§20.5).
  Prefer splitting by concern over relaxing the cap.
- A file may opt out with `oss-spec:allow-large-file: <reason>` in its first
  20 lines; the generated dictionaries do.

## Documentation sync points

| When you change…                            | Update…                                                                                |
| ------------------------------------------- | -------------------------------------------------------------------------------------- |
| a detector, its dictionary, or the pipeline | `docs/architecture.md`, `docs/troubleshooting.md`, the README "Why?" claims, tests     |
| the placeholder styles                      | `docs/getting-started.md` table, README, `styles.*` in `en.ts` / `sv.ts`               |
| a setting                                   | `docs/configuration.md`, `settings.*` in both catalogs                                 |
| a storage key                               | `docs/configuration.md` (Storage keys)                                                 |
| a build-time env var                        | `src/vite-env.d.ts`, `docs/configuration.md`, README Configuration, `pages.yml`        |
| user-visible features                       | a `.changes/unreleased/` fragment + `docs/features/*.md` when it is a headline feature |

## Changelog and feature docs

Every user-visible change needs a **changeset fragment** at
`.changes/unreleased/<unix-ts>-<slug>.md` (format in `.changes/README.md`).
CI's `changeset` check fails a PR that ships user-visible behaviour without
one, and the `version-bump` workflow collates the fragments into the dated
`CHANGELOG.md` sections — those are **generated, never hand-edited**.

A **feature doc** (`docs/features/<slug>.md`) is the read-more half of a
changelog bullet: a `# Title` then a few plain second-person paragraphs about
**one** feature, opened in place by the in-app "What's new" modal through a
`[Learn more](feature:<slug>)` link. One doc per feature; reach for one only
for a headline feature; create or update it in the same PR as the `doc:` slug.

## Parity / cross-cutting rules

- `src/app/i18n/en.ts` is the catalog's type source; `sv.ts` must satisfy it —
  adding a string means adding it to **both**.
- The service-worker contract (cache id, `sw.js`, `version.json`,
  `precache-manifest.json`) is shared between `src/app/pwa.ts` and
  `pwa-plugin.ts`; change them together.
- `public/icons/*`, `public/og.png`, `public/favicon.ico` are generated — edit
  `scripts/generate-icons.mjs` (and `public/icons/icon.svg` to match) and rerun
  `make icons`.
- No `console.*` in app code — route diagnostics through `src/output.ts`.
- Chrome pinned to the top of a screen carries `data-floating-edge="top"`, so
  the framework stops dropdowns at it instead of over it (it already keeps them
  out of the iOS safe area). A new pinned header needs the attribute.
- `src/generic/` never imports from `src/app/`, never carries a domain name
  (`name`, `pin`, `project`), and takes every user-facing string as a prop.

## Website

The app **is** the website: `pages.yml` builds it per deployment slot (`/`,
`/preview/`, `/branch/` — OSS_SPEC §11.5) and deploys `dist/`. There is no
separate `website/` directory, so §11.2's staleness rules reduce to keeping
`index.html`'s head copy, `public/llms.txt`, and the README in step with the
feature surface — `update-readme` covers the README half.

## Maintenance skills

Per §21 of `OSS_SPEC.md`, this repo ships agent skills for keeping drift-prone
artifacts in sync with their sources of truth. Skills live under
`.agents/skills/<name>/`; `.claude/skills` is a symlink to that tree.

| Skill           | When to run                                                                                                             |
| --------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `maintenance`   | When several artifacts have likely drifted at once — umbrella skill that runs every `update-*` skill in registry order. |
| `sync-oss-spec` | When the repo may have drifted from `OSS_SPEC.md` — runs the validator and fixes each violation.                        |
| `update-docs`   | After any change to user-visible behaviour, settings, storage keys, or the pipeline.                                    |
| `update-readme` | After any change that alters user-visible behaviour, commands, or install instructions.                                 |

Each skill has a `SKILL.md` (the playbook) and a `.last-updated` file (the
baseline commit hash). The `maintenance` skill owns a **Registry** table
listing every `update-*` skill — add a row whenever you create a new one.
