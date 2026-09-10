import { beforeAll, describe, expect, it } from "vitest";

import {
  ALL_DETECTORS_ON,
  loadDictionaries,
} from "../src/app/detectors/index.ts";

beforeAll(async () => {
  await loadDictionaries();
});
import {
  buildMaskPlan,
  compilePattern,
  detectCandidates,
  maskText,
  retokenForKind,
  tokensPresent,
  unmaskText,
  type DetectContext,
} from "../src/app/masking.ts";
import { EMPTY_RULES, type Variable } from "../src/app/types.ts";

const TEXT =
  "Anna Svensson (811218-9876), Storgatan 12, 123 45 Storstad, ringde 070-123 45 67. " +
  "Annas ärende gäller Stockholms kommun. Kontakt: anna@example.se";

const ctx = (over: Partial<DetectContext> = {}): DetectContext => ({
  variables: [],
  rules: EMPTY_RULES,
  detectors: ALL_DETECTORS_ON,
  ignored: [],
  ...over,
});

let seq = 0;
const mintId = () => `v-${++seq}`;

describe("detectCandidates", () => {
  it("groups every detector hit per distinct value in text order", () => {
    const found = detectCandidates(TEXT, ctx());
    expect(found.map((c) => [c.value, c.kind])).toEqual([
      ["Anna Svensson", "name"],
      ["811218-9876", "pin"],
      ["Storgatan 12", "street"],
      ["123 45", "postal"],
      ["070-123 45 67", "phone"],
      ["Anna", "name"],
      ["Stockholm", "city"],
      ["anna@example.se", "email"],
    ]);
  });

  it("honours the never-list, the project's ignored values, and the always-list", () => {
    const found = detectCandidates(
      TEXT,
      ctx({
        rules: {
          always: [{ value: "Storstad", kind: "city" }],
          never: ["stockholm"],
          patterns: [],
        },
        ignored: ["Anna"],
      }),
    );
    const values = found.map((c) => c.value);
    expect(values).toContain("Storstad");
    expect(values).not.toContain("Stockholm");
    expect(values).not.toContain("Anna");
    expect(found.find((c) => c.value === "Storstad")?.source).toBe("always");
  });

  it("runs custom patterns and skips an invalid one", () => {
    const found = detectCandidates(
      "Ärende DNR-2024-0042 och DNR-2023-0001",
      ctx({
        rules: {
          always: [],
          never: [],
          patterns: [
            {
              id: "a",
              label: "Dnr",
              pattern: "DNR-\\d{4}-\\d{4}",
              kind: "custom",
              enabled: true,
            },
            {
              id: "b",
              label: "broken",
              pattern: "(",
              kind: "custom",
              enabled: true,
            },
            {
              id: "c",
              label: "off",
              pattern: "Ärende",
              kind: "custom",
              enabled: false,
            },
          ],
        },
      }),
    );
    expect(found.map((c) => [c.value, c.source])).toEqual([
      ["DNR-2024-0042", "pattern:a"],
      ["DNR-2023-0001", "pattern:a"],
    ]);
    expect(compilePattern("(")).toBeNull();
    expect(compilePattern("abc", "gi")?.flags).toBe("iu");
  });

  it("recognises a project's existing variables first", () => {
    const variables: Variable[] = [
      {
        id: "v",
        token: "AAA",
        value: "Anna Svensson",
        kind: "name",
        createdAt: "",
      },
    ];
    const found = detectCandidates("Anna Svenssons bil", ctx({ variables }));
    expect(found[0]).toMatchObject({
      value: "Anna Svensson",
      source: "variable",
      variable: variables[0],
    });
  });
});

