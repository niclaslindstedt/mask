# A PDF keeps its headings and its emphasis

A page says things with type as well as with words. A section title is set
larger. A condition is set in bold. A citation leans. Pull the text out of a PDF
the ordinary way and all of it is gone — you get characters, and the model you
hand them to can no longer tell which line was a heading and which sentence
carried the word the author leaned on.

So mask reads the type as well as the text. A paragraph set well above the
document's own body size becomes a Markdown heading, at a level that follows how
far above it stands; a paragraph set at body size but wholly in bold, short, and
without a sentence's punctuation — the other way a document writes a heading —
becomes one too. A bold or italic run becomes `**bold**` or `*italic*`. A
bulleted paragraph becomes a real list item. The body size is measured over the
whole document rather than page by page, so a cover page set large doesn't make
its own type the body and leave the rest of the file without a heading anywhere.

You don't have to read the syntax. The masked text is shown **formatted** — the
headings are headings, the bold is bold — while what the Copy button puts on
your clipboard is the Markdown itself, which is the form a language model reads
that structure in.

## Taking the document with you

Beside **Copy** there is now a **Download** button. It offers two things:

- **PDF document** — the masked text typeset onto paper, headings and lists and
  all, with numbered pages. This is the one to hand to someone who wants a
  document rather than a file of text.
- **Markdown file** — the text exactly as the pane shows it, saved as `.md`.

Both are named after the document they came from, and both are produced in your
browser: nothing you uploaded, and nothing you are downloading, goes anywhere
near a server.
