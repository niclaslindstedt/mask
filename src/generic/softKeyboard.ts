// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { InputHTMLAttributes } from "react";

// Opening a touch device's on-screen keyboard for a field that does not exist
// yet. Nothing here is app-specific; it only ever touches an input of its own.

/** How long the primer waits for a real field to claim the keyboard. */
const PRIMER_TTL_MS = 1500;

// Off-screen but *rendered* — a field that is `display:none`, `visibility:
// hidden` or zero-sized can't take focus, and a sub-16px font makes iOS zoom
// the page the moment it does.
const PRIMER_STYLE = [
  "position:fixed",
  "top:0",
  "left:0",
  "width:1px",
  "height:1px",
  "padding:0",
  "border:0",
  "outline:0",
  "opacity:0",
  "font-size:16px",
  "background:transparent",
  "color:transparent",
  "caret-color:transparent",
  "pointer-events:none",
  "z-index:-1",
].join(";");

let primer: HTMLInputElement | null = null;
let retire: ReturnType<typeof setTimeout> | undefined;

/**
 * Soft-keyboard hints for a short, free-text, single-line field: a keyboard
 * that commits rather than inserting a newline, and no autocorrect chewing on
 * a value the user typed deliberately.
 */
export const PLAIN_TEXT_KEYBOARD_PROPS: InputHTMLAttributes<HTMLInputElement> =
  {
    autoCorrect: "off",
    spellcheck: false,
    enterKeyHint: "done",
  };

/**
 * Open the on-screen keyboard for a field that is about to be rendered.
 *
 * A virtual keyboard only opens on a focus that happens *inside* the user
 * gesture asking for it. A field rendered in response to a tap focuses itself
 * an effect later — after paint, and so outside the gesture — which leaves a
 * caret blinking with no keyboard under it. Called synchronously from the tap
 * handler, this focuses a throwaway field while the gesture is still live: the
 * keyboard opens, and the real field's own focus a moment later merely moves
 * it, since a focus hop between two text fields keeps the keyboard up.
 *
 * A no-op away from coarse pointers, where there is no keyboard to open. The
 * primer leaves the DOM once the real field has taken over — or after
 * {@link PRIMER_TTL_MS}, giving the keyboard back if nothing did.
 */
export function primeSoftKeyboard(): void {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  if (!window.matchMedia?.("(pointer: coarse)").matches) return;

  if (!primer) {
    primer = document.createElement("input");
    primer.type = "text";
    primer.tabIndex = -1;
    primer.setAttribute("aria-hidden", "true");
    primer.style.cssText = PRIMER_STYLE;
  }
  if (!primer.isConnected) document.body.appendChild(primer);
  primer.focus({ preventScroll: true });

  clearTimeout(retire);
  retire = setTimeout(dismissPrimer, PRIMER_TTL_MS);
}

function dismissPrimer(): void {
  const el = primer;
  if (!el) return;
  // Still ours means nothing wanted the keyboard after all — let it close.
  if (document.activeElement === el) el.blur();
  el.remove();
}