describe("buildMaskPlan / maskText / unmaskText", () => {
  it("mints placeholders for confirmed values, reuses existing ones, and round-trips", () => {
    const existing: Variable[] = [
      {
        id: "v0",
        token: "NAME1",
        value: "Anna Svensson",
        kind: "name",
        createdAt: "",
      },
    ];
    const plan = buildMaskPlan(
      TEXT,
      [
        { value: "Anna Svensson", kind: "name", include: true },
        { value: "811218-9876", kind: "pin", include: true },
        { value: "Storgatan 12", kind: "street", include: false },
        { value: "Anna", kind: "name", include: true },
        { value: "Stockholm", kind: "city", include: true },
      ],
      existing,
      "kindNumber",
      mintId,
      () => "2026-01-01T00:00:00.000Z",
    );
    expect(plan.added.map((v) => [v.value, v.token])).toEqual([
      ["811218-9876", "PIN1"],
      ["Anna", "NAME2"],
      ["Stockholm", "CITY1"],
    ]);
    expect(plan.variables).toHaveLength(4);
    expect(plan.masked).toContain("NAME1 (PIN1), Storgatan 12,");
    expect(plan.masked).toContain("NAME2s ärende gäller CITY1s kommun");
    expect(unmaskText(plan.masked, plan.variables)).toBe(TEXT);
  });

  it("applies every project variable when re-masking, whatever the style", () => {
    const vars: Variable[] = [
      { id: "1", token: "AAA", value: "Anna", kind: "name", createdAt: "" },
      { id: "2", token: "$1", value: "Lund", kind: "city", createdAt: "" },
      {
        id: "3",
        token: "[NAME 1]",
        value: "Bo Ek",
        kind: "name",
        createdAt: "",
      },
    ];
    const masked = maskText("Anna och Bo Ek i Lund; Lundagård.", vars);
    expect(masked).toBe("AAA och [NAME 1] i $1; Lundagård.");
    expect(unmaskText("Svar: AAA, [NAME 1] och $1s hus.", vars)).toBe(
      "Svar: Anna, Bo Ek och Lunds hus.",
    );
    expect(tokensPresent("AAA hälsar $1", vars).map((v) => v.id)).toEqual([
      "1",
      "2",
    ]);
  });
});

describe("a custom kind", () => {
  it("mints a placeholder that spells the label out", () => {
    const plan = buildMaskPlan(
      "Domaren Karl Ek dömde. Karl Ek var tydlig.",
      [
        { value: "Karl Ek", kind: "Judge", include: true },
        { value: "Domaren", kind: "custom", include: false },
      ],
      [],
      "kindNumber",
      mintId,
      () => "2026-01-01T00:00:00.000Z",
    );
    expect(plan.added.map((v) => [v.value, v.kind, v.token])).toEqual([
      ["Karl Ek", "Judge", "JUDGE1"],
    ]);
    expect(plan.masked).toBe("Domaren JUDGE1 dömde. JUDGE1 var tydlig.");
    expect(unmaskText(plan.masked, plan.variables)).toBe(
      "Domaren Karl Ek dömde. Karl Ek var tydlig.",
    );
  });

  it("counts per label, so two custom types never share a number", () => {
    const plan = buildMaskPlan(
      "Karl Ek mot Ida Ask.",
      [
        { value: "Karl Ek", kind: "Judge", include: true },
        { value: "Ida Ask", kind: "Plaintiff", include: true },
      ],
      [],
      "kindNumber",
      mintId,
    );
    expect(plan.added.map((v) => v.token)).toEqual(["JUDGE1", "PLAINTIFF1"]);
  });
});

describe("retokenForKind", () => {
  const vars = (): Variable[] => [
    {
      id: "1",
      token: "NAME1",
      value: "Karl Ek",
      kind: "name",
      createdAt: "",
    },
    { id: "2", token: "NAME2", value: "Ida Ask", kind: "name", createdAt: "" },
  ];

  it("renames a placeholder the app minted", () => {
    const next = retokenForKind(vars(), "1", "Judge", "kindNumber");
    expect(next[0]).toMatchObject({ kind: "Judge", token: "JUDGE1" });
    // The other placeholder is untouched — including its number.
    expect(next[1]).toMatchObject({ kind: "name", token: "NAME2" });
  });

  it("leaves a placeholder the user typed alone", () => {
    const list = vars();
    list[0] = { ...list[0]!, token: "DOMAREN" };
    const next = retokenForKind(list, "1", "Judge", "kindNumber");
    expect(next[0]).toMatchObject({ kind: "Judge", token: "DOMAREN" });
  });

  it("keeps the placeholder in a style that ignores the kind", () => {
    const list: Variable[] = [
      { id: "1", token: "AAA", value: "Karl Ek", kind: "name", createdAt: "" },
    ];
    const next = retokenForKind(list, "1", "Judge", "upperLetters");
    expect(next[0]).toMatchObject({ kind: "Judge", token: "AAA" });
  });

  it("never takes a placeholder another value already has", () => {
    const list: Variable[] = [
      ...vars(),
      {
        id: "3",
        token: "JUDGE1",
        value: "Bo Alm",
        kind: "Judge",
        createdAt: "",
      },
    ];
    const next = retokenForKind(list, "1", "Judge", "kindNumber");
    expect(next[0]!.token).toBe("JUDGE2");
  });

  it("is a no-op for an unknown id or an unchanged kind", () => {
    expect(retokenForKind(vars(), "nope", "Judge", "kindNumber")).toEqual(
      vars(),
    );
    expect(retokenForKind(vars(), "1", "name", "kindNumber")).toEqual(vars());
  });
});
