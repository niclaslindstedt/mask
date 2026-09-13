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

## The page's furniture, out of the prose

A judgment repeats its court, its case number and its page number at the top of
every page. Read the text out the ordinary way and that bar lands in the middle
of whatever sentence the page break fell on; drop it and you lose the one thing
that says which page a passage came from.

So a running header or footer now comes through as a comment —
`<!-- HÖGSTA DOMSTOLEN B 4808-23 Sida 2 -->` — on its own line, where it was
drawn. Markdown has no comment of its own, and the HTML one is what every
renderer and every language model already reads as "this was on the page, but
it is not the text": the model sees the page boundary without mistaking the
header for a sentence. The sentence the page break cut in half is still put
back together across it.

A comment is still text like any other, so a name in a footer is still masked.
Reading the document, you see it as a small aside rather than as its markers,
and a PDF you download is typeset without it — it is a note about the page, not
something to print on one.

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
