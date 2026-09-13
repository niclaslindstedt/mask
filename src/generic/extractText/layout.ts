// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Positioned text runs → readable prose.
//
// A PDF has no paragraphs. It has glyphs at coordinates, handed back in the
// order the producer happened to draw them, and a naive extractor turns every
// *visual* line into a text line — so a wrapped sentence arrives cut into
// column-width strips, a hyphenated word arrives in halves, and a footer drawn
// before the body arrives in the middle of it. Anything reading the text
// afterwards (a person, a detector, a language model) then has to undo that.
//
// This module puts the page back together, from geometry alone:
//
//   1. `groupRunsIntoLines` — runs sharing a baseline are one line.
//   2. `splitIntoBlocks`    — a line drawn *above* the previous one, or a long
//                             leap below it, starts a new block; blocks are
//                             then ordered top-to-bottom, left-to-right, which
//                             is the reading order of a single- or
//                             multi-column page whatever order the producer
//                             drew the blocks in.
//   3. `reflowBlock`        — inside a block, consecutive lines belong to the
//                             same paragraph unless the leading grows, the line
//                             is indented, a list marker starts it, or the
//                             previous line stopped well short of the margin.
//
// Alongside the geometry it carries each run's *style* — whether the producer
// drew it in a bold or an italic face — through to the paragraph, so a caller
// can put the emphasis back into the text it renders (see `markup.ts`). The
// geometry never reads the style, and every decision above is taken on the
// plain text, so a marked-up paragraph breaks exactly where a plain one would.
//
// Everything here is pure and unit-testable: coordinates in, text out, no PDF
// library in sight.

/** One positioned run of text, as a PDF viewer reports it. `x` / `y` are the
 *  left end of the run's baseline in PDF user space, where y grows *upward*. */
export type TextRun = {
  text: string;
  x: number;
  y: number;
  /** Advance width of the run. */
  width: number;
  /** Glyph height — effectively the font size. */
  height: number;
  /** The producer ended a line after this run. */
  hasEOL?: boolean;
  /** Drawn in a bold face. */
  bold?: boolean;
  /** Drawn in an italic face. */
  italic?: boolean;
};

/** A stretch of text drawn in one style — the unit emphasis is put back on. */
export type StyledSegment = { text: string; bold: boolean; italic: boolean };

/** A run of text on one baseline, with the horizontal extent it covers. */
export type TextLine = {
  text: string;
  /** Baseline, in PDF user space. */
  y: number;
  /** Left edge of the first run. */
  left: number;
  /** Right edge of the last run. */
  right: number;
  /** Tallest glyph on the line. */
  height: number;
  /** The line's text split into runs of one style. Concatenating these gives
   *  `text` back exactly. */
  segments: StyledSegment[];
};

/** One paragraph of reflowed text: the plain string every heuristic here reads,
 *  the same text split by style, and the shape a caller needs to tell a heading
 *  from a body paragraph. */
export type Paragraph = {
  /** The paragraph's text, styling stripped. */
  text: string;
  /** The same text split into runs of one style. */
  segments: StyledSegment[];
  /** Tallest glyph in the paragraph — how a heading gives itself away. */
  height: number;
  /** Printed lines the paragraph was reflowed from. */
  lines: number;
  /** A running header or footer rather than prose — see
   *  {@link partitionRunningFurniture}. A caller writing the document out marks
   *  these as the aside they are instead of running them in with the text. */
  furniture?: boolean;
};

/** Two baselines this close are the same line. Kept tight on purpose: merging
 *  two body lines by accident glues two sentences together, which is worse
 *  than splitting off a superscript. */
const BASELINE_TOLERANCE = 2;

/** A line drawn this much higher than the previous one starts a new block —
 *  scaled from the page's line pitch so a superscript doesn't count. */
const BLOCK_JUMP_RATIO = 0.5;

/** A drop of this many lines is a leap across the page rather than a
 *  paragraph break, and starts a new block too. */
const BLOCK_GAP_RATIO = 3;

/** Leading above this multiple of the block's own pitch ends a paragraph. */
const PARAGRAPH_GAP_RATIO = 1.35;

/** A first line indented this far past the block's left margin (relative to
 *  the font height) starts a paragraph. */
const INDENT_RATIO = 0.4;

/** A line stopping this far short of the page's right margin (as a fraction of
 *  the page's text width) is a paragraph's last line rather than a wrap. */
