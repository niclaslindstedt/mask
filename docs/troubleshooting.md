# Troubleshooting

## `npm install` returns 401

The `@niclaslindstedt/oss-framework` package is served from GitHub Packages,
which requires a token even for public packages. Put a `read:packages` token in
`~/.npmrc`:

```
//npm.pkg.github.com/:_authToken=<token>
```

## A PDF adds with "contains no text"

The file is a scanned image without a text layer. Run it through OCR first
(any PDF tool that adds a text layer), or copy the text out and use **Paste
text**.

## A PDF's text comes out in the wrong order, or a paragraph is broken up

Text is reassembled from where the glyphs sit on the page: lines that wrap into
one another become one paragraph, and blocks are read top-to-bottom,
left-to-right. A page laid out in a way that geometry can't speak for — a
table, a form with side-by-side boxes, text flowing around a figure — can still
come out ordered oddly or run together. Edit the document text in the intake,
or copy the part you need and use **Paste text**.

## A PDF's headings or bold text did not survive

Headings are recognised from the size a paragraph is set at, relative to the
size carrying most of the document's text, and from a short, bold, unpunctuated
line at that size. A document whose headings are set in the same face and size
as the body — distinguished only by a colour, a rule, or the space around them
— has nothing for that to read, and the line stays a paragraph.

Bold and italic come off the face the producer drew each run in. A PDF whose
fonts carry no descriptor and no telling name (a subsetted `BCDEEE+Garamond`
rather than a `TimesNewRomanPS-BoldMT`) leaves the run unmarked, and a document
set _wholly_ in one bold face is deliberately left unmarked too — bold says
nothing when everything is bold. Nothing is lost either way: the words are all
there, and you can type the `#` or the `**` in yourself.

## A PDF fails to read on an older browser

Text extraction runs on pdf.js, which needs a browser from late 2023 or newer
(Safari / iOS 17.4, Chrome 119, Firefox 121). Everything else in the app works
without it — copy the text out of the PDF and use **Paste text**.

## A name was not detected

The name detector anchors on dictionaries of common Swedish given names and
surnames plus surname endings; a rare foreign name, a nickname, or a name that
is also an everyday word at the start of a sentence can slip through. Mark it
in the preview and press **Mask**, or type it into the add-a-value field. To
catch it everywhere in future, press **Always mask** on the marked text
instead — it masks the value here and blacklists it for every project.

## Something is masked that should not be

Untick it in the review (the project remembers the rejection), or add it to
**Rules → Never mask** to stop it across every project — the row's whitelist
button and **Never mask** on marked text do the same thing without leaving the
review. A whole detector that
misfires on your documents can be switched off in Settings → Masking.

## A placeholder type I added is gone

A placeholder type is either global or bound to one workspace, and a
workspace-bound one is only offered in the workspace it was added in — check
which workspace you are in, and what **New types apply to** was set to when you
added it. The picker on a type's row in Settings → Masking → **Placeholder
types** moves it between the two.

## A value still masks to NAME1 after I re-typed it

Changing a placeholder's type renames it only when the app was the one that
named it; a placeholder you typed by hand keeps the name you gave it. The
letter and `$1` styles ignore the type altogether, so `AAA` stays `AAA`
whatever it stands for — switch the project to a kind-based style in its
**Placeholders** tab to see the type in the placeholder. A document masked
before the change keeps its old text until you confirm the review again.

## A placeholder in the answer was not restored

Restore only knows the placeholders of the **current project** — switch to the
project the text was masked in. It also matches placeholders as whole words:
an LLM that rewrote `NAME1` as `Name1` or split it will not be recognised;
fix the token in the answer by hand.

## Where is my data?

In this browser's `localStorage`, under the keys listed in
[`configuration.md`](configuration.md), plus the `mask:sources` IndexedDB
database holding the PDFs you uploaded. Clearing site data, a private window,
or another browser starts empty. There is no sync.

## The dev server shows stale content

A service worker installed by an earlier `vite preview` on the same origin can
keep serving old bytes. The dev entry unregisters any worker it finds, so a
hard reload fixes it; otherwise clear site data for `localhost`.
