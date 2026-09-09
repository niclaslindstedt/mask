import { describe, expect, it } from "vitest";

import {
  PLACEHOLDER_STYLES,
  formatPlaceholder,
  mintPlaceholder,
  placeholderExamples,
  styleUsesKind,
} from "../src/generic/placeholders.ts";

describe("formatPlaceholder", () => {
  it("counts letters in base 26 from AAA", () => {
    expect(formatPlaceholder("upperLetters", 1, "name")).toBe("AAA");
    expect(formatPlaceholder("upperLetters", 2, "name")).toBe("AAB");
    expect(formatPlaceholder("upperLetters", 26, "name")).toBe("AAZ");
    expect(formatPlaceholder("upperLetters", 27, "name")).toBe("ABA");
    expect(formatPlaceholder("upperLetters", 17576, "name")).toBe("ZZZ");
    expect(formatPlaceholder("upperLetters", 17577, "name")).toBe("BAAA");
    expect(formatPlaceholder("lowerLetters", 3, "x")).toBe("aac");
  });

  it("spells the kind into the kind-based styles", () => {
    expect(formatPlaceholder("dollarNumber", 4, "phone")).toBe("$4");
    expect(formatPlaceholder("kindNumber", 2, "phone")).toBe("PHONE2");
    expect(formatPlaceholder("bracketKind", 1, "name")).toBe("[NAME 1]");
    expect(formatPlaceholder("mustache", 7, "City")).toBe("{{city7}}");
    expect(formatPlaceholder("kindNumber", 1, "post code")).toBe("POSTCODE1");
    expect(formatPlaceholder("kindNumber", 1, "")).toBe("X1");
  });

  it("clamps a bad index to 1", () => {
    expect(formatPlaceholder("dollarNumber", 0, "x")).toBe("$1");
    expect(formatPlaceholder("upperLetters", -3, "x")).toBe("AAA");
  });
});

describe("mintPlaceholder", () => {
  it("skips taken placeholders and refills gaps", () => {
    expect(mintPlaceholder("upperLetters", "name", [])).toBe("AAA");
    expect(mintPlaceholder("upperLetters", "name", ["AAA", "AAB"])).toBe("AAC");
    expect(mintPlaceholder("upperLetters", "name", ["AAA", "AAC"])).toBe("AAB");
    expect(mintPlaceholder("kindNumber", "name", ["NAME1", "PHONE1"])).toBe(
      "NAME2",
    );
    expect(mintPlaceholder("kindNumber", "phone", new Set(["NAME1"]))).toBe(
      "PHONE1",
    );
  });
});

describe("styleUsesKind / placeholderExamples", () => {
  it("classifies every style", () => {
    for (const style of PLACEHOLDER_STYLES) {
      expect(typeof styleUsesKind(style)).toBe("boolean");
      expect(placeholderExamples(style).split(", ")).toHaveLength(3);
    }
    expect(styleUsesKind("upperLetters")).toBe(false);
    expect(styleUsesKind("bracketKind")).toBe(true);
    expect(placeholderExamples("dollarNumber")).toBe("$1, $2, $3");
  });
});
