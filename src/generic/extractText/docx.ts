// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The Word half of `extractText`, in its own chunk: a `.docx` is a ZIP of XML,
// and the reader for both (`../zip.ts`, `../xml.ts`) only ever loads for
// someone who actually drops one.
//
// Where a PDF has to be *reconstructed* — positions on a page, reflowed back
// into paragraphs, with headings guessed from type size — a Word file still
// knows what it is. The paragraph says it is Heading 2; the run says it is
// bold; the item says which list it belongs to and how deep. So this pass is
// not archaeology, it is translation, and it keeps the structure rather than
// inferring it:
//
//   * **Headings** from the paragraph's style. Word's style *ids* are
//     localised (`Rubrik1` in a Swedish template), but every built-in style
//     carries its canonical English name in `styles.xml`, so the level is read
//     from there and the id is only a fallback.
//   * **Emphasis** from the run: direct bold / italic, and the character
//     styles (`Strong`, `Emphasis`) that mean the same thing.
//   * **Lists** from the numbering part: `numbering.xml` says whether a list
//     is bulleted or numbered, and the item says how deep it sits.
//   * **Tables** as Markdown tables — structure a language model reads, where
//     a flattened run of cells reads as nonsense.
//   * **Headers and footers** as HTML comments, exactly as the PDF pass writes
//     a running header: still there to be masked, out of the prose.
//
// Tracked changes are taken as accepted: an insertion is text, a deletion is
// not. Field codes (`w:instrText`) are instructions to Word rather than
// anything the document says, so they are dropped.

import { htmlComment } from "../htmlComments.ts";
import {
  childElement,
  childElements,
  findElement,
  findElements,
  parseXml,
  textContent,
  type XmlElement,
} from "../xml.ts";
import {
  readZipDirectory,
  readZipText,
  ZipError,
  type ZipEntry,
} from "../zip.ts";
import type { ExtractedText } from "./index.ts";
import type { StyledSegment } from "./layout.ts";
import { allBold, segmentsMarkdown } from "./markup.ts";

/** The parts of the package this reads. Everything else — the theme, the
 *  fonts, the images — says nothing about what the document says. */
const DOCUMENT_PART = "word/document.xml";
const STYLES_PART = "word/styles.xml";
const NUMBERING_PART = "word/numbering.xml";

/** `word/header1.xml` and its footer twin, in whatever numbering a document's
 *  sections gave them. */
const FURNITURE_PART = /^word\/(header|footer)\d*\.xml$/;

/** A file that is a ZIP but not a Word document, or one whose main part this
 *  can't make sense of. */
export class DocxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocxError";
  }
}

/** `Heading 2`, `heading2`, `Heading_2` — the canonical name of a built-in
 *  heading style, and the shape its style id usually takes too. */
const HEADING_STYLE = /^heading[\s_-]*([1-9])$/i;

/** Values a Word on/off property takes to mean "off". A property with no
 *  `w:val` at all is on — `<w:b/>` is bold. */
const OFF_VALUES = new Set(["0", "false", "off"]);

/** Elements never descended into when collecting a paragraph's text: property
 *  bags, the text Word deleted, and instructions to Word rather than prose. */
const NOT_TEXT = new Set([
  "w:pPr",
  "w:rPr",
  "w:tblPr",
  "w:trPr",
  "w:tcPr",
  "w:tblGrid",
  "w:sectPr",
  "w:sdtPr",
  "w:sdtEndPr",
  "w:del",
  "w:instrText",
  "w:proofErr",
]);

// ── The style and numbering tables ──────────────────────────────────────────

type Emphasis = { bold: boolean; italic: boolean };

/** Which list a paragraph belongs to, and how deep it sits in it. */
type ListPlace = { numId: string; depth: number };

type StyleTable = {
  /** Paragraph style id → heading level. */
  heading: Map<string, number>;
  /** Character style id → the face it sets. */
  emphasis: Map<string, Emphasis>;
  /** Paragraph style id → the list the style itself puts it in. Word's own
   *  `List Bullet` and `List Number` number their paragraphs this way, and a
   *  paragraph using one carries no numbering of its own at all. */
  list: Map<string, ListPlace>;
};

/** Whether an on/off property is on, falling back to what the run inherits
 *  when the property isn't set at all. Direct formatting wins over a style. */
