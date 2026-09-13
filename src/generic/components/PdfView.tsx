// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { SpinnerIcon } from "@niclaslindstedt/oss-framework/components";

import {
  fitWidthScale,
  paintRatio,
  type OpenPdf,
  type RenderablePage,
} from "../pdf/pages.ts";
import { usePinchZoom } from "../pinchZoom.ts";
import {
  FullscreenButton,
  FullscreenLayer,
  type FullscreenLabels,
} from "./Fullscreen.tsx";

// A PDF, shown as its pages rather than as the text inside them.
//
// Pages are painted as they come into view and dropped as they leave, so the
// memory a document costs follows the window rather than its page count — a
// bitmap of an A4 page is a few megabytes, and a long document would be
// hundreds. The engine itself is behind an `import()`: nothing here is
// downloaded until a PDF is actually opened.
//
// Width, not paper size, decides the scale: a page is fitted to the column it
// is shown in, and the zoom multiplies that, so the default is readable on a
// phone. Zooming is by pinch (the app's own viewport turns the browser's off,
// so `usePinchZoom` gives it back here) or by the buttons beside the readout,
// and either way the point under the fingers is the point that stays put.

export type PdfViewLabels = {
  /** While the document is being opened. */
  loading: string;
  /** When it can't be read. */
  failed: string;
  /** Page caption, e.g. `(n, of) => \`Page ${n} of ${of}\``. */
  page: (n: number, total: number) => string;
  zoomIn: string;
  zoomOut: string;
  /** Back to fitting the width. */
  zoomReset: string;
  /** Given, the header offers to take the pages over the whole screen. */
  fullscreen?: FullscreenLabels;
};

type Props = {
  /** The PDF's bytes. */
  file: Blob;
  labels: PdfViewLabels;
  /** Shown at the left of the header. */
  title?: string;
  className?: string;
  /** Height cap for the scrolling page column (a Tailwind `max-h-*` class).
   *  Ignored while the pages have the screen to themselves. */
  bodyClassName?: string;
};

/** Zoom bounds and step. 1 is "fits the column"; below it a whole page fits on
 *  a phone, which is the other thing a reader wants to see. */
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 6;
const ZOOM_STEP = 1.25;

const clampZoom = (zoom: number) =>
  Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

/** What a zoom has to know to keep a point where it was: where the point is in
 *  the scroller, and how far it had scrolled at what size. */
type ZoomAnchor = {
  x: number;
  y: number;
  left: number;
  top: number;
  width: number;
  height: number;
};