const SHORT_LINE_RATIO = 0.2;

/** Falls back to this multiple of the font height when a page has too few
 *  lines to measure the leading from. */
const DEFAULT_PITCH_RATIO = 1.6;

/** Drops needed before the commonest of them is taken for the leading. */
const MIN_PITCH_SAMPLES = 3;

/** Drops within this many points of each other are the same leading. */
const PITCH_BUCKET = 2;

/** `1.` / `12)` / `a)` / `•` / `–` at the head of a line. */
const LIST_MARKER =
  /^(?:[([]?(?:\d{1,3}|[a-zA-Z]|[ivxlIVXL]{1,5})[.)\]]|[-–—•*·])\s+\S/;

/** Sentence-ending punctuation, optionally closed by a quote or bracket. */
const SENTENCE_END = /[.!?:;][")'\]]?$/;

/** A word broken across lines by a soft hyphen: the halves join up. */
const SOFT_HYPHEN_BREAK = /\p{Ll}-$/u;

/** The left margin most of these lines share — the body's own, unaffected by
 *  the one header that starts further out or the one line that is indented.
 *  Lefts within a point of each other count as the same margin; a tie goes to
 *  the leftmost, so an indent reads as an indent. */
export function commonLeft(lines: readonly TextLine[]): number {
  const buckets = new Map<number, { count: number; left: number }>();
  for (const line of lines) {
    const key = Math.round(line.left);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.count += 1;
      bucket.left = Math.min(bucket.left, line.left);
    } else {
      buckets.set(key, { count: 1, left: line.left });
    }
  }
  let best: { count: number; left: number } | null = null;
  for (const bucket of buckets.values()) {
    if (
      !best ||
      bucket.count > best.count ||
      (bucket.count === best.count && bucket.left < best.left)
    ) {
      best = bucket;
    }
  }
  return best?.left ?? 0;
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

// ── Styled segments ─────────────────────────────────────────────────────────

/** The plain text a run of segments spells. */
export function segmentsText(segments: readonly StyledSegment[]): string {
  return segments.map((s) => s.text).join("");
}

/** A face, without the text it is set in. */
type Style = { bold: boolean; italic: boolean };

/** Whether two segments can be spelled as one. */
function sameStyle(a: Style, b: Style): boolean {
  return a.bold === b.bold && a.italic === b.italic;
}

/** Append `text` to `segments` in `style`, extending the last segment when it
 *  is already in that style rather than starting a second one beside it. */
function pushText(segments: StyledSegment[], text: string, style: Style): void {
  if (text === "") return;
  const last = segments[segments.length - 1];
  if (last && sameStyle(last, style)) last.text += text;
  else segments.push({ text, bold: style.bold, italic: style.italic });
}

/** Collapse every whitespace run to a single space and trim both ends —
 *  `String.replace(/\s+/g, " ").trim()` over a list of segments, so the text
 *  and its styling stay spelled the same way. */
export function normalizeSegments(
  segments: readonly StyledSegment[],
): StyledSegment[] {
  const out: StyledSegment[] = [];
  let pendingSpace = false;
  for (const segment of segments) {
    for (const piece of segment.text.split(/(\s+)/)) {
      if (piece === "") continue;
      if (/^\s+$/.test(piece)) {
        // A gap only becomes a space once something follows it, which drops a
        // leading one; the trailing one is dropped by never flushing at the end.
        pendingSpace = out.length > 0;
        continue;
      }
      if (pendingSpace) {
        pushText(out, " ", { bold: segment.bold, italic: segment.italic });
        pendingSpace = false;
      }
      pushText(out, piece, segment);
    }
  }
  return out;
}

/** Group runs onto shared baselines, inserting a space wherever the producer
 *  positioned the next run clear of the previous one's end rather than writing
 *  one. Runs are taken in the order given: a viewer hands them back in content
 *  order, and within a block that is the order they read in. */
export function groupRunsIntoLines(runs: readonly TextRun[]): TextLine[] {
  const lines: TextLine[] = [];
  let current: TextLine | null = null;
  let lastEnd = 0;

  for (const run of runs) {
    const sameLine =
      current !== null && Math.abs(run.y - current.y) <= BASELINE_TOLERANCE;
    if (!sameLine) {
      if (current) lines.push(current);
      current = {
        text: "",
        y: run.y,
        left: run.x,
        right: run.x + run.width,
        height: run.height,
        segments: [],
      };
      lastEnd = run.x;
    }
    const line = current!;
    const style = { bold: run.bold === true, italic: run.italic === true };
    // A gap wider than a fraction of the glyph height is a space the producer
    // drew as positioning rather than as a character.
    const gap = run.x - lastEnd;
    if (line.text !== "" && gap > Math.max(1, run.height * 0.2)) {
      if (!line.text.endsWith(" ")) {
        line.text += " ";
        pushText(line.segments, " ", style);
      }
    }
    line.text += run.text;
    pushText(line.segments, run.text, style);
    line.left = Math.min(line.left, run.x);
    line.right = Math.max(line.right, run.x + run.width);
    line.height = Math.max(line.height, run.height);
    lastEnd = run.x + run.width;
    // An explicit end-of-line means the next run starts fresh, however its
    // baseline compares.
    if (run.hasEOL) {
      lines.push(line);
      current = null;
      lastEnd = 0;
    }
  }
  if (current) lines.push(current);

  return lines
    .map((line) => {
      const segments = normalizeSegments(line.segments);
      return { ...line, segments, text: segmentsText(segments) };
    })
    .filter((line) => line.text !== "");
}

/** The drops from each line to the next, skipping the jumps back up the page. */
function drops(lines: readonly TextLine[]): number[] {
  const out: number[] = [];
  for (let i = 1; i < lines.length; i++) {
    const drop = lines[i - 1]!.y - lines[i]!.y;
    if (drop > 0) out.push(drop);
  }
  return out;
}

/** The leading of a run of lines: the drop from one line to the next that
 *  turns up most often, ties going to the smaller.
 *
 *  The commonest drop rather than the median one, because a block of one-line
 *  paragraphs drops by a paragraph gap as often as by a line, and the median
 *  of the two would then take a paragraph break for a line break. The tie
 *  breaks small for the same reason. Under `MIN_PITCH_SAMPLES` drops there is
 *  no commonest anything, and the font height answers for it. */
function pitchOf(lines: readonly TextLine[], fallback?: number): number {
  const measured = drops(lines);
  if (measured.length >= MIN_PITCH_SAMPLES) {
    const buckets = new Map<number, number[]>();
    for (const drop of measured) {
      const key = Math.round(drop / PITCH_BUCKET);
      buckets.set(key, [...(buckets.get(key) ?? []), drop]);
    }
    let best: number[] | null = null;
    // Ascending by bucket, so a tie leaves the smallest leading standing.
    for (const [, bucket] of [...buckets].sort(([a], [b]) => a - b)) {
      if (!best || bucket.length > best.length) best = bucket;
    }
    return median(best!)!;
  }
  if (fallback !== undefined) return fallback;
  const height = median(lines.map((line) => line.height)) ?? 12;
  return height * DEFAULT_PITCH_RATIO;
}

/** Cut the lines into blocks wherever the producer leapt across the page,
 *  then read the blocks top-to-bottom, left-to-right.
 *
 *  A jump back up the page, or a leap down it, is what separates a header, a
 *  footer, a marginal note or a second column from the body — a producer draws
 *  each as its own run of lines, and which run it draws first says nothing
 *  about where the block sits. Ordering the blocks by position rather than by
 *  content order puts a footer at the foot of the page and reads two columns
 *  one after the other. */
export function splitIntoBlocks(lines: readonly TextLine[]): TextLine[][] {
  if (lines.length === 0) return [];
  const pitch = pitchOf(lines);
  const jump = Math.max(BASELINE_TOLERANCE, pitch * BLOCK_JUMP_RATIO);
  const leap = pitch * BLOCK_GAP_RATIO;
  const blocks: TextLine[][] = [];
  let block: TextLine[] = [];
  for (const line of lines) {
    const previous = block[block.length - 1];
    const step = previous ? previous.y - line.y : 0;
    if (previous && (-step > jump || step > leap)) {
      blocks.push(block);
      block = [];
    }
    block.push(line);
  }
  if (block.length > 0) blocks.push(block);

  // Blocks whose tops are level are side by side: read those left to right.
  const level = Math.max(BASELINE_TOLERANCE, pitch * 0.5);
  return blocks
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => {
      const dy = b.entry[0]!.y - a.entry[0]!.y;
      if (Math.abs(dy) > level) return dy;
      const dx = a.entry[0]!.left - b.entry[0]!.left;
      if (Math.abs(dx) > 1) return dx;
      return a.index - b.index;
    })
    .map(({ entry }) => entry);
}