function toggle(
  props: XmlElement | null,
  name: string,
  inherited: boolean,
): boolean {
  const property = props ? childElement(props, name) : null;
  if (!property) return inherited;
  const value = property.attrs["w:val"];
  return value === undefined || !OFF_VALUES.has(value);
}

export function parseStyles(xml: string | null): StyleTable {
  const heading = new Map<string, number>();
  const emphasis = new Map<string, Emphasis>();
  const list = new Map<string, ListPlace>();
  if (!xml) return { heading, emphasis, list };

  for (const style of findElements(parseXml(xml), "w:style")) {
    const id = style.attrs["w:styleId"];
    if (!id) continue;
    const name = childElement(style, "w:name")?.attrs["w:val"] ?? "";
    if (style.attrs["w:type"] === "character") {
      const props = childElement(style, "w:rPr");
      emphasis.set(id, {
        bold: toggle(props, "w:b", false),
        italic: toggle(props, "w:i", false),
      });
      continue;
    }
    const place = listPlace(childElement(style, "w:pPr"));
    if (place) list.set(id, place);

    const level = HEADING_STYLE.exec(name) ?? HEADING_STYLE.exec(id);
    if (level) {
      heading.set(id, Number(level[1]));
    } else if (/^title$/i.test(name)) {
      heading.set(id, 1);
    } else if (/^subtitle$/i.test(name)) {
      heading.set(id, 2);
    }
  }
  return { heading, emphasis, list };
}

/** The `w:numPr` in a paragraph's properties — or in a paragraph *style's* —
 *  as the list it names. */
function listPlace(props: XmlElement | null): ListPlace | null {
  const numPr = props ? childElement(props, "w:numPr") : null;
  if (!numPr) return null;
  const numId = childElement(numPr, "w:numId")?.attrs["w:val"];
  return numId === undefined
    ? null
    : {
        numId,
        depth: Number(childElement(numPr, "w:ilvl")?.attrs["w:val"] ?? "0"),
      };
}

/** Which list format each `w:numId` uses at each depth — all this pass wants
 *  from `numbering.xml` is bulleted or numbered. */
export type Numbering = Map<string, Map<number, string>>;

export function parseNumbering(xml: string | null): Numbering {
  const numbering: Numbering = new Map();
  if (!xml) return numbering;
  const root = parseXml(xml);

  const abstract = new Map<string, Map<number, string>>();
  for (const definition of findElements(root, "w:abstractNum")) {
    const id = definition.attrs["w:abstractNumId"];
    if (!id) continue;
    const levels = new Map<number, string>();
    for (const level of childElements(definition, "w:lvl")) {
      const depth = Number(level.attrs["w:ilvl"] ?? "0");
      const format = childElement(level, "w:numFmt")?.attrs["w:val"];
      if (format) levels.set(depth, format);
    }
    abstract.set(id, levels);
  }

  for (const num of findElements(root, "w:num")) {
    const id = num.attrs["w:numId"];
    const target = childElement(num, "w:abstractNumId")?.attrs["w:val"];
    const levels = target === undefined ? undefined : abstract.get(target);
    if (id && levels) numbering.set(id, levels);
  }
  return numbering;
}

// ── Paragraphs and runs ─────────────────────────────────────────────────────

/** Adjacent stretches in the same face, run together — Word splits a sentence
 *  into runs at every spell-check and revision boundary, and marking each one
 *  up on its own would write `**a****b**`. */
function mergeSegments(segments: readonly StyledSegment[]): StyledSegment[] {
  const out: StyledSegment[] = [];
  for (const segment of segments) {
    const last = out[out.length - 1];
    if (last && last.bold === segment.bold && last.italic === segment.italic) {
      last.text += segment.text;
    } else {
      out.push({ ...segment });
    }
  }
  return out;
}

/** One run as the text it draws, in the face it draws it in. */
function runSegment(run: XmlElement, styles: StyleTable): StyledSegment | null {
  const props = childElement(run, "w:rPr");
  const styleId = props
    ? childElement(props, "w:rStyle")?.attrs["w:val"]
    : undefined;
  const inherited = (styleId && styles.emphasis.get(styleId)) || {
    bold: false,
    italic: false,
  };

  let text = "";
  for (const child of childElements(run)) {
    switch (child.name) {
      case "w:t":
        text += textContent(child);
        break;
      // A tab is layout, not language: the columns it lines up are gone the
      // moment the text leaves the page, and a space keeps the words apart.
      case "w:tab":
        text += " ";
        break;
      case "w:br":
      case "w:cr":
        text += "\n";
        break;
      case "w:noBreakHyphen":
        text += "-";
        break;
      default:
        break;
    }
  }
  return text === ""
    ? null
    : {
        text,
        bold: toggle(props, "w:b", inherited.bold),
        italic: toggle(props, "w:i", inherited.italic),
      };
}

