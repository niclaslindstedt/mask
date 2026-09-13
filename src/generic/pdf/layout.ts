// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Lays Markdown out on paper: a document in, a list of pages of drawing
// operations out. This is the typesetter — every decision about *where a thing
// goes* is made here. Turning those operations into an actual PDF file is
// `write.ts`, which knows about the PDF library and nothing about Markdown.
//
// The split is what keeps this half pure: no DOM, no I/O, no PDF library, so
// pagination is unit-testable on its own. The one thing it cannot know is
// injected — **`measure`**, how wide a string is in a given face at a given
// size. Text metrics belong to the writer, and the writer must agree with the
// typesetter exactly or lines wrap in the wrong place.
//
// Coordinates are **points from the top-left of the page**. A `text` op's `y`
// is its baseline; a `rect`'s is its top edge.

import {
  classifyLines,
  parseInline,
  type InlineNode,
  type LineBlock,
} from "@niclaslindstedt/oss-framework/markdown";

import { isCommentLine } from "../htmlComments.ts";

// ── The contract with the writer ────────────────────────────────────────────

/** One concrete face, as the writer must set it. */
export type PdfFontStyle = {
  /** `body` is the proportional face; `mono` sets code. */
  family: "body" | "mono";
  bold: boolean;
  italic: boolean;
};

/** How wide `text` is, in points, set in `font` at `sizePt`. Must measure the
 *  string exactly as the writer will draw it. */
export type TextMeasurer = (
  text: string,
  font: PdfFontStyle,
  sizePt: number,
) => number;

/** Everything drawn on a page, painted in order — so fills come before text. */
export type DrawOp =
  | {
      kind: "text";
      x: number;
      /** The baseline, not the top. */
      y: number;
      text: string;
      font: PdfFontStyle;
      sizePt: number;
      color: string;
      /** Draw a line through the text at mid-height. */
      strike?: boolean;
    }
  | {
      kind: "rect";
      x: number;
      y: number;
      width: number;
      height: number;
      fill: string;
    };

export type PdfPage = { ops: DrawOp[] };

export type PdfLayout = {
  pages: PdfPage[];
  widthPt: number;
  heightPt: number;
};

export type PdfLayoutInput = {
  /** The document, as Markdown. Plain text lays out as a run of paragraphs. */
  markdown: string;
  /** Set as a title above the first block. Omitted when blank. */
  title?: string;
  measure: TextMeasurer;
  /** Page box in points. Defaults to A4 portrait. */
  pageWidthPt?: number;
  pageHeightPt?: number;
  /** Margin on all four sides, in points. */
  marginPt?: number;
  /** Body size in points; every other size is derived from it. */
  baseSizePt?: number;
  /** The middle word of the `1 of 7` footer. No footer without it — the
   *  typesetter is pure and can't reach a translation catalogue itself. */
  pageNumberOf?: string;
};

// ── Page and type metrics ───────────────────────────────────────────────────

/** A4 in points, which is what a PDF measures in. */
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const DEFAULT_MARGIN = 56;
const DEFAULT_BASE_SIZE = 11;

const INK = "#111111";
const INK_MUTED = "#555555";
const RULE = "#bbbbbb";
const CODE_BACKGROUND = "#f1f1f1";
const FOOTER_INK = "#888888";

/** How much bigger than the body each heading level is set. */
const HEADING_SCALE: readonly number[] = [1.9, 1.55, 1.3, 1.15, 1.05, 1];

/** Where a line's baseline sits below its top edge, as a share of the size. */
const ASCENT = 0.76;

/** Leading, as a multiple of the size the line is set in. */
const LEADING = 1.42;
const HEADING_LEADING = 1.25;

/** Vertical gaps, as multiples of the body size. */
const BLOCK_GAP = 0.6;
const HEADING_GAP_ABOVE = 1;
const HEADING_GAP_BELOW = 0.35;
const RULE_GAP = 0.9;

/** Horizontal measures, as multiples of the body size. */
const LIST_INDENT = 1.6;
const MARKER_GAP = 0.35;
const QUOTE_INDENT = 0.9;
const QUOTE_BAR_WIDTH = 2;
const CODE_PAD_X = 0.45;
const CODE_PAD_Y = 0.25;

