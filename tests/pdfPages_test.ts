import { describe, expect, it } from "vitest";

import { fitWidthScale, paintRatio } from "../src/generic/pdf/pages.ts";
import {
  PICKER_TRIGGER_LAYOUT,
  pickerTrigger,
} from "../src/generic/components/pickerTrigger.ts";

describe("fitWidthScale", () => {
  it("scales a page to the column it is shown in", () => {
    // A4 at 72dpi is 595pt wide.
    expect(fitWidthScale(595, 595)).toBe(1);
    expect(fitWidthScale(595, 297.5)).toBeCloseTo(0.5);
    expect(fitWidthScale(595, 1190)).toBeCloseTo(2);
  });

  it("multiplies the fit by the zoom", () => {
    expect(fitWidthScale(400, 400, 2)).toBe(2);
    expect(fitWidthScale(400, 200, 4)).toBe(2);
  });

  it("gives nothing to paint for an unmeasured column or page", () => {
    expect(fitWidthScale(595, 0)).toBe(0);
    expect(fitWidthScale(0, 800)).toBe(0);
    expect(fitWidthScale(595, 800, 0)).toBe(0);
  });
});

describe("paintRatio", () => {
  it("follows the device up to the cap", () => {
    expect(paintRatio(1)).toBe(1);
    expect(paintRatio(1.5)).toBe(1.5);
    expect(paintRatio(3)).toBe(2);
    expect(paintRatio(3, 3)).toBe(3);
  });

  it("falls back to 1 for a ratio a browser didn't give", () => {
    expect(paintRatio(0)).toBe(1);
    expect(paintRatio(Number.NaN)).toBe(1);
    expect(paintRatio(-2)).toBe(1);
  });
});

describe("pickerTrigger", () => {
  it("keeps the row layout under whatever look a caller passes", () => {
    const trigger = pickerTrigger("rounded border border-line text-xs");
    expect(trigger.startsWith(PICKER_TRIGGER_LAYOUT)).toBe(true);
    // The chevron sits beside the value only while the trigger is a flex row.
    expect(trigger).toContain("flex");
    expect(trigger).toContain("items-center");
    expect(trigger).toContain("text-xs");
  });
});
