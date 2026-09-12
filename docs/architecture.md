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
│   ├── extractText/      file → text (PDF through a lazy pdf.js chunk,
│   │                     laid back out into paragraphs by `layout.ts`, then
│   │                     written back out as Markdown by `markup.ts`)
│   ├── pdf/              PDF both ways (a pure typesetter + a lazy jsPDF
│   │                     writer; page shapes + a lazy pdf.js page renderer)
│   ├── blobVault.ts      a keyed store of blobs in IndexedDB, best-effort throughout
│   ├── collapseOnScroll.ts  collapse a scroll container's header once it is scrolled past
│   └── components/       FileDropZone, StringListEditor, GlyphButton, SpanText,
│                         CopyablePane, MarkdownText, PdfView, DownloadMenu,
│                         SelectOrCreate
└── app/                the domain
    ├── types.ts          Project / Doc / Variable / GlobalRules
    ├── detectors/        the Swedish-context detectors + generated dictionaries
    ├── masking.ts        detect → plan → mask / unmask (pure)
    ├── reviewRows.ts     the review's rows: fold in a fresh detection, add one (pure)
    ├── useMaskStore.ts   projects per workspace, undo/redo, storage backend
    ├── folderStorage.ts  the local-folder backend: which file, what to do
    │                     with one that already holds a document (pure)
    ├── useFolderStorage.ts  the picked folder's handle, permission, and state
    ├── PrivacyPage.tsx   the standalone policy served at /privacy/
    ├── dev/              the developer test-data backend (lazy, dev-only)
    ├── useRules.ts       the global rules (one key across workspaces)
    ├── customKinds.ts    custom placeholder types: label rules, list transforms (pure)
    ├── useCustomKinds.ts those types' two lists — global, and per workspace
    ├── useAppSettings.ts, useNamespaces.ts, migrations.ts, log.ts
    ├── i18n/             en + sv catalogs over the framework's createI18n
    ├── sourceFiles.ts     the uploaded PDF itself, kept in the blob vault
    ├── DocumentReader.tsx  a document read rather than reviewed — its own
    │                       pages for a PDF, its extracted text otherwise
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

The framework places every floating panel inside the visible band _minus_ the
device's safe-area insets, so a menu with no room below its trigger flips
upwards without running under an iOS status bar or home indicator. It cannot
know an app's own chrome by name, so anything pinned to a screen edge marks
itself `data-floating-edge="top"` and panels stop there too — here that is the
project header and the Settings header, measured live so a header that wraps on
a narrow screen stays covered.

That band used to be this app's problem (`src/generic/safeViewport.ts` and a
pair of components over it, shipped in 0.1.0); framework 3.3.1 owns it, which
also covers the panels the app never placed itself — the sidebar's long-press
row menu among them.

## The masking pipeline

1. **Detect** (`detectCandidates`): the project's known variables and the
   global blacklist (`rules.always`) are looked up as literals; enabled custom
   patterns and built-in detectors scan; overlapping spans resolve
   longest-first, then by priority; whitelisted (`rules.never`) and
   project-rejected values drop out; spans group by distinct value into
   candidates.
2. **Review** (`ReviewPanel`): the user ticks, retypes kinds, adds values, and
   moves a value on or off either global list without leaving the review
   (`ruleListing` says which list it is on). Marking text in the preview offers
   the same three decisions in one press — **Mask**, **Always mask**
   (blacklist), **Never mask** (whitelist) — over the pure row transforms in
   `reviewRows.ts`. A
   kind is a free string, so a kind picker's **Custom type…** entry can hand a
   value any label — saved types (`useCustomKinds`) are the same labels, kept
   for reuse.
3. **Plan** (`buildMaskPlan`): included values without a variable get one
   minted in the project's placeholder style; every project variable is
   applied to the text (longest value first, whole words, a genitive `s`
   allowed to trail).
4. **Restore** (`unmaskText`): the same substitution the other way round.

Re-typing a placeholder afterwards goes through `retokenForKind`: a token this
style would have minted for the old kind is re-minted for the new one, so
`NAME1` becomes `JUDGE1`; a token the user typed by hand is left alone.

The detectors that need a dictionary (`name`, `city`) read module-level sets
filled by `loadDictionaries()`, a lazy import of the ~200 KB generated data
chunk, so the boot bundle stays small; the review re-runs detection once the
chunk lands.

### The Documents tab at phone width

Desktop gives the tab two columns, each scrolling on its own: the intake and
the document list on the left, the review on the right. A phone has no room for
that, so the wrapper around the two is `md:contents` — from `md` up it
dissolves and the panes are laid out by the row above it; below `md` it _is_
the scroll container, and list and review scroll as one.