const FOOTER_SIZE_RATIO = 0.78;
const FOOTER_GAP = 18;

// ── Inline pieces ───────────────────────────────────────────────────────────

/** One stretch of text that shares a face, a size and a colour. */
type Piece = {
  font: PdfFontStyle;
  sizePt: number;
  color: string;
  strike: boolean;
  /** Painted behind the piece — how inline code gets its tint. */
  background?: string;
};

/** A piece and the text it carries, measured. */
type Fragment = { piece: Piece; text: string; width: number };

/** Flatten a parsed inline tree into pieces, carrying emphasis down. */
function flatten(nodes: readonly InlineNode[], base: Piece): Fragment[] {
  const out: Fragment[] = [];
  const walk = (list: readonly InlineNode[], piece: Piece): void => {
    for (const node of list) {
      switch (node.type) {
        case "text":
          out.push({ piece, text: node.text, width: 0 });
          break;
        case "code":
          out.push({
            piece: {
              ...piece,
              font: { family: "mono", bold: false, italic: false },
              background: CODE_BACKGROUND,
            },
            text: node.text,
            width: 0,
          });
          break;
        case "link":
          out.push({
            piece: { ...piece, color: INK_MUTED },
            text: node.text,
            width: 0,
          });
          break;
        case "image":
          // The typesetter draws no pictures: an image reference keeps its alt
          // text, which is the part a reader loses nothing by seeing.
          out.push({ piece, text: node.alt, width: 0 });
          break;
        case "strong":
          walk(node.children, {
            ...piece,
            font: { ...piece.font, bold: true },
          });
          break;
        case "em":
          walk(node.children, {
            ...piece,
            font: { ...piece.font, italic: true },
          });
          break;
        case "strikethrough":
          walk(node.children, { ...piece, strike: true });
          break;
      }
    }
  };
  walk(nodes, base);
  return out;
}

/** Split a fragment's text into wrappable tokens, keeping each space with the
 *  word before it so a line break never leaves one dangling at a margin. */
function tokenise(text: string): string[] {
  return text.match(/\S+\s*|\s+/g) ?? [];
}

/** Break fragments into lines that fit `width`, measuring as it goes. */
function wrap(
  fragments: readonly Fragment[],
  width: number,
  measure: TextMeasurer,
): Fragment[][] {
  const lines: Fragment[][] = [];
  let line: Fragment[] = [];
  let used = 0;

  const push = (piece: Piece, text: string, w: number): void => {
    const last = line[line.length - 1];
    if (last && last.piece === piece) {
      last.text += text;
      last.width += w;
    } else {
      line.push({ piece, text, width: w });
    }
    used += w;
  };

  for (const fragment of fragments) {
    for (const token of tokenise(fragment.text)) {
      const w = measure(token, fragment.piece.font, fragment.piece.sizePt);
      // A token that overflows starts a new line — unless the line is empty,
      // in which case nothing would be gained by moving it and it overhangs.
      if (
        used > 0 &&
        used +
          measure(token.trimEnd(), fragment.piece.font, fragment.piece.sizePt) >
          width
      ) {
        lines.push(line);
        line = [];
        used = 0;
        if (/^\s+$/.test(token)) continue;
      }
      push(fragment.piece, token, w);
    }
  }
  if (line.length > 0) lines.push(line);
  return lines.length > 0 ? lines : [[]];
}

// ── The page cursor ─────────────────────────────────────────────────────────

type Cursor = {
  pages: PdfPage[];
  ops: DrawOp[];
  y: number;
};

function newPage(cursor: Cursor, top: number): void {
  cursor.pages.push({ ops: cursor.ops });
  cursor.ops = [];
  cursor.y = top;
}

// ── The typesetter ──────────────────────────────────────────────────────────

