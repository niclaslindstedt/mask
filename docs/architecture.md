# Architecture

Mask is a **frontend-only, local-first PWA**: there is no server, no account,
and nothing the user uploads or pastes leaves the browser. It is an adoption
of the [`oss-framework`](https://github.com/niclaslindstedt/oss-framework)
reference app (see its `demo/ADOPTION.md` seam manifest), rescoped from
checklists to masking.

## Layers

```
src/
├── main.tsx            entry: fonts, styles, LanguageRoot, render
├── App.tsx             the shell: Sidebar + main + modals
├── output.ts           the §19.4 central output module
├── generic/            framework candidates — no domain names, labels injected
│   ├── placeholders.ts   AAA / $1 / NAME1 placeholder schemes
│   ├── textScan.ts       regex + literal scanning, overlap resolution, substitution
│   ├── checkDigit.ts     Luhn
│   ├── extractText/      file → text (PDF through a lazy pdf.js chunk)
│   ├── safeViewport.ts   the band a floating panel may land in (safe area + top chrome)
│   └── components/       FileDropZone, StringListEditor, SpanText, CopyablePane,
│                         SafeFloatingPanel, SafeSelect
└── app/                the domain
    ├── types.ts          Project / Doc / Variable / GlobalRules
    ├── detectors/        the Swedish-context detectors + generated dictionaries
    ├── masking.ts        detect → plan → mask / unmask (pure)
    ├── useMaskStore.ts   projects per workspace, undo/redo, localStorage
    ├── useRules.ts       the global rules (one key across workspaces)
    ├── useAppSettings.ts, useNamespaces.ts, migrations.ts, log.ts
    ├── i18n/             en + sv catalogs over the framework's createI18n
    └── *Screen / *Tab / *Panel.tsx   the screens
```

**Dependency direction:** screens → stores → `masking` → `detectors` →
`generic`. `src/generic/` never imports from `src/app/`, so any of it can be
lifted into the framework unchanged. The framework is consumed only through
its published subpaths.

## The framework owns, the app owns

The framework owns the UI kit and the generic mechanics: the `Sidebar` shell,
`Modal` / `ConfirmDialog` / `FloatingPanel`, the theme engine, the search
matcher and modal, the namespaces registry ops and dialog, the logging store
and viewer, the i18n runtime, the toast store, and the PWA update state
machine. The app owns the domain and the stores: the project document, the
detectors, the masking pipeline, the rules, and the screens.

### Where a dropdown is allowed to land

The framework's floating geometry (`computeFloatingRect`) takes the visible
band as an argument, and its own hook fills that in from the raw visual
viewport. On an installed iOS PWA that band starts at the top of the screen —
under the clock, inside `env(safe-area-inset-top)` — so a menu with no room
below its trigger flips upwards and fills the status bar and the screen's top
bar.

`src/generic/safeViewport.ts` keeps the framework's geometry and replaces only
the band: the visual viewport shrunk by the safe-area insets and by anything
the app marks `data-floating-edge="top"` (today the project header and the
Settings header). `SafeFloatingPanel` and `SafeSelect` are the framework's
`FloatingPanel` and `SelectPicker` over that band; every menu in the app goes
through them.

## The masking pipeline

1. **Detect** (`detectCandidates`): the project's known variables and the
   global always-list are looked up as literals; enabled custom patterns and
   built-in detectors scan; overlapping spans resolve longest-first, then by
   priority; never-listed and project-rejected values drop out; spans group
   by distinct value into candidates.
2. **Review** (`ReviewPanel`): the user ticks, retypes kinds, adds values.
3. **Plan** (`buildMaskPlan`): included values without a variable get one
   minted in the project's placeholder style; every project variable is
   applied to the text (longest value first, whole words, a genitive `s`
   allowed to trail).
4. **Restore** (`unmaskText`): the same substitution the other way round.

The detectors that need a dictionary (`name`, `city`) read module-level sets
filled by `loadDictionaries()`, a lazy import of the ~200 KB generated data
chunk, so the boot bundle stays small; the review re-runs detection once the
chunk lands.

## The renderer is Preact

`preact` is the only renderer dependency. `@preact/preset-vite` compiles JSX
against `preact/jsx-runtime` and aliases `react` / `react-dom` onto
`preact/compat`; `tsconfig.json` `paths` and `package.json` `overrides` mirror
that for `tsc` and npm, so the framework — built against React — resolves to
Preact too. App code imports hooks and types from `"react"`; only `main.tsx`
uses Preact's own `render`. Two differences bite in new code: use
`e.currentTarget` rather than `e.target` in handlers, and spell string-valued
SVG attributes like `focusable` as `"false"`.

## What loads when

The entry chunk carries the shell, the stores, the detectors' code, and the
English catalog. Deferred behind `import()`: the Swedish catalog, the
dictionaries data chunk (on first review), pdf.js (on the first PDF), the
Settings modal, and the changelog payload.

The PDF chunk pulls pdf.js from `pdfjs-dist`'s `legacy/` build: the default
build reads the `Iterator` global at module scope, so it throws before a page
is ever opened on anything older than Safari 18.4 / Chrome 122 / Firefox 131.
`extractText/pdf.ts` also reads each page's text stream through a reader
(`extractText/streamChunks.ts`) instead of calling pdf.js's `getTextContent()`,
which `for await`s over a `ReadableStream` — something no WebKit browser
supports. Both are why a PDF upload works on an iPhone.

## PWA

`pwa-plugin.ts` emits the service worker, `manifest.webmanifest`,
`version.json`, and `precache-manifest.json` to the contract the framework's
`usePwaUpdate` reads; `src/app/pwa.ts` derives the per-slot cache id. The
three Pages slots (`/`, `/preview/`, `/branch/`) each get a distinct install
identity.
