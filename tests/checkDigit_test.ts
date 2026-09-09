import { describe, expect, it } from "vitest";

import { luhnValid } from "../src/generic/checkDigit.ts";

describe("luhnValid", () => {
  it("accepts numbers with a valid mod-10 check digit", () => {
    expect(luhnValid("79927398713")).toBe(true); // the textbook example
    expect(luhnValid("8112189876")).toBe(true); // a valid Swedish personnummer
    expect(luhnValid("5560125790")).toBe(true); // an organisation number
  });

  it("rejects a wrong check digit and non-digit input", () => {
    expect(luhnValid("79927398710")).toBe(false);
    expect(luhnValid("8112189877")).toBe(false);
    expect(luhnValid("811218-9876")).toBe(false);
    expect(luhnValid("")).toBe(false);
    expect(luhnValid("7")).toBe(false);
  });
});