/** Join a wrapped line onto the paragraph so far. A word the producer split
 *  with a soft hyphen is put back together; anything else gets a space. */
function appendWrappedSegments(
  paragraph: readonly StyledSegment[],
  line: readonly StyledSegment[],
): StyledSegment[] {
  const text = segmentsText(paragraph);
  const next = segmentsText(line);
  const out = paragraph.map((segment) => ({ ...segment }));
  const last = out[out.length - 1];
  if (text.endsWith("-")) {
    // Nothing follows a hyphen at a line end but the rest of the word, so
    // never a space. "multi-" + "verktyg" → "multiverktyg", with the hyphen
    // dropped as the soft hyphen it was; "A-" + "traktor" keeps the hyphen
    // the writer typed, which a capital or a digit before it gives away.
    if (last && SOFT_HYPHEN_BREAK.test(text) && /^\p{Ll}/u.test(next)) {
      last.text = last.text.slice(0, -1);
      if (last.text === "") out.pop();
    }
  } else if (last) {
    pushText(out, " ", last);
  }
  for (const segment of line) pushText(out, segment.text, segment);
  return out;
}

/** Whether `line` ends a paragraph rather than wrapping into `next`, within a
 *  block whose margins and leading are `block`. */
function breaksParagraph(
  line: TextLine,
  next: TextLine,
  block: { left: number; right: number; pitch: number },
): boolean {
  // Extra leading — the commonest paragraph mark in a typeset document.
  if (line.y - next.y > block.pitch * PARAGRAPH_GAP_RATIO) return true;
  // A first-line indent, the other one.
  if (next.left - block.left > next.height * INDENT_RATIO) return true;
  // A list or numbered item starts its own paragraph.
  if (LIST_MARKER.test(next.text) && SENTENCE_END.test(line.text)) return true;
  // Nothing else forces a break, so fall back to the shape of the line: prose
  // that wraps runs out to the margin, and a line stopping well short of it
  // was the end of something — a paragraph, an address line, a signature.
  const slack = Math.max(block.right - block.left, 1) * SHORT_LINE_RATIO;
  return line.right < block.right - slack;
}