/** Every run under `node`, however deeply a hyperlink, a revision or a content
 *  control has buried it. */
function collectSegments(
  node: XmlElement,
  styles: StyleTable,
): StyledSegment[] {
  const out: StyledSegment[] = [];
  const walk = (element: XmlElement): void => {
    for (const child of childElements(element)) {
      if (NOT_TEXT.has(child.name)) continue;
      if (child.name === "w:r") {
        const segment = runSegment(child, styles);
        if (segment) out.push(segment);
        continue;
      }
      walk(child);
    }
  };
  walk(node);
  return mergeSegments(out);
}

// ── Blocks ──────────────────────────────────────────────────────────────────

type Block =
  | {
      kind: "text";
      segments: StyledSegment[];
      /** 1–9 for a heading, 0 for body text. */
      heading: number;
      /** The Markdown list marker, or "" when the paragraph isn't an item. */
      marker: string;
      /** List nesting, 0 at the margin. */
      depth: number;
    }
  | { kind: "table"; rows: StyledSegment[][][] }
  | { kind: "comment"; text: string };

type Context = { styles: StyleTable; numbering: Numbering };

function plainText(segments: readonly StyledSegment[]): string {
  return segments.map((segment) => segment.text).join("");
}

/** The list marker a paragraph asks for, and how deep it sits — from the
 *  paragraph itself, or from the style it uses when it says nothing. */
function listOf(
  props: XmlElement | null,
  styleId: string | undefined,
  { styles, numbering }: Context,
): { marker: string; depth: number } | null {
  const place =
    listPlace(props) ?? (styleId ? styles.list.get(styleId) : undefined);
  // `w:numId="0"` is how a paragraph opts *out* of the numbering its style
  // would otherwise give it.
  if (!place || place.numId === "0") return null;
  const { numId, depth } = place;
  const format = numbering.get(numId)?.get(depth) ?? "bullet";
  // Every ordered item is written `1.`: Markdown renumbers a list from its
  // first item, so the source ordinal is noise.
  return { marker: format === "bullet" ? "- " : "1. ", depth };
}

function paragraphBlock(paragraph: XmlElement, context: Context): Block | null {
  const { styles } = context;
  const segments = collectSegments(paragraph, styles);
  if (plainText(segments).trim() === "") return null;

  const props = childElement(paragraph, "w:pPr");
  const styleId = props
    ? childElement(props, "w:pStyle")?.attrs["w:val"]
    : undefined;
  const list = listOf(props, styleId, context);
  const outline = props
    ? childElement(props, "w:outlineLvl")?.attrs["w:val"]
    : undefined;
  // A list item is never a heading, whatever style it carries.
  const heading = list
    ? 0
    : ((styleId ? styles.heading.get(styleId) : undefined) ??
      (outline === undefined ? 0 : Math.min(Number(outline) + 1, 6)));

  return {
    kind: "text",
    segments,
    heading,
    marker: list?.marker ?? "",
    depth: list?.depth ?? 0,
  };
}

function tableBlock(table: XmlElement, context: Context): Block | null {
  const rows = findElements(table, "w:tr").map((row) =>
    findElements(row, "w:tc").map((cell) =>
      collectSegments(cell, context.styles),
    ),
  );
  return rows.length === 0 ? null : { kind: "table", rows };
}

/** The body's blocks, in the order the document lays them out. */
export function bodyBlocks(body: XmlElement, context: Context): Block[] {
  const blocks: Block[] = [];
  const walk = (element: XmlElement): void => {
    for (const child of childElements(element)) {
      if (child.name === "w:p") {
        const block = paragraphBlock(child, context);
        if (block) blocks.push(block);
      } else if (child.name === "w:tbl") {
        const block = tableBlock(child, context);
        if (block) blocks.push(block);
      } else if (child.name === "w:sdt") {
        // A content control wraps real body content; its own property bag is
        // already on the never-descend list.
        const content = childElement(child, "w:sdtContent");
        if (content) walk(content);
      }
    }
  };
  walk(body);
  return blocks;
}

