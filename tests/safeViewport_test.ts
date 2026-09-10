import { describe, expect, it } from "vitest";

import {
  computeFloatingRect,
  type FloatingPlacement,
} from "@niclaslindstedt/oss-framework/components";

import {
  clampRectToBand,
  clampToInsets,
  type EdgeInsets,
  type ViewportBand,
} from "../src/generic/safeViewport.ts";

// An installed PWA on a notched phone: the layout viewport is the whole
// screen, the status bar eats the first 59px, the home indicator the last 34,
// and the app pins a 44px-tall header under the status bar.
const SCREEN = { innerWidth: 390, innerHeight: 844, scrollX: 0, scrollY: 0 };
const RAW: ViewportBand = { offsetTop: 0, height: SCREEN.innerHeight };
const INSETS: EdgeInsets = { top: 59 + 44, bottom: 34 };

const PLACEMENT: FloatingPlacement = {
  width: { kind: "min", minPx: 160 },
  anchor: "left",
  coordinateSpace: "viewport",
};

function trigger(top: number, height = 36): DOMRect {
  return {
    x: 16,
    y: top,
    top,
    left: 16,
    right: 374,
    bottom: top + height,
    width: 358,
    height,
    toJSON: () => ({}),
  } as DOMRect;
}

function place(rect: DOMRect, band: ViewportBand) {
  return clampRectToBand(
    computeFloatingRect(rect, PLACEMENT, band, SCREEN),
    band,
    0,
  );
}

describe("clampToInsets", () => {
  it("reserves the edges the app may not paint in", () => {
    expect(clampToInsets(RAW, INSETS, SCREEN.innerHeight)).toEqual({
      offsetTop: 103,
      height: 707,
    });
  });

  it("keeps the smaller band when the keyboard already shrank the viewport", () => {
    const keyboard: ViewportBand = { offsetTop: 120, height: 380 };
    expect(clampToInsets(keyboard, INSETS, SCREEN.innerHeight)).toEqual({
      offsetTop: 120,
      height: 380,
    });
  });

  it("never reports a negative height", () => {
    const tiny: ViewportBand = { offsetTop: 0, height: 90 };
    expect(clampToInsets(tiny, INSETS, 90).height).toBe(0);
  });
});

describe("a menu that flips above its trigger", () => {
  const band = clampToInsets(RAW, INSETS, SCREEN.innerHeight);

  it("stops at the reserved top edge instead of the top of the screen", () => {
    // Low enough on the screen that there is no useful room below.
    const rect = place(trigger(700), band);
    expect(rect.placement).toBe("above");
    // The panel grows upward from `top`, so its highest pixel is
    // `top - maxHeight`. It must land below the header and the status bar.
    expect(rect.top - rect.maxHeight).toBeGreaterThanOrEqual(band.offsetTop);
  });

  it("would run under the status bar without the reserved edges", () => {
    const rect = place(trigger(700), RAW);
    expect(rect.top - rect.maxHeight).toBeLessThan(INSETS.top);
  });

  it("leaves a usable panel even from a trigger just under the header", () => {
    const rect = place(trigger(140), band);
    expect(rect.placement).toBe("below");
    expect(rect.top).toBeGreaterThanOrEqual(band.offsetTop);
  });
});

describe("a menu that opens below its trigger", () => {
  const band = clampToInsets(RAW, INSETS, SCREEN.innerHeight);

  it("stops short of the home indicator", () => {
    const rect = place(trigger(200), band);
    expect(rect.placement).toBe("below");
    expect(rect.top + rect.maxHeight).toBeLessThanOrEqual(
      band.offsetTop + band.height,
    );
  });
});

describe("clampRectToBand", () => {
  const band: ViewportBand = { offsetTop: 100, height: 600 };

  it("caps the 120px floor the framework applies to a cramped panel", () => {
    const cramped = {
      top: 150,
      left: 0,
      width: 200,
      maxWidth: 200,
      maxHeight: 120,
      arrowLeft: 10,
      placement: "above" as const,
    };
    expect(clampRectToBand(cramped, band, 0).maxHeight).toBe(50);
  });

  it("offsets the band by the scroll position in document space", () => {
    const cramped = {
      top: 350,
      left: 0,
      width: 200,
      maxWidth: 200,
      maxHeight: 400,
      arrowLeft: 10,
      placement: "above" as const,
    };
    expect(clampRectToBand(cramped, band, 200).maxHeight).toBe(50);
  });

  it("leaves a rect that already fits untouched", () => {
    const roomy = {
      top: 600,
      left: 0,
      width: 200,
      maxWidth: 200,
      maxHeight: 200,
      arrowLeft: 10,
      placement: "above" as const,
    };
    expect(clampRectToBand(roomy, band, 0)).toBe(roomy);
  });
});
