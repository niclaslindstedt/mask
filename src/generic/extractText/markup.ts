// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Reflowed paragraphs → Markdown.
//
// The layout pass (`layout.ts`) recovers *what the page said*; this one
// recovers *how it said it*. A PDF has no headings and no bold — it has type
// set larger, and type set in a second face — and an extractor that hands back
// only characters throws both away. Anything reading the text afterwards (a
// person, a language model) then can't tell a section title from a sentence.
//
// So each paragraph is written back out as Markdown:
//
//   * **Headings** from size. A paragraph set well above the document's body
//     size is a heading, at a level that follows how far above it stands. A
//     paragraph set *at* body size but wholly in bold, short, and without a
//     sentence's punctuation is the other way a document writes a heading.
//   * **Emphasis** from the face. A run drawn bold or italic is wrapped in the
//     Markdown that means the same thing, with any surrounding space left
//     outside the markers — `**bold**` binds to the word, never to the gap.
//   * **Bullets** from the glyph. A paragraph opening with a bullet character
//     becomes a real `-` list item; a numbered one already spells itself.
//   * **Furniture** as a comment. A running header or footer is not what the
//     page says, so it is written as the HTML comment Markdown borrows for the
//     purpose — still there for anyone who wants to know which page a passage
//     came from, out of the prose for everyone else.
//
// Pure: paragraphs in, a string out.

import { htmlComment } from "../htmlComments.ts";
import type { Paragraph, StyledSegment } from "./layout.ts";

/** How far above the body size a paragraph has to stand to be a heading, per
 *  level. Read in order: the first a paragraph clears is its level. */
const HEADING_RATIOS: readonly number[] = [1.9, 1.45, 1.15];

/** A bold paragraph longer than this is a bold sentence, not a heading. */
const BOLD_HEADING_MAX_CHARS = 90;

/** The deepest a bold-but-body-sized heading is taken to be. */
const BOLD_HEADING_LEVEL = 3;

/** Sentence-ending punctuation. A line carrying it finished a thought, which a
 *  heading does not. */
const SENTENCE_END = /[.!?:;][")'\]]?$/;

/** The glyphs a producer draws an unnumbered list item with. */
const BULLET = /^[-–—•*·▪◦‣]\s+/;

/** `1.` / `12)` — already the Markdown for an ordered item. */
const ORDINAL = /^\d{1,3}[.)]\s+/;

/** Leading and trailing whitespace around the text an emphasis marker binds
 *  to: Markdown only opens an emphasis against a non-space, so a segment's own
 *  padding has to stay outside the markers. */
const PADDED = /^(\s*)([\s\S]*?)(\s*)$/;

export type MarkupOptions = {
  /** The glyph height the document's body text is set at — what a heading is
   *  measured against. A zero or missing value turns size headings off. */
  bodyHeight?: number;
};

/** Whether every segment carrying text is bold. A document set wholly in one
 *  bold face has no emphasis to recover — marking all of it up would only add
 *  noise — so `paragraphsToMarkdown` drops bold when this holds document-wide. */
function allBold(segments: readonly StyledSegment[]): boolean {
  const inked = segments.filter((segment) => segment.text.trim() !== "");
  return inked.length > 0 && inked.every((segment) => segment.bold);
}

/** The heading level a paragraph asks for, or 0 for body text. */
export function headingLevel(
  paragraph: Paragraph,
  bodyHeight: number,
  emphatic: boolean,
): number {
  if (bodyHeight > 0) {
    const ratio = paragraph.height / bodyHeight;
    for (const [index, threshold] of HEADING_RATIOS.entries()) {
      if (ratio >= threshold) return index + 1;
    }
  }
  // Body-sized, but the whole paragraph is bold: a heading if it reads like
  // one — one printed line, short, and not a sentence. `emphatic` is false in
  // a document set wholly in bold, where bold says nothing.
  if (
    emphatic &&
    paragraph.lines === 1 &&
    paragraph.text.length <= BOLD_HEADING_MAX_CHARS &&
    !SENTENCE_END.test(paragraph.text) &&
    allBold(paragraph.segments)
  ) {
    return BOLD_HEADING_LEVEL;
  }
  return 0;
}

/** One segment, with the Markdown for its face wrapped around it. */
function emphasise(segment: StyledSegment, emphatic: boolean): string {
  const [, lead = "", core = "", trail = ""] = PADDED.exec(segment.text) ?? [];
  if (core === "") return segment.text;
  let out = core;
  if (emphatic && segment.italic) out = `*${out}*`;
  if (emphatic && segment.bold) out = `**${out}**`;
  return `${lead}${out}${trail}`;
}

/** The Markdown marker a paragraph's own leading list glyph maps to, and how
 *  many of its characters that marker replaces. A numbered item already spells
 *  itself, so it keeps its own text; a bullet drawn as `•` (or an en dash, or
 *  an asterisk) is swapped for the `-` a Markdown reader knows. */
function listMarker(text: string): { prefix: string; consumed: number } | null {
  if (ORDINAL.test(text)) return { prefix: "", consumed: 0 };
  const bullet = BULLET.exec(text);
  return bullet ? { prefix: "- ", consumed: bullet[0].length } : null;
}

/** The segments with their first `count` characters taken off. */
function dropLeading(
  segments: readonly StyledSegment[],
  count: number,
): StyledSegment[] {
  const out: StyledSegment[] = [];
  let left = count;
  for (const segment of segments) {
    if (left <= 0) {
      out.push(segment);
    } else if (segment.text.length <= left) {
      left -= segment.text.length;
    } else {
      out.push({ ...segment, text: segment.text.slice(left) });
      left = 0;
    }
  }
  return out;
}

/** One paragraph as a line of Markdown. */
export function paragraphMarkdown(
  paragraph: Paragraph,
  options: MarkupOptions & { emphatic?: boolean } = {},
): string {
  // A running header or footer is an aside about the page, never prose: it is
  // written as a comment whatever it is set in, so neither its size nor its
  // face can make a heading of it.
  if (paragraph.furniture) return htmlComment(paragraph.text);
  const emphatic = options.emphatic ?? true;
  const marker = listMarker(paragraph.text);
  const segments = marker
    ? dropLeading(paragraph.segments, marker.consumed)
    : paragraph.segments;
  const body = segments.map((segment) => emphasise(segment, emphatic)).join("");

  // A list item is never a heading, whatever size it is set at.
  if (marker) return marker.prefix + body;

  const level = headingLevel(paragraph, options.bodyHeight ?? 0, emphatic);
  // A heading is emphatic by being a heading, so it is written plain: `##
  // **Rubrik**` renders the same and reads worse.
  return level > 0 ? `${"#".repeat(level)} ${paragraph.text}` : body;
}

/** A document's paragraphs as Markdown, one paragraph per block. */
export function paragraphsToMarkdown(
  paragraphs: readonly Paragraph[],
  options: MarkupOptions = {},
): string {
  const emphatic = !allBold(
    paragraphs.filter((p) => !p.furniture).flatMap((p) => p.segments),
  );
  return paragraphs
    .map((paragraph) => paragraphMarkdown(paragraph, { ...options, emphatic }))
    .join("\n\n");
}
