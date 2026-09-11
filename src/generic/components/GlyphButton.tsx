// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { ReactNode } from "react";

import {
  ICON_BUTTON_CLASS,
  ICON_BUTTON_STATE_CLASS,
} from "@niclaslindstedt/oss-framework/components";

// The framework's `IconButton`, but its label is drawn beside the glyph once
// there is room for it: a square glyph button where it is tight, a glyph with
// its text where it is not. The label is the accessible name either way, so
// the two look different and read the same.
//
// "Room" is measured on the button's own **container**, not the window — these
// sit in rows of other controls, and a split pane stays narrow long after the
// window is wide. Mark the enclosing element `@container`; without one the
// button simply stays a glyph, which is the safe half of the pair.
//
// `pressed` marks a toggle that is currently on — it renders `aria-pressed`
// and the framework's "on" tint, which is what a row of list membership
// buttons needs.

// `ICON_BUTTON_CLASS` fixes a square; a labelled button grows to fit its text
// once the container clears 42rem, which is about where a row of them stops
// crowding whatever else shares the line.
const SHAPE = "gap-1.5 text-xs @2xl:w-auto @2xl:px-2.5";

export type GlyphButtonProps = {
  /** The glyph, sized by the caller (`className="h-4 w-4"`). */
  icon: ReactNode;
  /** The accessible name, and the text drawn beside the glyph once the
   *  container is wide enough for it. */
  label: string;
  /** Tooltip and accessible name when the action reads longer than the label
   *  ("Remove X from the list" beside a button that just says "Listed"). */
  title?: string;
  /** A toggle's state — `aria-pressed` plus the "on" tint. Leave unset on a
   *  button that simply does something. */
  pressed?: boolean;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
};

export function GlyphButton({
  icon,
  label,
  title,
  pressed,
  onClick,
  disabled,
  className = "",
}: GlyphButtonProps) {
  const state = ICON_BUTTON_STATE_CLASS[pressed === true ? 1 : 0];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={title ?? label}
      title={title ?? label}
      aria-pressed={pressed}
      className={`${ICON_BUTTON_CLASS} ${SHAPE} ${state} ${className}`.trim()}
    >
      {icon}
      <span className="hidden @2xl:inline">{label}</span>
    </button>
  );
}
