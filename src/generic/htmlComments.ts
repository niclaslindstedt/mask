// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Markdown's only comment is HTML's.
//
// Markdown has no comment syntax of its own, so `<!-- … -->` is what every
// renderer — and every language model — already reads as "this was on the page,
// but it is not the text": the page-number bar, the running header, the address
// block at the foot. Written that way the furniture is still there for anyone
// who wants it and out of the way of everyone who doesn't.
//
// The one rule HTML imposes is that a comment's body may not carry `--`, which
// would close it early, so a hyphen run is spaced out on the way in.

/** A comment line and the body inside it — the body may not itself close the
 *  comment, so a line that merely starts and ends with one is not a comment. */
const COMMENT_LINE = /^\s*<!--((?:(?!-->)[\s\S])*)-->\s*$/;

/** `text` wrapped as an HTML comment, on one line. */
export function htmlComment(text: string): string {
  const body = text
    .replace(/\s+/g, " ")
    .trim()
    // `--` would end the comment where it stands; spacing the run out keeps
    // every hyphen the line was written with.
    .replace(/-{2,}/g, (run) => [...run].join(" "));
  return body === "" ? "<!-- -->" : `<!-- ${body} -->`;
}

/** Whether a line is nothing but an HTML comment. */
export function isCommentLine(line: string): boolean {
  return COMMENT_LINE.test(line);
}

/** What a comment line says, its markers taken off — for showing it as the
 *  aside it is rather than as its syntax. Any other line stands as it is. */
export function commentText(line: string): string {
  return COMMENT_LINE.exec(line)?.[1]?.trim() ?? line;
}
