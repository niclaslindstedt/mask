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
   to browse, or use **Paste text**. The [`examples/`](../examples/) folder has
   fictional Swedish documents to try things on.
3. **Review** — every value the detectors found is listed with a checkbox, its
   kind, and the placeholder it will get. Untick a false positive, change a
   kind, or add a value the detectors missed — type it in, or mark it in the
   preview. Marking text puts three buttons above it: **Mask** (this document),
   **Always mask** (blacklist it for every project), **Never mask** (whitelist
   it, so no detector flags it again). Clicking a highlight in the preview
   toggles it too. The kind picker ends in **Custom type…**: name the value
   yourself ("Judge") and it masks to `JUDGE1` instead of `NAME1`.
4. **Confirm and mask** — the masked text appears in the output pane. Press
   **Copy** and paste it into your LLM.
5. **Restore** — paste the answer into the **Restore** tab; every placeholder
   from the project turns back into its real value. Copy that.

The next document in the same project reuses the placeholders it already has,
so a person masked as `NAME1` in the first letter is `NAME1` in the reply too.

## Reading a document

The review's preview is tinted and clipped because it is there to be decided
about, not read. To read a document as it came in, press the **scroll** glyph
on its row in the document list, or **Read source** above the preview: the
whole extracted text opens unmarked, with a copy button. A PDF is kept as the
text pulled out of it — the file itself is never stored anywhere.

On a phone the document list shares one scroll with the review, so it scrolls
away as you move down, and the intake box above them folds into a single row as
soon as you scroll past it — still there to press, just out of the way. Scroll
back to the top and it unfolds.

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

## Placeholder types

The eight kinds the detectors know are not the only ones you can use. **Custom
type…**, at the end of every kind picker, takes a name for that one value; the
kind-based styles spell it into the placeholder, so a value typed as "Judge"
becomes `JUDGE1`, counted separately from the names and the phone numbers.

Settings → **Masking** → **Placeholder types** keeps the ones you reuse. Each
type is either global or bound to one workspace — **New types apply to** sets
where the next one lands, and the picker on a type's row moves it afterwards.
A workspace-scoped type is gone when you switch workspaces, so a case load's
own vocabulary stays with it. See
[`features/placeholder-types.md`](features/placeholder-types.md).

## Rules

The **Rules** button in the side menu opens the global lists — the
**blacklist** (always mask), the **whitelist** (never mask), and your own
regular-expression **patterns**. They apply to every workspace and project.
Either list also takes a value straight from a review: each row of candidates
carries a blacklist and a whitelist button beside its type. See
[`features/rules.md`](features/rules.md).

## Workspaces

The switcher at the top of the side menu keeps separate sets of projects —
one per unit, case load, or client. Everything is stored in this browser only.

## Install it

The deployed site is an installable PWA: use your browser's _Install app_
affordance (on iOS, Safari → Share → _Add to Home Screen_). It works fully
offline and surfaces new deploys through an in-app update prompt.
