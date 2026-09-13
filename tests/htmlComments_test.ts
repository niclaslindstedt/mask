import { describe, expect, it } from "vitest";

import {
  commentText,
  htmlComment,
  isCommentLine,
} from "../src/generic/htmlComments.ts";

describe("writing a comment", () => {
  it("wraps a line in the markers", () => {
    expect(htmlComment("Sida 2 av 13")).toBe("<!-- Sida 2 av 13 -->");
  });

  it("puts a multi-line note on one line", () => {
    expect(htmlComment("  Dok.Id 233512\n HÖGSTA  DOMSTOLEN ")).toBe(
      "<!-- Dok.Id 233512 HÖGSTA DOMSTOLEN -->",
    );
  });

  it("spaces out a hyphen run that would close the comment early", () => {
    // Every hyphen survives; none of them ends the comment.
    expect(htmlComment("T 4623-21 — sida 2 -- av 13---")).toBe(
      "<!-- T 4623-21 — sida 2 - - av 13- - - -->",
    );
    expect(isCommentLine(htmlComment("a -- b"))).toBe(true);
  });

  it("writes an empty note as an empty comment", () => {
    expect(htmlComment("   ")).toBe("<!-- -->");
  });
});

describe("reading a comment line", () => {
  it("knows a line that is nothing but a comment", () => {
    expect(isCommentLine("<!-- Sida 2 -->")).toBe(true);
    expect(isCommentLine("   <!-- Sida 2 -->  ")).toBe(true);
    expect(isCommentLine("<!-- Sida 2 --> och sedan text")).toBe(false);
    expect(isCommentLine("Text <!-- Sida 2 -->")).toBe(false);
    expect(isCommentLine("<!-- a --> mitten <!-- b -->")).toBe(false);
    expect(isCommentLine("Sida 2")).toBe(false);
  });

  it("hands back what the comment says", () => {
    expect(commentText("  <!--  Sida 2 av 13  -->")).toBe("Sida 2 av 13");
  });

  it("leaves a line that is not a comment as it stands", () => {
    expect(commentText("Sida 2 av 13")).toBe("Sida 2 av 13");
  });
});
