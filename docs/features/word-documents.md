# Word files, read as Word wrote them

Most of what a Swedish public-sector office actually works in is a Word file. A
decision, a letter, an investigation, an e-mail turned into an attachment — the
PDF is what gets sent, and the `.docx` is what gets written. So drop one onto
the intake, exactly as you would a PDF, and Mask reads it.

It reads it rather better, too. Getting text out of a PDF is archaeology: the
file holds glyphs at coordinates, and everything else — where a paragraph ends,
which line was a heading, which words were in bold — has to be worked out from
the geometry. A Word file still knows. Its own XML says _this paragraph is
Heading 2_, _this run is bold_, _this item is the second bullet at depth one_.
Mask translates that instead of guessing at it, so what comes out carries:

- **Headings**, at the level the document set them at — including in a Swedish
  template, where the style is called `Rubrik1` rather than `Heading 1`.
- **Bold and italics**, whether the writer pressed the button or used the
  **Strong** character style.
- **Lists**, bulleted or numbered as the document has them, indented as deeply
  as the item sits.
- **Tables**, as tables. A table flattened into a run of cells is nonsense to a
  model; a table of names against personal identity numbers is exactly the sort
  of thing you are here to mask.
- **The letterhead.** A running header or footer is kept as a comment, the same
  way a PDF's is, so the case number or the handling officer's name in the
  margin is masked along with everything else rather than quietly dropped.

Tracked changes are taken as accepted — an insertion is text, a deletion is
not — and the field codes Word uses for page numbers stay out of the text.

## Reading it beside the review

Press a document's name in the list, or **Read source** above the review, and a
Word file opens as pages, just as a PDF does: fitted to the column, pinchable,
and takeable over the whole screen.

They are not Word's pages, and the reader says so. A `.docx` is a flow of
paragraphs, not a set of pages — it only becomes pages when a word processor
lays it out, and there is no word processor in a browser. What you get is the
text Mask read, typeset by Mask onto A4. The words, their order, the headings
and the tables are the document's; the page breaks and the faces are not.

That is worth knowing rather than hiding, because it makes the page useful in a
way a facsimile wouldn't be: what you are reading is precisely what the
detectors are working over. **Text** beside **Document** shows the same thing
unformatted, with its copy button.

## What stays on your device

Everything, as always. A Word file is opened, read and typeset in your browser;
nothing about it is uploaded, and no part of it goes anywhere but into this
browser's own storage alongside your projects.

## One format it won't read

`.doc` — Word's own format from before 2007 — is a different thing entirely,
and Mask doesn't read it. It will say so and tell you the fix: open it and save
it as `.docx`. The newer `.docm` and `.dotx` are the same package as a `.docx`
underneath, so those are read like any other.
