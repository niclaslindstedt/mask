// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A small XML reader: a string in, a tree out.
//
// The browser ships `DOMParser`, which does this properly — but only in a
// browser, and the callers here run under a test runner with no DOM as often
// as they run in one. This is the subset a document format needs: elements,
// attributes, text, comments, CDATA, character references. Namespaces are left
// as written (`w:p` is a name, not a namespace lookup), because a format that
// fixes its prefixes — and Office Open XML does — is read more simply by the
// name on the tag than by resolving a URI nobody varies.
//
// What it deliberately does not do: entity declarations (only the five XML
// built-ins plus numeric references), DTD validation, or namespace rewriting.
// Anything it can't make sense of throws rather than guessing.

export type XmlElement = {
  kind: "element";
  /** The tag as written, prefix included: `w:p`. */
  name: string;
  attrs: Record<string, string>;
  children: XmlChild[];
};

/** A stretch of character data, its references already resolved. */
export type XmlText = { kind: "text"; text: string };

export type XmlChild = XmlElement | XmlText;

/** Malformed XML — an unclosed tag, a stray `<`, no root element. */
export class XmlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "XmlError";
  }
}

const NAME_END = /[\s/>]/;

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

/** `&amp;` / `&#229;` / `&#xE5;` → the character each stands for. Anything
 *  that isn't a reference this knows is left exactly as it was written. */
export function decodeXmlEntities(text: string): string {
  if (!text.includes("&")) return text;
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (whole, body) => {
    const ref = body as string;
    if (ref.startsWith("#x") || ref.startsWith("#X")) {
      return codePoint(parseInt(ref.slice(2), 16), whole);
    }
    if (ref.startsWith("#"))
      return codePoint(parseInt(ref.slice(1), 10), whole);
    return ENTITIES[ref.toLowerCase()] ?? whole;
  });
}

function codePoint(value: number, whole: string): string {
  return Number.isFinite(value) && value >= 0 && value <= 0x10ffff
    ? String.fromCodePoint(value)
    : whole;
}

/** Parse `source` and return its root element. */
export function parseXml(source: string): XmlElement {
  let root: XmlElement | null = null;
  const stack: XmlElement[] = [];
  let at = 0;

  const push = (child: XmlChild): void => {
    const parent = stack[stack.length - 1];
    if (parent) parent.children.push(child);
  };

  while (at < source.length) {
    const open = source.indexOf("<", at);
    if (open < 0) break;
    if (open > at) {
      push({ kind: "text", text: decodeXmlEntities(source.slice(at, open)) });
    }

    if (source.startsWith("<!--", open)) {
      at = skipTo(source, open, "-->", "comment");
      continue;
    }
    if (source.startsWith("<![CDATA[", open)) {
      const end = source.indexOf("]]>", open);
      if (end < 0) throw new XmlError("Unterminated CDATA section");
      push({ kind: "text", text: source.slice(open + 9, end) });
      at = end + 3;
      continue;
    }
    if (source.startsWith("<?", open)) {
      at = skipTo(source, open, "?>", "processing instruction");
      continue;
    }
    if (source.startsWith("<!", open)) {
      at = skipTo(source, open, ">", "declaration");
      continue;
    }
    if (source.startsWith("</", open)) {
      const end = source.indexOf(">", open);
      if (end < 0) throw new XmlError("Unterminated closing tag");
      const name = source.slice(open + 2, end).trim();
      const openTag = stack.pop();
      if (!openTag || openTag.name !== name) {
        throw new XmlError(
          `Closing </${name}> does not match <${openTag?.name ?? "nothing"}>`,
        );
      }
      at = end + 1;
      continue;
    }

    const tag = readTag(source, open);
    const element: XmlElement = {
      kind: "element",
      name: tag.name,
      attrs: tag.attrs,
      children: [],
    };
    push(element);
    root ??= element;
    if (!tag.selfClosing) stack.push(element);
    at = tag.end;
  }

  if (stack.length > 0) {
    throw new XmlError(`Unclosed <${stack[stack.length - 1]!.name}>`);
  }
  if (!root) throw new XmlError("No root element");
  return root;
}

