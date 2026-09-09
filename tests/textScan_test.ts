import { describe, expect, it } from "vitest";

import {
  applyReplacements,
  findLiterals,
  onWordBoundary,
  replaceLiterals,
  resolveOverlaps,
  scanRules,
  type TextSpan,
} from "../src/generic/textScan.ts";

const span = (
  start: number,
  end: number,
  extra: Partial<TextSpan> = {},
): TextSpan => ({
  start,
  end,
  value: "x".repeat(end - start),
  kind: "k",
  source: "s",
  ...extra,
});

describe("scanRules", () => {
  it("collects every hit of every rule and honours the accept veto", () => {
    const text = "call 070-123 45 67 or 08-123 456";
    const spans = scanRules(text, [
      {
        id: "digits",
        kind: "num",
        pattern: /\d[\d -]+\d/,
        accept: (v) => v.replace(/\D/g, "").length >= 10,
      },
    ]);
    expect(spans.map((s) => s.value)).toEqual(["070-123 45 67"]);
    expect(spans[0]).toMatchObject({ start: 5, end: 18, kind: "num" });
  });

  it("does not loop on zero-length matches", () => {
    expect(scanRules("abc", [{ id: "e", kind: "k", pattern: /x*/ }])).toEqual(
      [],
    );
  });
});

describe("findLiterals", () => {
  it("matches on Unicode word boundaries only", () => {
    const text = "Åsa, Åsalund och åsa.";
    const hits = findLiterals(text, [{ value: "Åsa", kind: "k", source: "s" }]);
    expect(hits.map((h) => h.start)).toEqual([0]);
    const loose = findLiterals(
      text,
      [{ value: "Åsa", kind: "k", source: "s" }],
      { caseSensitive: false },
    );
    expect(loose.map((h) => h.value)).toEqual(["Åsa", "åsa"]);
  });

  it("treats a non-word edge as bounded ($1 next to letters)", () => {
    expect(onWordBoundary("x$1 y", 1, 3)).toBe(true);
    expect(onWordBoundary("x$1y", 1, 3)).toBe(false);
    expect(onWordBoundary("xAAAy", 1, 4)).toBe(false);
    const hits = findLiterals("ring $1 nu", [
      { value: "$1", kind: "k", source: "s" },
    ]);
    expect(hits).toHaveLength(1);
  });

  it("ignores empty literals", () => {
    expect(
      findLiterals("abc", [{ value: "", kind: "k", source: "s" }]),
    ).toEqual([]);
  });
});

describe("resolveOverlaps", () => {
  it("keeps the longest span, then priority, then the earliest", () => {
    const kept = resolveOverlaps([
      span(0, 4),
      span(2, 10, { kind: "long" }),
      span(12, 15, { priority: 1, kind: "hi" }),
      span(12, 15, { priority: 0, kind: "lo" }),
      span(20, 22),
    ]);
    expect(kept.map((s) => [s.start, s.end, s.kind])).toEqual([
      [2, 10, "long"],
      [12, 15, "hi"],
      [20, 22, "k"],
    ]);
  });
});

describe("applyReplacements / replaceLiterals", () => {
  it("rewrites spans in any order and skips an overlapping one", () => {
    expect(
      applyReplacements("0123456789", [
        { start: 6, end: 8, replacement: "B" },
        { start: 0, end: 2, replacement: "A" },
        { start: 1, end: 3, replacement: "!" },
      ]),
    ).toBe("A2345B89");
  });

  it("prefers the longer literal and round-trips", () => {
    const masked = replaceLiterals("Anna Svensson och Anna", [
      { from: "Anna", to: "AAB" },
      { from: "Anna Svensson", to: "AAA" },
    ]);
    expect(masked).toBe("AAA och AAB");
    const back = replaceLiterals(masked, [
      { from: "AAA", to: "Anna Svensson" },
      { from: "AAB", to: "Anna" },
    ]);
    expect(back).toBe("Anna Svensson och Anna");
  });
});

describe("suffixes", () => {
  it("lets a whole-word literal run into an allowed ending", () => {
    const lits = [{ value: "Anna", kind: "k", source: "s" }];
    expect(findLiterals("Annas bil, Annalisa", lits)).toEqual([]);
    const hits = findLiterals("Annas bil, Annalisa", lits, { suffixes: ["s"] });
    expect(hits.map((h) => [h.start, h.end])).toEqual([[0, 4]]);
    expect(
      replaceLiterals("Annas bil", [{ from: "Anna", to: "AAA" }], {
        suffixes: ["s"],
      }),
    ).toBe("AAAs bil");
  });
});
