# Getting started

## Use it

Mask is a static PWA — open the deployed site, or run it locally:

```sh
npm install     # needs a read:packages token for GitHub Packages, see README
npm run dev
```

The app opens in the **General** workspace with no project yet.

1. **Create a project** — the `+` in the side menu (or the button on the empty
   screen), type a name, press Enter. A project is a case, a matter, a batch
   of documents that share the same people and places.
2. **Add a document** — drop a PDF or text file onto the intake box, press it
   to browse, or use **Paste text**. **Load a sample letter** fills in a
   fictional building-permit letter to try things on.
3. **Review** — every value the detectors found is listed with a checkbox, its
   kind, and the placeholder it will get. Untick a false positive, change a
   kind, or add a value the detectors missed — type it in, or select it in the
   preview and press **Mask “…”**. Clicking a highlight in the preview toggles
   it too.
4. **Confirm and mask** — the masked text appears in the output pane. Press
   **Copy** and paste it into your LLM.
5. **Restore** — paste the answer into the **Restore** tab; every placeholder
   from the project turns back into its real value. Copy that.

The next document in the same project reuses the placeholders it already has,
so a person masked as `NAME1` in the first letter is `NAME1` in the reply too.

## Placeholder styles

Settings → **Masking** picks the default style for new projects; a project's
**Placeholders** tab can override it:

| Style          | Looks like                 |
| -------------- | -------------------------- |
| `upperLetters` | `AAA`, `AAB`, `AAC`        |
| `lowerLetters` | `aaa`, `aab`, `aac`        |
| `dollarNumber` | `$1`, `$2`, `$3`           |
| `kindNumber`   | `NAME1`, `PHONE1`, `CITY1` |
| `bracketKind`  | `[NAME 1]`, `[PHONE 1]`    |
| `mustache`     | `{{name1}}`, `{{phone1}}`  |

The kind-based styles tell the LLM what each placeholder stands for, which
usually gives a better answer. The letter styles give nothing away.

## Rules

The **Rules** button in the side menu opens the global lists — **Always mask**,
**Never mask**, and your own regular-expression **patterns**. They apply to
every workspace and project. See [`features/rules.md`](features/rules.md).

## Workspaces

The switcher at the top of the side menu keeps separate sets of projects —
one per unit, case load, or client. Everything is stored in this browser only.

## Install it

The deployed site is an installable PWA: use your browser's _Install app_
affordance (on iOS, Safari → Share → _Add to Home Screen_). It works fully
offline and surfaces new deploys through an in-app update prompt.
