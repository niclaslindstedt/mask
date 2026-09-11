import { describe, expect, it } from "vitest";

import type { Candidate } from "../src/app/masking.ts";
import { mergeRows, upsertRow, type Row } from "../src/app/reviewRows.ts";

const candidate = (value: string, kind = "name"): Candidate => ({
  value,
  kind,
  source: "detector",
  spans: [{ start: 0, end: value.length, value, kind, source: "detector" }],
});

const none = () => false;

describe("mergeRows", () => {
  it("ticks every newly detected value", () => {
    const rows = mergeRows(
      [],
      [candidate("Anna Ek"), candidate("Solna", "city")],
      none,
    );
    expect(rows).toEqual([
      { value: "Anna Ek", kind: "name", include: true },
      { value: "Solna", kind: "city", include: true },
    ]);
  });

  it("keeps the decision the user already made", () => {
    const prev: Row[] = [{ value: "Anna Ek", kind: "Judge", include: false }];
    const rows = mergeRows(prev, [candidate("Anna Ek")], none);
    expect(rows).toEqual(prev);
  });

  it("drops a row detection no longer offers", () => {
    const prev: Row[] = [{ value: "Solna", kind: "city", include: true }];
    expect(mergeRows(prev, [candidate("Anna Ek")], none)).toEqual([
      { value: "Anna Ek", kind: "name", include: true },
    ]);
  });

  it("keeps a value the user typed in by hand", () => {
    const prev: Row[] = [
      { value: "Ärende 12/34", kind: "custom", include: true, manual: true },
    ];
    const rows = mergeRows(prev, [candidate("Anna Ek")], none);
    expect(rows.map((r) => r.value)).toEqual(["Ärende 12/34", "Anna Ek"]);
  });

  it("keeps a whitelisted value so its own button can take it back", () => {
    const prev: Row[] = [{ value: "Solna", kind: "city", include: false }];
    const rows = mergeRows(prev, [], (v) => v === "Solna");
    expect(rows).toEqual(prev);
  });
});

describe("upsertRow", () => {
  it("adds a value nothing offered as a manual row", () => {
    const { rows, kind } = upsertRow([], "Anna Ek", "name", true);
    expect(rows).toEqual([
      { value: "Anna Ek", kind: "name", include: true, manual: true },
    ]);
    expect(kind).toBe("name");
  });

  it("only reticks a value that already has a row, keeping its kind", () => {
    const prev: Row[] = [{ value: "Anna Ek", kind: "Judge", include: true }];
    const { rows, kind } = upsertRow(prev, "Anna Ek", "name", false);
    expect(rows).toEqual([{ value: "Anna Ek", kind: "Judge", include: false }]);
    expect(kind).toBe("Judge");
  });

  it("leaves the other rows alone", () => {
    const prev: Row[] = [
      { value: "Solna", kind: "city", include: true },
      { value: "Anna Ek", kind: "name", include: true },
    ];
    const { rows } = upsertRow(prev, "Anna Ek", "name", false);
    expect(rows[0]).toBe(prev[0]);
  });
});