/** Reflow one block's lines into paragraphs. Margins are the block's own: a
 *  column, a marginal note or an address panel is narrower than the page, and
 *  its lines still reach *its* right edge when they wrap. */
export function reflowBlockStyled(
  block: readonly TextLine[],
  pagePitch: number,
): Paragraph[] {
  if (block.length === 0) return [];
  const metrics = {
    left: commonLeft(block),
    right: Math.max(...block.map((line) => line.right)),
    pitch: pitchOf(block, pagePitch),
  };

  const paragraphs: Paragraph[] = [];
  const started = (line: TextLine): Paragraph => ({
    text: line.text,
    segments: line.segments.map((segment) => ({ ...segment })),
    height: line.height,
    lines: 1,
  });
  let paragraph = started(block[0]!);
  for (let i = 1; i < block.length; i++) {
    const line = block[i]!;
    if (breaksParagraph(block[i - 1]!, line, metrics)) {
      paragraphs.push(paragraph);
      paragraph = started(line);
    } else {
      paragraph.segments = appendWrappedSegments(
        paragraph.segments,
        line.segments,
      );
      paragraph.text = segmentsText(paragraph.segments);
      paragraph.height = Math.max(paragraph.height, line.height);
      paragraph.lines += 1;
    }
  }
  paragraphs.push(paragraph);
  return paragraphs;
}

/** {@link reflowBlockStyled}, as plain text. */
export function reflowBlock(
  block: readonly TextLine[],
  pagePitch: number,
): string[] {
  return reflowBlockStyled(block, pagePitch).map((p) => p.text);
}

/** One page's positioned runs → its paragraphs, in reading order. */
export function layoutPageParagraphs(runs: readonly TextRun[]): string[] {
  return layoutLines(groupRunsIntoLines(runs));
}