The intake is rendered outside that scroll when the layout is stacked, as the
tab's own header, so folding it leaves it in reach rather than taking it away.
`useCollapseOnScroll` (`src/generic/`) watches the scroll container: past
~56 px the intake folds to a single row (`FileDropZone`'s `compact`), and it
unfolds again near the top. Two thresholds rather than one, because folding
changes the height of the very thing being measured.

## Storage sits behind a backend

`useMaskStore` never touches `localStorage` directly: it reads and writes a
namespace's document through a `DocBackend` (`load(slug)` / `save(slug, doc)`),
so a different implementation can take over persistence without the store
changing. Three exist — `localDocBackend`, the default (a `mask:doc[:slug]` key
per workspace), the local-folder backend (below), and the in-memory test-data
backend under `src/app/dev/`, which `App` swaps in while Settings → Developer →
**Test data** is on. The slug and the backend travel with the document in
state, so switching either re-adopts the matching document and resets the undo
history, and a seeded session never writes to disk: turning the toggle off (or
reloading) brings the real document back untouched.

### The local folder

Settings → **Storage** can point the document at a folder the user picks on
their own disk instead, through the browser's File System Access API — still
local, but a real file: greppable, backed up with the rest of the folder, and
untouched by clearing site data. Each workspace is one file (`mask.json` for
the default workspace, `mask-<slug>.json` otherwise).

The framework owns every generic piece — `isFolderBackendAvailable`,
`ensurePermission`, the handle's IndexedDB round trip, and
`createFolderAdapter`. `folderStorage.ts` holds the app's half: the file name
per workspace, `planFolderSetup` (push / adopt / ask / unreadable — what to do
with a folder that already holds a document), and the backend itself, whose
writes are serialised and coalesced so a burst of edits costs one more write
rather than one each. Every write also updates the `localStorage` copy, which
trails as a cache: the app opens instantly, survives a revoked grant, and has
the projects waiting if the folder is disconnected.

`useFolderStorage` owns the state around it — the handle, the boot permission
probe, the read that decides which document the store adopts, and the reconnect
cue when the OS drops the grant. Because a folder read decides which document
the store adopts, `App` holds the working surface behind a spinner until it
settles; the one collision that can't be resolved automatically (a fresh
connect where both sides hold projects) is put to the user in the Storage tab.

Nothing here reaches a network — there is no cloud backend, by design, and the
[privacy policy](../src/app/PrivacyPage.tsx) at `/privacy/` says so in full.

The test data itself (`dev/testData.ts`) is built from the files in
`examples/`, minting each project's placeholders exactly as a confirmed review
would. It lives behind a dynamic `import()` so neither the sample text nor the
builder reaches a production boot.

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
dictionaries data chunk (on first review), pdf.js (on the first PDF uploaded
or opened — one chunk shared by the text extraction and the page renderer),
the PDF _writer_ (on the first PDF download), the Settings modal, the changelog
payload, and the developer test-data chunk (on the first time the toggle turns
on).

`main.tsx` mounts one of two pages by pathname — the app, or the privacy policy
at `/privacy/` — and both sit behind an `import()`, so opening the policy never
pulls the app in. The build mirrors `index.html` to `privacy/index.html` with
its own `<head>` copy (the `emit-privacy-alias` plugin in `vite.config.ts`), so
Pages serves the clean URL; `build.modulePreload.resolveDependencies` drops the
JS-side preload hints that would otherwise make either branch fetch both.

The PDF chunk pulls pdf.js from `pdfjs-dist`'s `legacy/` build: the default
build reads the `Iterator` global at module scope, so it throws before a page
is ever opened on anything older than Safari 18.4 / Chrome 122 / Firefox 131.
`extractText/pdf.ts` also reads each page's text stream through a reader
(`extractText/streamChunks.ts`) instead of calling pdf.js's `getTextContent()`,
which `for await`s over a `ReadableStream` — something no WebKit browser
supports. Both are why a PDF upload works on an iPhone.

### Reading a PDF back into paragraphs

A PDF has no paragraphs — only glyphs at coordinates, handed back in the order
the producer drew them. `extractText/layout.ts` is the pure pass that puts a
page back together from that geometry, and `extractText/pdf.ts` does nothing
but feed it pdf.js's positioned runs:

1. Runs sharing a baseline become a line, with a space wherever the producer
   drew a gap instead of one.
2. A line drawn above the previous one, or a long leap down the page, starts a
   new block; blocks are then read top-to-bottom, left-to-right. That is what
   puts a footer the producer drew first at the foot of the page, and reads a
   two-column page one column at a time.
