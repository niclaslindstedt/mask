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

## A name was not detected

The name detector anchors on dictionaries of common Swedish given names and
surnames plus surname endings; a rare foreign name, a nickname, or a name that
is also an everyday word at the start of a sentence can slip through. Select
it in the preview and press **Mask “…”**, or type it into the add-a-value
field. To catch it everywhere in future, add it to **Rules → Always mask**.

## Something is masked that should not be

Untick it in the review (the project remembers the rejection), or add it to
**Rules → Never mask** to stop it across every project. A whole detector that
misfires on your documents can be switched off in Settings → Masking.

## A placeholder in the answer was not restored

Restore only knows the placeholders of the **current project** — switch to the
project the text was masked in. It also matches placeholders as whole words:
an LLM that rewrote `NAME1` as `Name1` or split it will not be recognised;
fix the token in the answer by hand.

## Where is my data?

In this browser's `localStorage`, under the keys listed in
[`configuration.md`](configuration.md). Clearing site data, a private window,
or another browser starts empty. There is no sync.

## The dev server shows stale content

A service worker installed by an earlier `vite preview` on the same origin can
keep serving old bytes. The dev entry unregisters any worker it finds, so a
hard reload fixes it; otherwise clear site data for `localhost`.