/** One page's lines → its paragraphs, in reading order. */
export function layoutLinesStyled(lines: readonly TextLine[]): Paragraph[] {
  if (lines.length === 0) return [];
  const pitch = pitchOf(lines);
  return splitIntoBlocks(lines).flatMap((block) =>
    reflowBlockStyled(block, pitch),
  );
}

/** {@link layoutLinesStyled}, as plain text. */
export function layoutLines(lines: readonly TextLine[]): string[] {
  return layoutLinesStyled(lines).map((p) => p.text);
}

/** One page's positioned runs → its text, one paragraph per line. */
export function layoutPageText(runs: readonly TextRun[]): string {
  return layoutPageParagraphs(runs).join("\n\n");
}

// ── Whole documents ─────────────────────────────────────────────────────────

/** A document needs at least this many pages before a repeated line counts as
 *  running furniture — on two pages a repeat is as likely to be content. */
const MIN_FURNITURE_PAGES = 3;

/** How many lines at each end of a page can be furniture. */
const FURNITURE_DEPTH = 2;

/** Two furniture candidates this far apart vertically are drawn at the same
 *  height on their respective pages. */
const FURNITURE_Y_TOLERANCE = 2;

/** A running header or footer with the page number, the date or the section
 *  number taken out, so "Sida 3" and "Sida 4" are recognisably the same line. */
function furnitureKey(line: TextLine): string {
  return `${Math.round(line.y / FURNITURE_Y_TOLERANCE)}|${line.text
    .replace(/\d+/g, "#")
    .toLowerCase()}`;
}

/** The lines at the top and bottom of a page — all a header or footer can be. */
function edges(page: readonly TextLine[]): TextLine[] {
  return [...page.slice(0, FURNITURE_DEPTH), ...page.slice(-FURNITURE_DEPTH)];
}

/** Whether the line at `index` stands apart from the page's body: a header or
 *  a footer sits out in the margin, clear of the text block by more than a
 *  line. `towardsBody` is +1 for a line at the top of the page, -1 for one at
 *  the bottom — which side the body it should be clear of lies on. */
function isDetached(
  page: readonly TextLine[],
  index: number,
  towardsBody: 1 | -1,
): boolean {
  const neighbour = page[index + towardsBody];
  if (!neighbour) return true;
  const gap = Math.abs(page[index]!.y - neighbour.y);
  return gap > pitchOf(page) * PARAGRAPH_GAP_RATIO;
}

/** One page, with its running furniture told apart from what it says. */
export type PageParts = {
  /** The running header, top-down. */
  head: TextLine[];
  /** Everything between the two — the page's own text. */
  body: TextLine[];
  /** The running footer, top-down. */
  foot: TextLine[];
};

/** Tell the running headers and footers from the body: the page-number bar a
 *  producer repeats at the same height on page after page. They are the one
 *  part of a page that isn't prose — run in with it, they cut a sentence in
 *  half at every page break, and a reader (or a detector) has to step over
 *  them — so a caller lays out `body` as the text and writes `head` and `foot`
 *  out as the aside they are.
 *
 *  Two things have to hold before a line is treated as furniture rather than
 *  as content, and body text does neither: it repeats, page numbers aside, at
 *  the same height on at least three pages, and it stands clear of the text
 *  block on its own page. */