export function layoutPdf(input: PdfLayoutInput): PdfLayout {
  const widthPt = input.pageWidthPt ?? A4_WIDTH;
  const heightPt = input.pageHeightPt ?? A4_HEIGHT;
  const margin = input.marginPt ?? DEFAULT_MARGIN;
  const base = input.baseSizePt ?? DEFAULT_BASE_SIZE;
  const measure = input.measure;
  const footer = (input.pageNumberOf ?? "").trim();
  const top = margin;
  const bottom = heightPt - margin - (footer ? FOOTER_GAP : 0);
  const columnWidth = widthPt - margin * 2;

  const cursor: Cursor = { pages: [], ops: [], y: top };

  const bodyPiece = (sizePt: number, over: Partial<Piece> = {}): Piece => ({
    font: { family: "body", bold: false, italic: false },
    sizePt,
    color: INK,
    strike: false,
    ...over,
  });

  /** Draw one wrapped line at `x`, advancing the cursor by `leading`. */
  const drawLine = (
    line: readonly Fragment[],
    x: number,
    sizePt: number,
    leading: number,
  ): void => {
    if (cursor.y + sizePt > bottom) newPage(cursor, top);
    const baseline = cursor.y + sizePt * ASCENT;
    let cx = x;
    for (const fragment of line) {
      const text = fragment.text.replace(/\s+$/, "");
      if (text !== "") {
        if (fragment.piece.background) {
          cursor.ops.push({
            kind: "rect",
            x: cx - fragment.piece.sizePt * CODE_PAD_X,
            y: cursor.y - fragment.piece.sizePt * CODE_PAD_Y,
            width:
              measure(text, fragment.piece.font, fragment.piece.sizePt) +
              fragment.piece.sizePt * CODE_PAD_X * 2,
            height: fragment.piece.sizePt * (1 + CODE_PAD_Y * 2),
            fill: fragment.piece.background,
          });
        }
        cursor.ops.push({
          kind: "text",
          x: cx,
          y: baseline,
          text,
          font: fragment.piece.font,
          sizePt: fragment.piece.sizePt,
          color: fragment.piece.color,
          strike: fragment.piece.strike || undefined,
        });
      }
      cx += fragment.width;
    }
    cursor.y += sizePt * leading;
  };

  /** Lay one run of inline content out in a column, indented by `indent`. */
  const drawFlow = (
    content: string,
    contentStart: number,
    piece: Piece,
    indent: number,
    leading: number,
    marker?: { text: string; piece: Piece },
  ): void => {
    const fragments = flatten(parseInline(content, contentStart), piece);
    const lines = wrap(fragments, columnWidth - indent, measure);
    lines.forEach((line, index) => {
      if (cursor.y + piece.sizePt > bottom) newPage(cursor, top);
      if (index === 0 && marker) {
        const markerWidth = measure(
          marker.text,
          marker.piece.font,
          marker.piece.sizePt,
        );
        cursor.ops.push({
          kind: "text",
          x: margin + indent - markerWidth - base * MARKER_GAP,
          y: cursor.y + piece.sizePt * ASCENT,
          text: marker.text,
          font: marker.piece.font,
          sizePt: marker.piece.sizePt,
          color: marker.piece.color,
        });
      }
      drawLine(line, margin + indent, piece.sizePt, leading);
    });
  };

  const gap = (multiple: number): void => {
    cursor.y += base * multiple;
  };

  if (input.title && input.title.trim() !== "") {
    drawFlow(
      input.title.trim(),
      0,
      bodyPiece(base * HEADING_SCALE[0]!, {
        font: { family: "body", bold: true, italic: false },
      }),
      0,
      HEADING_LEADING,
    );
    gap(HEADING_GAP_BELOW);
  }

  // A comment is an aside to whoever reads the source, never something to set
  // on paper — a page laid out with `<!-- … -->` printed across it is a page
  // showing its own syntax.
  const blocks = classifyLines(input.markdown).filter(
    (block) => !(block.kind === "paragraph" && isCommentLine(block.raw)),
  );
  blocks.forEach((block, index) => {
    drawBlock(block, blocks[index - 1]);
  });

  function drawBlock(block: LineBlock, previous: LineBlock | undefined): void {
    switch (block.kind) {
      case "blank":
        // A run of blank lines is one gap: the spacing between blocks is the
        // typesetter's to decide, not the source's.
        if (previous && previous.kind !== "blank") gap(BLOCK_GAP);
        return;

      case "hr":
        gap(RULE_GAP / 2);
        if (cursor.y + 1 > bottom) newPage(cursor, top);
        cursor.ops.push({
          kind: "rect",
          x: margin,
          y: cursor.y,
          width: columnWidth,
          height: 0.6,
          fill: RULE,
        });
        cursor.y += 0.6;
        gap(RULE_GAP / 2);
        return;

      case "heading": {
        const level = Math.min(block.level ?? 1, HEADING_SCALE.length);
        const sizePt = base * HEADING_SCALE[level - 1]!;
        if (previous && previous.kind !== "blank") gap(HEADING_GAP_ABOVE);
        else if (previous) gap(HEADING_GAP_ABOVE - BLOCK_GAP);
        drawFlow(
          block.content,
          block.contentStart,
          bodyPiece(sizePt, {
            font: { family: "body", bold: true, italic: false },
          }),
          0,
          HEADING_LEADING,
        );
        gap(HEADING_GAP_BELOW);
        return;
      }

      case "quote":
        drawQuote(block);
        return;

      case "fence":
      case "code":
        drawCode(block);
        return;

      case "ul":
      case "ol":
        drawListItem(block);
        return;

      case "paragraph":
        drawFlow(
          block.content,
          block.contentStart,
          bodyPiece(base),
          0,
          LEADING,
        );
        return;
    }
  }

  function drawQuote(block: LineBlock): void {
    const indent = base * QUOTE_INDENT;
    const startY = cursor.y;
    const startPage = cursor.pages.length;
    drawFlow(
      block.content,
      block.contentStart,
      bodyPiece(base, {
        color: INK_MUTED,
        font: { family: "body", bold: false, italic: true },
      }),
      indent,
      LEADING,
    );
    // The bar is drawn after the text so its height is known — and only when
    // the quote stayed on one page, since a bar across a break would be drawn
    // on the wrong one.
    if (cursor.pages.length === startPage) {
      cursor.ops.push({
        kind: "rect",
        x: margin,
        y: startY,
        width: QUOTE_BAR_WIDTH,
        height: cursor.y - startY,
        fill: RULE,
      });
    }
  }

  function drawCode(block: LineBlock): void {
    const sizePt = base * 0.92;
    if (cursor.y + sizePt > bottom) newPage(cursor, top);
    cursor.ops.push({
      kind: "rect",
      x: margin,
      y: cursor.y - sizePt * CODE_PAD_Y,
      width: columnWidth,
      height: sizePt * LEADING,
      fill: CODE_BACKGROUND,
    });
    cursor.ops.push({
      kind: "text",
      x: margin + base * CODE_PAD_X,
      y: cursor.y + sizePt * ASCENT,
      text: block.raw,
      font: { family: "mono", bold: false, italic: false },
      sizePt,
      color: INK,
    });
    cursor.y += sizePt * LEADING;
  }

  function drawListItem(block: LineBlock): void {
    const depth = block.depth ?? 0;
    const indent = base * LIST_INDENT * (depth + 1);
    const marker =
      block.kind === "ol"
        ? `${block.seq ?? 1}${/[.)]$/.exec(block.ordinal ?? "")?.[0] ?? "."}`
        : "•";
    drawFlow(
      block.content,
      block.contentStart,
      bodyPiece(base),
      indent,
      LEADING,
      { text: marker, piece: bodyPiece(base, { color: INK_MUTED }) },
    );
  }

  cursor.pages.push({ ops: cursor.ops });

  if (footer) {
    const sizePt = base * FOOTER_SIZE_RATIO;
    cursor.pages.forEach((page, index) => {
      const text = `${index + 1} ${footer} ${cursor.pages.length}`;
      page.ops.push({
        kind: "text",
        x:
          widthPt / 2 -
          measure(
            text,
            { family: "body", bold: false, italic: false },
            sizePt,
          ) /
            2,
        y: heightPt - margin + FOOTER_GAP / 2,
        text,
        font: { family: "body", bold: false, italic: false },
        sizePt,
        color: FOOTER_INK,
      });
    });
  }

  return { pages: cursor.pages, widthPt, heightPt };
}
