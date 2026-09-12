// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// What a PDF's pages look like to a viewer, and the arithmetic of fitting one
// to a column — the half of the reader that carries no engine with it.
//
// `render.ts` is where `pdfjs-dist` is actually pulled in, and a viewer
// reaches it through `import()` at the point a PDF is opened. That only keeps
// the engine off the boot path as long as nothing on that path imports it, so
// the types and the pure functions a viewer needs *before* it opens anything
// live here instead.

/** A page ready to be painted. Its size is in CSS pixels at scale 1. */
export type RenderablePage = {
  readonly number: number;
  readonly width: number;
  readonly height: number;
  /** Paint the page into `canvas` at `scale`, sizing the canvas to match.
   *  The returned `cancel` stops a paint that is no longer wanted — a page
   *  scrolled away, or a scale already superseded. */
  paint(
    canvas: HTMLCanvasElement,
    scale: number,
  ): { done: Promise<void>; cancel: () => void };
  /** Drop the page's intermediate data; it repaints from the document. */
  release(): void;
};

/** An open PDF. `close()` tears down the worker — a viewer must call it. */
export type OpenPdf = {
  readonly pageCount: number;
  page(number: number): Promise<RenderablePage>;
  close(): Promise<void>;
};

/** The scale at which a page `pageWidth` CSS px wide fills `viewportWidth`,
 *  multiplied by `zoom`. A viewport that hasn't been measured yet (width 0)
 *  gives scale 0 — nothing to paint until it has one. */
export function fitWidthScale(
  pageWidth: number,
  viewportWidth: number,
  zoom = 1,
): number {
  if (pageWidth <= 0 || viewportWidth <= 0 || zoom <= 0) return 0;
  return (viewportWidth / pageWidth) * zoom;
}

/** The device pixels to paint per CSS pixel. Capped: a phone at DPR 3 would
 *  otherwise hold three times the bitmap for a difference nobody sees on a
 *  page of body text. */
export function paintRatio(devicePixelRatio: number, cap = 2): number {
  if (!Number.isFinite(devicePixelRatio) || devicePixelRatio <= 0) return 1;
  return Math.min(devicePixelRatio, cap);
}