export function PdfView({
  file,
  labels,
  title,
  className = "",
  bodyClassName = "max-h-[60vh]",
}: Props) {
  const [pdf, setPdf] = useState<OpenPdf | null>(null);
  const [firstPage, setFirstPage] = useState<RenderablePage | null>(null);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [full, setFull] = useState(false);
  // The scrolling element twice over: as state, because what the pages are
  // fitted to and observed against changes with it, and as a ref, because
  // putting the reader back where they were means writing to it.
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [columnWidth, setColumnWidth] = useState(0);
  const anchor = useRef<ZoomAnchor | null>(null);
  /** Where in the document the reader is, as a fraction of its extent. */
  const position = useRef({ x: 0, y: 0 });
  /** Set while a fresh scroller has to be put back where the last one was. */
  const resume = useRef<{ x: number; y: number } | null>(null);

  // Open the document, and hold its first page for the size every other page
  // is drawn at before it has been read — nearly every document is one paper
  // size throughout, and a page that isn't corrects itself as it loads.
  useEffect(() => {
    let live = true;
    let opened: OpenPdf | null = null;
    setPdf(null);
    setFirstPage(null);
    setFailed(false);
    void (async () => {
      try {
        const { openPdf } = await import("../pdf/render.ts");
        const doc = await openPdf(await file.arrayBuffer());
        const page = doc.pageCount > 0 ? await doc.page(1) : null;
        if (!live) {
          void doc.close();
          return;
        }
        opened = doc;
        setPdf(doc);
        setFirstPage(page);
      } catch {
        if (live) setFailed(true);
      }
    })();
    return () => {
      live = false;
      void opened?.close();
    };
  }, [file]);

  // The width a page is fitted to. Measured rather than assumed: the modal
  // this sits in is as wide as the phone one moment and 52rem the next.
  // Measured *before the paint*, so going fullscreen never shows a frame of
  // pages at the old width.
  useLayoutEffect(() => {
    if (!scroller) return;
    const measure = () => setColumnWidth(scroller.clientWidth - 24);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [scroller]);

  // Going fullscreen and back re-creates the scrolling element — it is drawn
  // over the app rather than in place — so the reader is put back where they
  // were once the new one has been measured. Both passes (the old width, then
  // the measured one) land here; the frame ends with the right one.
  useLayoutEffect(() => {
    const at = resume.current;
    const el = scrollerRef.current;
    if (!el || at === null) return;
    el.scrollLeft = at.x * el.scrollWidth;
    el.scrollTop = at.y * el.scrollHeight;
    const id = requestAnimationFrame(() => {
      resume.current = null;
    });
    return () => cancelAnimationFrame(id);
  }, [scroller, columnWidth]);

  // A zoom keeps the point it happened about where it was: the content grows
  // by whatever the whole column grew by, and the scroll follows it. Measured
  // rather than derived, because the captions and the gaps between pages are
  // the same size at every zoom and the pages are not.
  useLayoutEffect(() => {
    const at = anchor.current;
    anchor.current = null;
    const el = scrollerRef.current;
    if (!el || !at) return;
    const grewX = at.width > 0 ? el.scrollWidth / at.width : 1;
    const grewY = at.height > 0 ? el.scrollHeight / at.height : 1;
    el.scrollLeft = (at.left + at.x) * grewX - at.x;
    el.scrollTop = (at.top + at.y) * grewY - at.y;
  }, [scroller, zoom]);

  /** Zoom about a point on the screen, or about the middle of the view. */
  const zoomTo = (next: number, at?: { clientX: number; clientY: number }) => {
    const el = scrollerRef.current;
    if (el) {
      const box = el.getBoundingClientRect();
      anchor.current = {
        x: at ? at.clientX - box.left : box.width / 2,
        y: at ? at.clientY - box.top : box.height / 2,
        left: el.scrollLeft,
        top: el.scrollTop,
        width: el.scrollWidth,
        height: el.scrollHeight,
      };
    }
    setZoom(clampZoom(next));
  };

  const attachScroller = useCallback((el: HTMLDivElement | null) => {
    scrollerRef.current = el;
    setScroller(el);
  }, []);

  usePinchZoom(scroller, zoom, zoomTo);

  return (
    <FullscreenLayer active={full} onExit={() => setFull(false)}>
      <section
        className={`flex min-h-0 flex-col overflow-hidden bg-surface ${
          full ? "flex-1" : "rounded-lg border border-line"
        } ${className}`.trim()}
      >
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line bg-surface-2 px-3 py-2">
          <h3 className="min-w-0 truncate text-sm font-semibold text-fg-bright">
            {title}
          </h3>
          <div className="flex shrink-0 items-center gap-1">
            <ZoomButton
              label={labels.zoomOut}
              disabled={zoom <= MIN_ZOOM}
              onPress={() => zoomTo(zoom / ZOOM_STEP)}
            >
              −
            </ZoomButton>
            <button
              type="button"
              aria-label={labels.zoomReset}
              title={labels.zoomReset}
              onClick={() => zoomTo(1)}
              className="min-w-12 cursor-pointer rounded px-1 py-1 text-xs text-muted tabular-nums hover:bg-surface-3 hover:text-fg"
            >
              {Math.round(zoom * 100)}%
            </button>
            <ZoomButton
              label={labels.zoomIn}
              disabled={zoom >= MAX_ZOOM}
              onPress={() => zoomTo(zoom * ZOOM_STEP)}
            >
              +
            </ZoomButton>
            {labels.fullscreen && (
              <FullscreenButton
                active={full}
                labels={labels.fullscreen}
                onToggle={() => {
                  resume.current = position.current;
                  setFull((on) => !on);
                }}
              />
            )}
          </div>
        </header>
        <div
          ref={attachScroller}
          onScroll={(e) => {
            const el = e.currentTarget;
            position.current = {
              x: el.scrollWidth > 0 ? el.scrollLeft / el.scrollWidth : 0,
              y: el.scrollHeight > 0 ? el.scrollTop / el.scrollHeight : 0,
            };
          }}
          // The browser keeps the one-finger pan; the pinch is this view's.
          style={{ touchAction: "pan-x pan-y" }}
          className={`min-h-0 flex-1 overflow-auto bg-surface-3 p-3 ${
            full ? "" : bodyClassName
          }`.trim()}
        >
          {failed ? (
            <p role="alert" className="p-4 text-sm text-danger">
              {labels.failed}
            </p>
          ) : !pdf ? (
            <p className="flex items-center gap-2 p-4 text-sm text-muted">
              <SpinnerIcon className="h-4 w-4 animate-spin text-accent" />
              {labels.loading}
            </p>
          ) : (
            // As wide as the widest page, and never narrower than the column:
            // a centred page wider than what holds it would otherwise put half
            // its left edge out of reach of the scroll.
            <ol className="flex w-max min-w-full flex-col items-center gap-4">
              {Array.from({ length: pdf.pageCount }, (_, i) => (
                <PdfPageSlot
                  key={i + 1}
                  pdf={pdf}
                  number={i + 1}
                  total={pdf.pageCount}
                  fallback={firstPage}
                  columnWidth={columnWidth}
                  zoom={zoom}
                  root={scroller}
                  labels={labels}
                />
              ))}
            </ol>
          )}
        </div>
      </section>
    </FullscreenLayer>
  );
}

function ZoomButton({
  label,
  disabled,
  onPress,
  children,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onPress}
      className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded text-sm text-muted hover:bg-surface-3 hover:text-fg disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

/** One page: a box of the right shape always, a painted canvas while it is
 *  anywhere near the view. */
function PdfPageSlot({
  pdf,
  number,
  total,
  fallback,
  columnWidth,
  zoom,
  root,
  labels,
}: {
  pdf: OpenPdf;
  number: number;
  total: number;
  fallback: RenderablePage | null;
  columnWidth: number;
  zoom: number;
  root: HTMLElement | null;
  labels: PdfViewLabels;
}) {
  const holder = useRef<HTMLLIElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [page, setPage] = useState<RenderablePage | null>(null);
  const [near, setNear] = useState(false);

  // "Near" is a screen's worth either side of the view, so a page is painted
  // by the time it is scrolled to rather than after.
  useEffect(() => {
    const element = holder.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) setNear(entry.isIntersecting);
      },
      { root, rootMargin: "100%" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [root]);

  useEffect(() => {
    if (!near) return;
    let live = true;
    void pdf
      .page(number)
      .then((loaded) => {
        if (live) setPage(loaded);
        else loaded.release();
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [near, pdf, number]);

  // Out of view: give the page back and let go of its bitmap.
  useEffect(() => {
    if (near || !page) return;
    page.release();
    setPage(null);
    if (canvas.current) {
      canvas.current.width = 0;
      canvas.current.height = 0;
    }
  }, [near, page]);

  const source = page ?? fallback;
  const width = source?.width ?? 0;
  const height = source?.height ?? 0;
  const scale = fitWidthScale(width, columnWidth, zoom);

  useEffect(() => {
    const element = canvas.current;
    if (!page || !element || scale <= 0) return;
    const paint = page.paint(
      element,
      scale * paintRatio(globalThis.devicePixelRatio ?? 1),
    );
    return () => paint.cancel();
  }, [page, scale]);

  return (
    <li className="flex flex-col items-center gap-1" ref={holder}>
      <span className="text-xs text-muted tabular-nums">
        {labels.page(number, total)}
      </span>
      <div
        className="overflow-hidden rounded bg-white shadow-sm"
        style={
          scale > 0
            ? { width: `${width * scale}px`, height: `${height * scale}px` }
            : { width: "100%", aspectRatio: "1 / 1.414" }
        }
      >
        <canvas ref={canvas} className="block h-full w-full" />
      </div>
    </li>
  );
}
