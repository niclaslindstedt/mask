// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useRef } from "react";

// Pinch-to-zoom for an app that has turned the browser's own pinch off.
//
// A PWA sets `user-scalable=no` so a stray two-finger gesture can't leave the
// whole shell scaled and offset with no way back. That also takes the pinch
// away from the one surface that wants it — a document shown as pages — so
// this gives it back to a single element: two fingers on it are a zoom, and
// anything else is left alone, so one finger still scrolls it.
//
// A trackpad's pinch arrives as a wheel with the control key held, which is
// the same gesture and is handled the same way.
//
// The gesture is reported as an *absolute* zoom — where it started, times how
// far the fingers have spread — about the point between the fingers. So the
// caller has only two jobs: bound the number, and keep that point where it is.

/** Where a zoom happened, in client coordinates. */
export type ZoomAnchor = { clientX: number; clientY: number };

/** How far a wheel has to travel for a doubling. A trackpad pinch reports a
 *  handful of points per frame, so this is the feel of the gesture. */
const WHEEL_SCALE = 120;

function spread(touches: TouchList): number {
  const [a, b] = [touches[0], touches[1]];
  if (!a || !b) return 0;
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

function midpoint(touches: TouchList): ZoomAnchor {
  const [a, b] = [touches[0], touches[1]];
  if (!a || !b) return { clientX: 0, clientY: 0 };
  return {
    clientX: (a.clientX + b.clientX) / 2,
    clientY: (a.clientY + b.clientY) / 2,
  };
}

/** Report a pinch over `target` as the zoom it asks for. `zoom` is where the
 *  caller is now — a gesture measures itself against the value it started at,
 *  so a pinch stays smooth however the caller bounds what it hands back. */
export function usePinchZoom(
  target: HTMLElement | null,
  zoom: number,
  onZoom: (zoom: number, anchor: ZoomAnchor) => void,
): void {
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;
  const onZoomRef = useRef(onZoom);
  onZoomRef.current = onZoom;

  useEffect(() => {
    if (!target) return;
    let start: { spread: number; zoom: number } | null = null;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) {
        start = null;
        return;
      }
      start = { spread: spread(e.touches), zoom: zoomRef.current };
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!start || start.spread <= 0 || e.touches.length !== 2) return;
      // A dialog that closes on a swipe down is listening on the way up; a
      // pinch is not a swipe, and the page under the fingers must not scroll.
      e.stopPropagation();
      if (e.cancelable) e.preventDefault();
      onZoomRef.current(
        (spread(e.touches) / start.spread) * start.zoom,
        midpoint(e.touches),
      );
    };

    const onTouchEnd = (e: TouchEvent) => {
      // A finger lifted ends the gesture; putting it back starts a new one,
      // measured from where this one left off.
      if (e.touches.length < 2) start = null;
    };

    const onWheel = (e: WheelEvent) => {
      // Only the pinch: a plain wheel scrolls the pages, as it should.
      if (!e.ctrlKey) return;
      e.preventDefault();
      onZoomRef.current(
        zoomRef.current * Math.pow(2, -e.deltaY / WHEEL_SCALE),
        {
          clientX: e.clientX,
          clientY: e.clientY,
        },
      );
    };

    target.addEventListener("touchstart", onTouchStart, { passive: true });
    target.addEventListener("touchmove", onTouchMove, { passive: false });
    target.addEventListener("touchend", onTouchEnd);
    target.addEventListener("touchcancel", onTouchEnd);
    target.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      target.removeEventListener("touchstart", onTouchStart);
      target.removeEventListener("touchmove", onTouchMove);
      target.removeEventListener("touchend", onTouchEnd);
      target.removeEventListener("touchcancel", onTouchEnd);
      target.removeEventListener("wheel", onWheel);
    };
  }, [target]);
}