function skipTo(
  source: string,
  from: number,
  terminator: string,
  what: string,
): number {
  const end = source.indexOf(terminator, from);
  if (end < 0) throw new XmlError(`Unterminated ${what}`);
  return end + terminator.length;
}

/** One opening tag, from its `<` to just past its `>`. */
function readTag(
  source: string,
  open: number,
): {
  name: string;
  attrs: Record<string, string>;
  end: number;
  selfClosing: boolean;
} {
  let at = open + 1;
  const nameEnd = findNameEnd(source, at);
  const name = source.slice(at, nameEnd);
  if (name === "") throw new XmlError("Empty tag name");
  at = nameEnd;

  const attrs: Record<string, string> = {};
  while (at < source.length) {
    while (at < source.length && /\s/.test(source[at]!)) at++;
    if (source.startsWith("/>", at)) {
      return { name, attrs, end: at + 2, selfClosing: true };
    }
    if (source[at] === ">")
      return { name, attrs, end: at + 1, selfClosing: false };

    const attrEnd = findNameEnd(source, at, true);
    const attrName = source.slice(at, attrEnd);
    if (attrName === "") throw new XmlError(`Malformed attribute in <${name}>`);
    at = attrEnd;
    while (at < source.length && /\s/.test(source[at]!)) at++;
    if (source[at] !== "=") {
      // A bare attribute isn't XML, but it costs nothing to keep reading.
      attrs[attrName] = "";
      continue;
    }
    at++;
    while (at < source.length && /\s/.test(source[at]!)) at++;
    const quote = source[at];
    if (quote !== '"' && quote !== "'") {
      throw new XmlError(`Unquoted value for ${attrName} in <${name}>`);
    }
    const valueEnd = source.indexOf(quote, at + 1);
    if (valueEnd < 0) throw new XmlError(`Unterminated value for ${attrName}`);
    attrs[attrName] = decodeXmlEntities(source.slice(at + 1, valueEnd));
    at = valueEnd + 1;
  }
  throw new XmlError(`Unterminated <${name}>`);
}

function findNameEnd(source: string, from: number, attribute = false): number {
  let at = from;
  while (at < source.length) {
    const char = source[at]!;
    if (NAME_END.test(char) || (attribute && char === "=")) break;
    at++;
  }
  return at;
}

// ── Walking the tree ────────────────────────────────────────────────────────

/** `element`'s element children, optionally only those named `name`. */
export function childElements(
  element: XmlElement,
  name?: string,
): XmlElement[] {
  return element.children.filter(
    (child): child is XmlElement =>
      child.kind === "element" && (name === undefined || child.name === name),
  );
}

/** The first child element named `name`, or null. */
export function childElement(
  element: XmlElement,
  name: string,
): XmlElement | null {
  return childElements(element, name)[0] ?? null;
}

/** The first descendant named `name`, depth first, `element` included. */
export function findElement(
  element: XmlElement,
  name: string,
): XmlElement | null {
  if (element.name === name) return element;
  for (const child of childElements(element)) {
    const hit = findElement(child, name);
    if (hit) return hit;
  }
  return null;
}

/** Every descendant named `name`, depth first. */
export function findElements(element: XmlElement, name: string): XmlElement[] {
  const out: XmlElement[] = [];
  const walk = (node: XmlElement): void => {
    if (node.name === name) out.push(node);
    for (const child of childElements(node)) walk(child);
  };
  walk(element);
  return out;
}

/** All the text under `element`, its markup stripped. */
export function textContent(element: XmlElement): string {
  let out = "";
  for (const child of element.children) {
    out += child.kind === "text" ? child.text : textContent(child);
  }
  return out;
}