3. Inside a block, consecutive lines join into one paragraph unless the leading
   grows, the next line is indented, a list marker starts it, or the line
   stopped well short of the block's right margin. A word split by a soft
   hyphen ("multi-" / "verktyg") is put back together; a hyphen the writer
   typed ("A-traktor") is kept.
4. Across pages, a header or footer that repeats at the same height on three or
   more pages — page numbers aside — is dropped, and a sentence the page break
   cut in half is rejoined.

Every threshold is scaled from the page's own measurements (its leading, its
margins, the font height) rather than fixed in points, so the pass does not
assume a paper size or a type size. `tests/pdfLayout_test.ts` covers the rules
one at a time; `tests/pdfExtract_test.ts` runs the whole thing over a real
five-page judgment in `tests/fixtures/`.

### Keeping the page's headings and emphasis

A page says things with type as well as with words: a section title is set
larger, a warning is set in bold, a citation in italics. An extractor that
hands back only characters throws all of it away, and the reader on the other
end — a person or a language model — can no longer tell a section title from a
sentence. So the reflowed paragraphs go through one more pure pass,
`extractText/markup.ts`, which writes that structure back out as Markdown:

- **Headings from size.** A paragraph set well above the document's body size
  becomes `#`, `##` or `###`, by how far above it stands. The body size is the
  glyph height carrying the most text across the _whole_ document, so a cover
  page set large doesn't make its own type the body.
- **Headings from weight.** A paragraph at body size but wholly bold, one
  printed line, short, and without a sentence's punctuation is the other way a
  document writes a heading — `###`.
- **Emphasis from the face.** A bold or italic run becomes `**…**` / `*…*`,
  with any surrounding space left outside the markers. A document set wholly in
  one bold face is left unmarked: bold says nothing when everything is bold.
- **Bullets from the glyph.** A paragraph opening `•`, `–` or `*` becomes a
  real `-` item; a numbered one already spells itself.

Which face a run was drawn in is not in the text stream — pdf.js only resolves
a page's fonts while it builds the page's _operator list_, so `pdf.ts` builds
one per page and throws it away for the font table it registers on the way.
`bold` / `italic` come off that font when the producer filled the descriptor
in, and off the PostScript name (`BCDEEE+TimesNewRomanPS-BoldMT`) when it
didn't. A producer that defeats both leaves the page unstyled rather than
unread.

`tests/markup_test.ts` covers the rules over positioned runs;
`tests/pdfRoundTrip_test.ts` writes a PDF with real bold and italic faces and
reads it back, which is the only check that proves the face survives a file.

### Writing a PDF back out

`generic/pdf/` is the same split in the other direction: `layout.ts` is a pure
typesetter — Markdown in, pages of drawing operations out, with the one thing
it can't know (how wide a string is) injected as a `measure` callback — and
`write.ts` paints those with jsPDF. Only the writer pulls jsPDF in, and only
`src/app/download.ts` reaches it, through an `import()` on the press. It uses
the PDF standard fonts, which every reader already has and which encode
Latin-1, so an ordinary Swedish document costs the file nothing in embedded
faces.

### Showing a PDF as a PDF

Reading a document back as paragraphs loses what a page's layout said —
columns, tables, a stamp, a signature — so the reader shows the file itself.
That means keeping it: `generic/blobVault.ts` is a small IndexedDB store of
blobs, and `app/sourceFiles.ts` puts every uploaded PDF in it under the
document's id. The bytes never leave the browser, the vault is erased with
everything else by Settings → Developer, and files whose document is gone are
swept at boot — deleting a document is undoable, so the file can't go with it
on the press.

Every operation on the vault resolves rather than throws: a browser that
refuses IndexedDB answers "nothing stored", and the reader falls back to the
extracted text — which is what every document had before, and what the
detectors read either way.

`generic/pdf/pages.ts` holds the page shapes and the fit arithmetic, and
`generic/pdf/render.ts` the pdf.js half that paints a page onto a canvas.
Keeping them apart is what keeps the engine off the boot path: the viewer
(`components/PdfView.tsx`) imports the first statically and the second through
an `import()` when a PDF is actually opened. It paints a page as it comes into
view and drops its bitmap as it leaves, so a long document costs what the
window shows rather than what it contains.

## PWA

`pwa-plugin.ts` emits the service worker, `manifest.webmanifest`,
`version.json`, and `precache-manifest.json` to the contract the framework's
`usePwaUpdate` reads; `src/app/pwa.ts` derives the per-slot cache id. The
three Pages slots (`/`, `/preview/`, `/branch/`) each get a distinct install
identity.
