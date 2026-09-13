// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

import {
  APP_VIEWPORT_RECT,
  type IconProps,
} from "@niclaslindstedt/oss-framework/components";

// A pane, taken over the whole app and given back again.
//
// On a phone a pane inside a dialog is a letterbox: a page of A4 or a page of
// prose gets whatever is left after the dialog's own chrome, which is most of
// what makes a long document tiring to read. Fullscreen is the answer every
// reader already has, and it costs one button.
//
// Deliberately *not* the browser's Fullscreen API: iOS grants it to a video
// and to nothing else, so an installed PWA — the case this exists for — would
// be the one place it did nothing. A fixed layer over the app viewport works
// everywhere and honours the same `--app-height` the rest of the shell uses.
//
// The layer is portalled to the body rather than positioned in place, because
// a dialog card is a containing block (it carries a `translate` for its
// swipe-to-close) and a `fixed` child of one is trapped inside it.

export type FullscreenLabels = {
  /** Take the pane over the screen. */
  enter: string;
  /** Give it back. */
  exit: string;
};

/** Draw `children` over the whole app while `active`, in place otherwise. */
export function FullscreenLayer({
  active,
  onExit,
  children,
}: {
  active: boolean;
  onExit: () => void;
  children: ReactNode;
}) {
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;

  // Escape leaves fullscreen rather than closing whatever is underneath. The
  // dialog's own handler listens on the way back up, so stopping the press
  // here in the capture phase is what keeps the press from reaching it.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onExitRef.current();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [active]);

  if (!active || typeof document === "undefined") return <>{children}</>;
  return createPortal(
    <div
      className="fixed z-[80] flex flex-col bg-surface-2 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
      style={APP_VIEWPORT_RECT}
    >
      {children}
    </div>,
    document.body,
  );
}

/** The toggle a pane puts in its header. */
export function FullscreenButton({
  active,
  labels,
  onToggle,
}: {
  active: boolean;
  labels: FullscreenLabels;
  onToggle: () => void;
}) {
  const label = active ? labels.exit : labels.enter;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={onToggle}
      className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded text-muted hover:bg-surface-3 hover:text-fg"
    >
      {active ? (
        <ShrinkIcon className="h-4 w-4" />
      ) : (
        <ExpandIcon className="h-4 w-4" />
      )}
    </button>
  );
}

/** Four arrows pushing into the corners. */
function ExpandIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M9 3H5a2 2 0 0 0-2 2v4M21 9V5a2 2 0 0 0-2-2h-4M15 21h4a2 2 0 0 0 2-2v-4M3 15v4a2 2 0 0 0 2 2h4" />
    </svg>
  );
}

/** The same four, pulled back in. */
function ShrinkIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M9 3v4a2 2 0 0 1-2 2H3M21 9h-4a2 2 0 0 1-2-2V3M15 21v-4a2 2 0 0 1 2-2h4M3 15h4a2 2 0 0 1 2 2v4" />
    </svg>
  );
}
