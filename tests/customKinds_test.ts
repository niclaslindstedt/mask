import { describe, expect, it } from "vitest";

import {
  addCustomKind,
  foldKindLabel,
  kindLabelProblem,
  mergeCustomKinds,
  normalizeKindLabel,
  parseCustomKinds,
  removeCustomKind,
  renameCustomKind,
  type CustomKind,
} from "../src/app/customKinds.ts";
import { kindOptions } from "../src/app/kinds.ts";
import { formatPlaceholder } from "../src/generic/placeholders.ts";

let seq = 0;
const mintId = () => `kind-${++seq}`;
const at = () => "2026-01-01T00:00:00.000Z";

const kind = (label: string, id = label.toLowerCase()): CustomKind => ({
  id,
  label,
  createdAt: at(),
});

describe("normalizeKindLabel", () => {
  it("trims, collapses whitespace and caps the length", () => {
    expect(normalizeKindLabel("  Judge  ")).toBe("Judge");
    expect(normalizeKindLabel("Lay\n  assessor")).toBe("Lay assessor");
    expect(normalizeKindLabel("x".repeat(40))).toHaveLength(24);
  });

  it("folds labels for comparison, case aside", () => {
    expect(foldKindLabel(" JUDGE ")).toBe(foldKindLabel("judge"));
  });
});

describe("kindLabelProblem", () => {
  it("accepts an ordinary label", () => {
    expect(kindLabelProblem("Judge")).toBeNull();
    expect(kindLabelProblem("Bil 2")).toBeNull();
  });

  it("rejects blank labels and labels with nothing to spell", () => {
    expect(kindLabelProblem("   ")).toBe("empty");
    expect(kindLabelProblem("—/—")).toBe("unusable");
  });

  it("rejects a built-in kind's id, whatever its case", () => {
    expect(kindLabelProblem("name")).toBe("reserved");
    expect(kindLabelProblem("Postal")).toBe("reserved");
  });

  it("rejects a label another type already has", () => {
    expect(kindLabelProblem("judge", [kind("Judge")])).toBe("duplicate");
  });
});

describe("the list transforms", () => {
  it("adds, renames and removes by id", () => {
    let list = addCustomKind([], " Judge ", mintId, at);
    expect(list).toEqual([{ id: "kind-1", label: "Judge", createdAt: at() }]);

    list = renameCustomKind(list, "kind-1", "Lay assessor");
    expect(list[0]!.label).toBe("Lay assessor");

    expect(removeCustomKind(list, "kind-1")).toEqual([]);
  });

  it("never adds or renames into a duplicate label", () => {
    const list = [kind("Judge"), kind("Plaintiff")];
    expect(addCustomKind(list, "JUDGE", mintId, at)).toHaveLength(2);
    expect(renameCustomKind(list, "plaintiff", "judge")).toEqual(list);
  });

  it("leaves a blank rename alone", () => {
    const list = [kind("Judge")];
    expect(renameCustomKind(list, "judge", "  ")).toEqual(list);
  });
});

describe("mergeCustomKinds", () => {
  it("offers the global types first, then the workspace's own", () => {
    const merged = mergeCustomKinds(
      [kind("Judge")],
      [kind("Car"), kind("Plaintiff")],
    );
    expect(merged.map((k) => [k.label, k.scope])).toEqual([
      ["Judge", "global"],
      ["Car", "workspace"],
      ["Plaintiff", "workspace"],
    ]);
  });

  it("shows a label that ended up in both lists once, as the global one", () => {
    const merged = mergeCustomKinds(
      [kind("Judge", "g1")],
      [kind("judge", "w1")],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0]!.scope).toBe("global");
  });
});

describe("parseCustomKinds", () => {
  it("reads a stored list back", () => {
    const raw = JSON.stringify([{ id: "a", label: "Judge", createdAt: at() }]);
    expect(parseCustomKinds(raw)).toEqual([
      { id: "a", label: "Judge", createdAt: at() },
    ]);
  });

  it("survives junk: bad JSON, wrong shapes, blank and duplicate labels", () => {
    expect(parseCustomKinds("{not json")).toEqual([]);
    expect(parseCustomKinds('{"a":1}')).toEqual([]);
    const raw = JSON.stringify([
      null,
      { id: "a" },
      { id: "b", label: "   " },
      { id: "c", label: "Judge" },
      { id: "d", label: "judge" },
    ]);
    expect(parseCustomKinds(raw).map((k) => k.id)).toEqual(["c"]);
  });

  it("fills a missing timestamp rather than dropping the type", () => {
    const raw = JSON.stringify([{ id: "a", label: "Judge" }]);
    expect(parseCustomKinds(raw)[0]!.createdAt).toBe(new Date(0).toISOString());
  });
});

describe("kindOptions", () => {
  const t = ((key: string) => key) as Parameters<typeof kindOptions>[0];

  it("keeps the built-ins first and appends the custom labels", () => {
    const options = kindOptions(t, ["Judge", "Plaintiff"]);
    expect(options.slice(0, 2).map((o) => o.value)).toEqual(["name", "street"]);
    expect(options.slice(-2).map((o) => o.label)).toEqual([
      "Judge",
      "Plaintiff",
    ]);
  });

  it("collapses case-insensitive duplicates and drops built-in labels", () => {
    const options = kindOptions(t, ["Judge", "judge", "JUDGE", "name"]);
    expect(options.filter((o) => o.label === "Judge")).toHaveLength(1);
    expect(options.filter((o) => o.value === "name")).toHaveLength(1);
  });
});

describe("a custom type in a placeholder", () => {
  it("spells the label into the kind-based styles", () => {
    expect(formatPlaceholder("kindNumber", 1, "Judge")).toBe("JUDGE1");
    expect(formatPlaceholder("bracketKind", 2, "Lay assessor")).toBe(
      "[LAYASSESSOR 2]",
    );
    expect(formatPlaceholder("mustache", 1, "Judge")).toBe("{{judge1}}");
  });
});
