# mask

Mask personal data before it reaches an LLM. A local-first PWA built on
[`@niclaslindstedt/oss-framework`](https://github.com/niclaslindstedt/oss-framework)
for a Swedish, public-sector context: upload a text or PDF, confirm the names,
street addresses, cities, postal codes, phone numbers and personal identity
numbers it found, copy the masked text into your LLM, and paste the answer back
to restore the real values. Nothing leaves your browser.

[![CI](https://github.com/niclaslindstedt/mask/actions/workflows/ci.yml/badge.svg)](https://github.com/niclaslindstedt/mask/actions/workflows/ci.yml)
[![SEO](https://github.com/niclaslindstedt/mask/actions/workflows/seo.yml/badge.svg)](https://github.com/niclaslindstedt/mask/actions/workflows/seo.yml)
[![Pages](https://github.com/niclaslindstedt/mask/actions/workflows/pages.yml/badge.svg)](https://github.com/niclaslindstedt/mask/actions/workflows/pages.yml)
[![License: PolyForm-Noncommercial-1.0.0](https://img.shields.io/badge/license-PolyForm--Noncommercial--1.0.0-blue.svg)](LICENSE)

## Why?

- **The details never leave the device.** Detection, masking and restoring all
  run in the browser; there is no server, no account, no upload. The LLM only
  ever sees `NAME1 bor på STREET1 i CITY1`.
- **You confirm every replacement.** Detectors propose; a review with a
  checkbox per value, a kind picker, and a click-to-toggle preview decides.
  Add what was missed by selecting it.
- **Projects remember.** The placeholders a project has minted are reused in
  every later document, so the same person is the same placeholder in the
  letter and in the reply — and the answer restores cleanly.
- **Placeholders that carry the role.** Mask a value under a name of your own —
  `JUDGE1` rather than `NAME1` — one value at a time, or from a list of
  placeholder types you keep per workspace or across all of them.
- **Rules carry everywhere.** A global blacklist (always mask), a whitelist
  (never mask), and your own regex patterns apply across every workspace and
  project — and a review row adds to either list in one press.
- **Swedish first.** Personal identity and organisation numbers are
  check-digit verified; phone numbers, postal codes and street addresses
  follow Swedish conventions; names and localities come from SCB's and the
  tätort statistics rather than a guess.

## Prerequisites

- Node.js ≥ 22 (CI pins 24 — see `.nvmrc`)
- npm ≥ 10
- A GitHub personal access token with `read:packages` (the framework package
  is served from GitHub Packages)

## Install

The `@niclaslindstedt` scope resolves from GitHub Packages (see the committed
[`.npmrc`](.npmrc)). GitHub Packages requires authentication even for public
packages, so add a token to your `~/.npmrc` once:

```
//npm.pkg.github.com/:_authToken=<your read:packages token>
```

Then:

```sh
git clone https://github.com/niclaslindstedt/mask.git
cd mask
npm install
```

## Quick start

```sh
npm run dev        # start the dev server
npm run build      # production build into dist/
npm run preview    # serve the production build locally
```

Open the app, create a project, drop one of the files from [`examples/`](examples/)
onto the intake (or press **Paste text**), review what was found, press
**Confirm and mask**, and copy the output.

## Usage

- **Projects** — the side menu lists them; `+` creates one. A project holds
  documents and the placeholders they share. Right-click (or swipe) a row to
  rename or delete it. Everything is one Undo away (Ctrl/Cmd-Z).
- **Documents** — drop a PDF or text file onto the intake, press it to browse,
  or **Paste text**. PDFs are read in the browser and laid back out into
  paragraphs — wrapped lines rejoined, hyphenated words put back together,
  running headers dropped, footers read in their place; a scanned PDF needs OCR
  first. The page's own structure comes with it: headings, bold and italics are
  written back out as Markdown, so the model on the other end can still tell a
  section title from a sentence.
- **Review** — every candidate has a checkbox, a kind, and the placeholder it
  will get (or the one it already has). Untick a false positive, change a kind,
  type a missed value, or select text in the preview and press **Mask “…”**.
  Clicking a highlight toggles it. Every kind picker ends in **Custom type…**,
  which takes a name of your own for that value.
- **Confirm and mask** — produces the masked text in the output pane, shown
  formatted rather than as its own Markdown, with a copy button and a
  **Download** menu beside it (PDF or Markdown file). Confirm again after
  changes to update it.
- **Placeholders** — the project's table of placeholder ↔ value ↔ kind; add one
  by hand, remove one, change a kind, copy the table, pick the placeholder
  style for this project, and un-reject values.
- **Restore** — paste the LLM's answer, get it back with every placeholder of
  the project swapped for the real value.
- **Rules** — the side-menu button opens the global blacklist / whitelist and
  the custom regex patterns, with a live tester. Every row in a review has a
  blacklist and a whitelist button, so a decision made once carries to every
  project.
- **Placeholder types** — Settings → Masking keeps the custom types you reuse
  (Judge, Plaintiff, Car…), each one global or bound to the workspace it was
  added in.
- **Workspaces** — the switcher at the top of the side menu keeps separate
  sets of projects; the rules apply to all of them.
- **Search** — the magnifier, **Ctrl/Cmd+K**, or just start typing; finds
  projects, documents (by name and text), and placeholders.

### Placeholder styles

`AAA`, `aaa`, `$1`, `NAME1`, `[NAME 1]`, `{{name1}}` — pick the default in
Settings → Masking and override it per project. Kind-based styles tell the LLM
what a placeholder stands for — including a custom type's name, so a value
typed as "Judge" masks to `JUDGE1`; letter styles give nothing away.

### Install as an app

The deployed site is an installable PWA: use your browser's _Install app_
affordance (or on iOS, Safari → Share → _Add to Home Screen_). The installed
app works fully offline and surfaces new deploys through an in-app update
prompt.

## Configuration

There is nothing to configure to run it. Build-time variables and the in-app
settings are listed in [docs/configuration.md](docs/configuration.md):

| Variable                | Purpose                                                                 |
| ----------------------- | ----------------------------------------------------------------------- |
| `VITE_BASE`             | Deploy base path — `/` (release), `/preview/` (main), `/branch/` (slot) |
| `VITE_PWA_IGNORE_PATHS` | Sibling channel paths the root service worker leaves alone              |
| `VITE_DONATE_URL`       | Donate link target for the side-menu footer (unset hides the row)       |

## Examples

See [`examples/`](examples/) for the sample documents — fictional Swedish
letters and case notes carrying every kind of value the detectors know. Drop
one onto a project, or switch on **Test data** in Settings → Developer to open
the app on sample projects already holding them.

## Troubleshooting

- **`npm install` returns 401** — the GitHub Packages token is missing; see
  Install above.
- **A PDF adds with "contains no text"** — it is a scanned image; OCR it or
  paste the text.
- **A name was not detected** — select it in the preview and mask it, or
  blacklist it.
- More in [docs/troubleshooting.md](docs/troubleshooting.md).

## Documentation

- [Getting started](docs/getting-started.md)
- [Configuration](docs/configuration.md)
- [Architecture](docs/architecture.md)
- [Troubleshooting](docs/troubleshooting.md)

This repository follows [`OSS_SPEC.md`](OSS_SPEC.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Bugs and feature requests go to
[GitHub Issues](https://github.com/niclaslindstedt/mask/issues); security
reports go through [SECURITY.md](SECURITY.md), never a public issue.

## License

Licensed under [PolyForm Noncommercial 1.0.0](LICENSE) — the same license as
the framework and the reference app this project is derived from. The name and
locality dictionaries are generated from SCB's public name statistics and the
[klintan/swedish-gazetteers](https://github.com/klintan/swedish-gazetteers)
locality list (CC BY 4.0).
