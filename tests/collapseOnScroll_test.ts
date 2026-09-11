import { describe, expect, it } from "vitest";

import {
  DEFAULT_COLLAPSE_AT,
  DEFAULT_EXPAND_AT,
  nextCollapsed,
} from "../src/generic/collapseOnScroll.ts";

describe("nextCollapsed", () => {
  it("collapses once the scroll passes the collapse threshold", () => {
    expect(nextCollapsed(false, DEFAULT_COLLAPSE_AT)).toBe(true);
    expect(nextCollapsed(false, DEFAULT_COLLAPSE_AT + 200)).toBe(true);
  });

  it("expands again at the top", () => {
    expect(nextCollapsed(true, 0)).toBe(false);
    expect(nextCollapsed(true, DEFAULT_EXPAND_AT)).toBe(false);
  });

  it("keeps the state it has between the two thresholds", () => {
    const between = (DEFAULT_EXPAND_AT + DEFAULT_COLLAPSE_AT) / 2;
    expect(nextCollapsed(false, between)).toBe(false);
    expect(nextCollapsed(true, between)).toBe(true);
  });

  it("takes thresholds of its own", () => {
    const opts = { collapseAt: 10, expandAt: 2 };
    expect(nextCollapsed(false, 9, opts)).toBe(false);
    expect(nextCollapsed(false, 10, opts)).toBe(true);
    expect(nextCollapsed(true, 3, opts)).toBe(true);
    expect(nextCollapsed(true, 2, opts)).toBe(false);
  });

  it("ignores a scroll offset that is not a number", () => {
    expect(nextCollapsed(true, Number.NaN)).toBe(true);
    expect(nextCollapsed(false, Number.NaN)).toBe(false);
  });

  it("expands at the top even when the thresholds are given the wrong way round", () => {
    expect(nextCollapsed(true, 0, { collapseAt: 4, expandAt: 40 })).toBe(false);
  });
});
