// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";

import {
  computeFloatingRect,
  type FloatingPlacement,
  type FloatingRect,
} from "@niclaslindstedt/oss-framework/components";
import { resolveCssLength } from "@niclaslindstedt/oss-framework/pwa";

// Where a floating panel is allowed to land.
//
// The framework's `useFloatingPosition` measures against the raw visual
// viewport, whose top edge on an installed iOS PWA is the top of the *screen* —
// under the status bar, inside `env(safe-area-inset-top)`, and behind whatever
// chrome the app pins to that edge. A panel that flips above its trigger fills
// that space and renders unreadable text under the clock.
//
// The fix is not new geometry: `computeFloatingRect` already takes the visible
// band as an argument. It just has to be handed the band the app may paint in
// rather than the one the browser reports — the visual viewport shrunk by the
// device's safe-area insets and by any element pinned to an edge.

/** The band of the layout viewport a panel may occupy, in CSS pixels. */
export type ViewportBand = { offsetTop: number; height: number };

/** Reserved space at the top and bottom edges, in CSS pixels. */
export type EdgeInsets = { top: number; bottom: number };

export type SafeRegion = {
  /** CSS length reserved at the top, e.g. `env(safe-area-inset-top, 0px)`. */
  top: string;
  /** CSS length reserved at the bottom. */
  bottom: string;
  /** Selector for on-screen chrome pinned to the top edge, which panels clear
   *  in addition to the inset above. Matched elements are measured live. */
  topEdge?: string;
};

/** Reserve the device's safe-area insets, plus anything marked
 *  `data-floating-edge="top"` — the app tags its own pinned chrome with it. */
export const DEFAULT_SAFE_REGION: SafeRegion = {
  top: "env(safe-area-inset-top, 0px)",
  bottom: "env(safe-area-inset-bottom, 0px)",
  topEdge: '[data-floating-edge="top"]',
};

/** Shrink a viewport band by the reserved edges. Pure — the regression test for
 *  "nothing renders inside the safe inset" runs through here. */
export function clampToInsets(
  viewport: ViewportBand,
  insets: EdgeInsets,
  layoutHeight: number,
): ViewportBand {
  const top = Math.max(viewport.offsetTop, insets.top);
  const bottom = Math.min(
    viewport.offsetTop + viewport.height,
    layoutHeight - insets.bottom,
  );
  return { offsetTop: top, height: Math.max(0, bottom - top) };
}

/** Cap a computed panel rect so it cannot spill past the band on the side it
 *  was placed. `computeFloatingRect` floors its `maxHeight` at 120px, which is
 *  the one way a panel still reaches into a reserved edge once the band is
 *  correct; a panel that flips above its trigger grows upward from `top`. */
export function clampRectToBand(
  rect: FloatingRect,
  band: ViewportBand,
  scrollOffset: number,
): FloatingRect {
  const bandTop = band.offsetTop + scrollOffset;
  const bandBottom = bandTop + band.height;
  const room =
    rect.placement === "above" ? rect.top - bandTop : bandBottom - rect.top;
  const maxHeight = Math.min(rect.maxHeight, Math.max(0, room));
  return maxHeight === rect.maxHeight ? rect : { ...rect, maxHeight };
}

// `resolveCssLength` mounts a probe element to measure an expression, so the
// answers are cached across a drag or a scroll and dropped whenever the
// viewport itself changes.
const lengthCache = new Map<string, number>();

function cssLength(expression: string): number {
  const cached = lengthCache.get(expression);
  if (cached !== undefined) return cached;
  const px = resolveCssLength(expression);
  lengthCache.set(expression, px);
  return px;
}

/** Drop the cached CSS lengths — orientation and font-size changes move them. */
export function forgetCssLengths(): void {
  lengthCache.clear();
}

function edgeChromeBottom(selector: string | undefined): number {
  if (!selector || typeof document === "undefined") return 0;
  let lowest = 0;
  for (const el of document.querySelectorAll(selector)) {
    const rect = el.getBoundingClientRect();
    if (rect.height > 0 && rect.bottom > lowest) lowest = rect.bottom;
  }
  return lowest;
}

/** Resolve a region against the live document. */
export function readEdgeInsets(region: SafeRegion): EdgeInsets {
  return {
    top: Math.max(cssLength(region.top), edgeChromeBottom(region.topEdge)),
    bottom: cssLength(region.bottom),
  };
}

function readVisualViewport(): ViewportBand {
  const vv = typeof window === "undefined" ? null : window.visualViewport;
  if (!vv) {
    return {
      offsetTop: 0,
      height: typeof window === "undefined" ? 0 : window.innerHeight,
    };
  }
  return { offsetTop: vv.offsetTop, height: vv.height };
}

/** The visible band, minus the edges the app keeps clear. */
export function readSafeBand(region: SafeRegion): ViewportBand {
  return clampToInsets(
    readVisualViewport(),
    readEdgeInsets(region),
    typeof window === "undefined" ? 0 : window.innerHeight,
  );
}

/** The framework's `useFloatingPosition`, measured against the safe band. */
export function useSafeFloatingPosition(
  anchor: RefObject<HTMLElement | null>,
  open: boolean,
  placement: FloatingPlacement,
  region: SafeRegion = DEFAULT_SAFE_REGION,
): FloatingRect | null {
  const [rect, setRect] = useState<FloatingRect | null>(null);
  const placementRef = useRef(placement);
  placementRef.current = placement;
  const regionRef = useRef(region);
  regionRef.current = region;

  useLayoutEffect(() => {
    if (!open) {
      setRect(null);
      return;
    }
    function measure() {
      const domRect = anchor.current?.getBoundingClientRect();
      if (!domRect) return;
      const placement = placementRef.current;
      const band = readSafeBand(regionRef.current);
      const scrollOffset =
        placement.coordinateSpace === "document" ? window.scrollY : 0;
      const computed = computeFloatingRect(domRect, placement, band, {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
      });
      setRect(clampRectToBand(computed, band, scrollOffset));
    }
    function remeasure() {
      forgetCssLengths();
      measure();
    }
    measure();
    window.addEventListener("resize", remeasure);
    window.addEventListener("scroll", measure, true);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", remeasure);
    vv?.addEventListener("scroll", measure);
    return () => {
      window.removeEventListener("resize", remeasure);
      window.removeEventListener("scroll", measure, true);
      vv?.removeEventListener("resize", remeasure);
      vv?.removeEventListener("scroll", measure);
    };
  }, [open, anchor]);

  return rect;
}