export function partitionRunningFurniture(
  pages: readonly (readonly TextLine[])[],
): PageParts[] {
  const kept = pages.map((page) => [...page]);
  if (pages.length < MIN_FURNITURE_PAGES) {
    return kept.map((body) => ({ head: [], body, foot: [] }));
  }

  const seen = new Map<string, number>();
  for (const page of kept) {
    for (const line of new Set(edges(page))) {
      const key = furnitureKey(line);
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
  }

  return kept.map((page) => {
    const furniture = (index: number, towardsBody: 1 | -1) =>
      (seen.get(furnitureKey(page[index]!)) ?? 0) >= MIN_FURNITURE_PAGES &&
      isDetached(page, index, towardsBody);
    let head = 0;
    while (
      head < Math.min(FURNITURE_DEPTH, page.length) &&
      furniture(head, 1)
    ) {
      head += 1;
    }
    let tail = page.length;
    while (
      tail > head &&
      page.length - tail < FURNITURE_DEPTH &&
      furniture(tail - 1, -1)
    ) {
      tail -= 1;
    }
    return {
      head: page.slice(0, head),
      body: page.slice(head, tail),
      foot: page.slice(tail),
    };
  });
}

/** Whether the paragraph `first` ran on into `second` across a page break —
 *  it stopped without finishing its sentence and the next page picks it up
 *  mid-sentence. */
function continuesAcrossPages(first: string, second: string): boolean {
  return (
    first !== "" &&
    second !== "" &&
    !SENTENCE_END.test(first) &&
    /^[\p{Ll}(]/u.test(second)
  );
}

/** A whole document's positioned runs, page by page → its text.
 *
 *  Beyond laying out each page, this is where the page break itself is undone:
 *  the running header is dropped and a paragraph cut in half by the break is
 *  put back together. */
export function layoutDocumentText(
  pages: readonly (readonly TextRun[])[],
): string {
  return layoutDocumentLines(pages.map((runs) => groupRunsIntoLines(runs)));
}

/** One furniture line as a paragraph of its own, flagged so whatever writes
 *  the document out can set it apart from the prose around it. */
function furnitureParagraph(line: TextLine): Paragraph {
  return {
    text: line.text,
    segments: line.segments.map((segment) => ({ ...segment })),
    height: line.height,
    lines: 1,
    furniture: true,
  };
}

/** The same, from pages already grouped into lines — what a caller reading a
 *  long document wants, so a page's runs can be dropped as it is read.
 *
 *  The running header and footer are kept, flagged rather than run in with the
 *  text, and a paragraph the page break cut in half is joined back onto the
 *  last paragraph of *prose* — the furniture standing between the halves is
 *  where it was drawn, not part of the sentence. */
export function layoutDocumentParagraphs(
  pages: readonly (readonly TextLine[])[],
): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  // The paragraph a sentence running past the page break carries on into.
  // Held apart from the end of the list, which is a footer as often as not.
  let prose: Paragraph | null = null;
  for (const { head, body, foot } of partitionRunningFurniture(pages)) {
    for (const line of head) paragraphs.push(furnitureParagraph(line));
    const laid = layoutLinesStyled(body);
    // Annotated, both of these: the value each takes is decided from `prose`,
    // which the next line assigns from them, and TypeScript will not infer its
    // way around that loop.
    const carried: Paragraph | null =
      prose !== null &&
      laid.length > 0 &&
      continuesAcrossPages(prose.text, laid[0]!.text)
        ? laid[0]!
        : null;
    if (carried && prose) {
      prose.segments = appendWrappedSegments(prose.segments, carried.segments);
      prose.text = segmentsText(prose.segments);
      prose.height = Math.max(prose.height, carried.height);
      prose.lines += carried.lines;
    }
    const kept: Paragraph[] = carried ? laid.slice(1) : laid;
    paragraphs.push(...kept);
    // A page whose whole text was carried onto the previous paragraph leaves
    // that paragraph the one still open — the carried copy is no longer in the
    // list, so it must never become the next page's anchor.
    prose = kept[kept.length - 1] ?? prose;
    for (const line of foot) paragraphs.push(furnitureParagraph(line));
  }
  return paragraphs;
}

/** {@link layoutDocumentParagraphs}, as plain text. */
export function layoutDocumentLines(
  pages: readonly (readonly TextLine[])[],
): string {
  return layoutDocumentParagraphs(pages)
    .map((paragraph) => paragraph.text)
    .join("\n\n");
}

/** The size the document's *body* is set in — the glyph height that carries
 *  the most text, bucketed to the nearest half point. Headings are recognised
 *  by standing above it, so it has to be the size of the running prose rather
 *  than the average of prose and display type: weighting each line by how many
 *  characters it holds is what keeps a page of body text from being outvoted
 *  by a cover page of large ones. */
export function bodyTextHeight(
  pages: readonly (readonly TextLine[])[],
): number {
  const weight = new Map<number, number>();
  for (const page of pages) {
    for (const line of page) {
      const key = Math.round(line.height * 2) / 2;
      if (key <= 0) continue;
      weight.set(key, (weight.get(key) ?? 0) + line.text.length);
    }
  }
  let best = 0;
  let bestWeight = -1;
  // Ascending, so a tie leaves the smaller size standing — body type is
  // commoner than display type, never the other way round.
  for (const [height, chars] of [...weight].sort(([a], [b]) => a - b)) {
    if (chars > bestWeight) {
      best = height;
      bestWeight = chars;
    }
  }
  return best;
}