// ── Writing it out ──────────────────────────────────────────────────────────

/** A cell's text, on one line and with its pipes escaped so the row it sits in
 *  keeps its shape. */
function cellMarkdown(cell: StyledSegment[], emphatic: boolean): string {
  return segmentsMarkdown(cell, emphatic)
    .replace(/\s*\n\s*/g, " ")
    .replace(/\|/g, "\\|")
    .trim();
}

function tableMarkdown(rows: StyledSegment[][][], emphatic: boolean): string {
  const width = Math.max(...rows.map((row) => row.length));
  const line = (cells: string[]): string =>
    `| ${[...cells, ...Array<string>(width - cells.length).fill("")].join(" | ")} |`;
  const [head = [], ...body] = rows.map((row) =>
    row.map((cell) => cellMarkdown(cell, emphatic)),
  );
  return [
    line(head),
    line(Array<string>(width).fill("---")),
    ...body.map(line),
  ].join("\n");
}

function blockMarkdown(block: Block, emphatic: boolean): string {
  if (block.kind === "comment") return htmlComment(block.text);
  if (block.kind === "table") return tableMarkdown(block.rows, emphatic);

  if (block.heading > 0) {
    // A heading is emphatic by being a heading, so it is written plain.
    const text = plainText(block.segments)
      .replace(/\s*\n\s*/g, " ")
      .trim();
    return `${"#".repeat(block.heading)} ${text}`;
  }
  const body = segmentsMarkdown(block.segments, emphatic).trim();
  if (block.marker === "") return body;
  // An item's own line breaks would end the item, so they close up.
  return `${"  ".repeat(block.depth)}${block.marker}${body.replace(/\s*\n\s*/g, " ")}`;
}

/** Every segment carrying prose, for the document-wide emphasis verdict. */
function inkedSegments(block: Block): StyledSegment[] {
  if (block.kind === "text") return block.segments;
  if (block.kind === "table") return block.rows.flat(2);
  return [];
}

// ── The package ─────────────────────────────────────────────────────────────

/** The running headers or footers of every section, as comment blocks. One
 *  header repeated across sections is written once. */
async function furnitureBlocks(
  bytes: Uint8Array,
  entries: readonly ZipEntry[],
  context: Context,
  kind: "header" | "footer",
): Promise<Block[]> {
  const parts = entries
    .map((entry) => entry.name)
    .filter((name) => FURNITURE_PART.exec(name)?.[1] === kind)
    .sort();

  const seen = new Set<string>();
  const blocks: Block[] = [];
  for (const part of parts) {
    const xml = await readZipText(bytes, entries, part);
    if (!xml) continue;
    for (const paragraph of findElements(parseXml(xml), "w:p")) {
      const text = plainText(collectSegments(paragraph, context.styles))
        .replace(/\s+/g, " ")
        .trim();
      if (text === "" || seen.has(text)) continue;
      seen.add(text);
      blocks.push({ kind: "comment", text });
    }
  }
  return blocks;
}

export async function extractDocxText(
  data: ArrayBuffer,
): Promise<ExtractedText> {
  const bytes = new Uint8Array(data);
  let entries: ZipEntry[];
  try {
    entries = readZipDirectory(bytes);
  } catch (err) {
    throw err instanceof ZipError
      ? new DocxError(`${err.message} — a Word file is one inside`)
      : err;
  }

  const documentXml = await readZipText(bytes, entries, DOCUMENT_PART);
  if (documentXml === null) {
    throw new DocxError(`The archive holds no ${DOCUMENT_PART}`);
  }
  const body = findElement(parseXml(documentXml), "w:body");
  if (!body) throw new DocxError(`${DOCUMENT_PART} has no document body`);

  const context: Context = {
    styles: parseStyles(await readZipText(bytes, entries, STYLES_PART)),
    numbering: parseNumbering(
      await readZipText(bytes, entries, NUMBERING_PART),
    ),
  };

  const blocks = [
    ...(await furnitureBlocks(bytes, entries, context, "header")),
    ...bodyBlocks(body, context),
    ...(await furnitureBlocks(bytes, entries, context, "footer")),
  ];
  const emphatic = !allBold(blocks.flatMap(inkedSegments));

  return {
    text: blocks
      .map((block) => blockMarkdown(block, emphatic))
      .join("\n\n")
      .trim(),
    kind: "docx",
    markdown: true,
  };
}
