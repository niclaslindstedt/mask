// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { IconProps } from "@niclaslindstedt/oss-framework/components";

// The app's own mark: a redaction bar over a line of text — the same
// geometry `public/icons/icon.svg` and `scripts/generate-icons.mjs` draw.
export function MaskIcon({ className }: IconProps) {
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
      <path d="M4 7h16" />
      <rect
        x="4"
        y="10.5"
        width="10"
        height="3.5"
        rx="1"
        fill="currentColor"
        stroke="none"
      />
      <path d="M17 12h3" />
      <path d="M4 17h9" />
    </svg>
  );
}

/** A branching "rule" glyph for the Rules button. */
export function RulesIcon({ className }: IconProps) {
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
      <path d="M12 3l8 4v5c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V7l8-4z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

/** Two arrows swapping — the Restore tab. */
export function SwapIcon({ className }: IconProps) {
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
      <path d="M4 8h13l-3-3" />
      <path d="M20 16H7l3 3" />
    </svg>
  );
}

/** A tag — placeholders. */
export function TagIcon({ className }: IconProps) {
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
      <path d="M3 12V4h8l9 9-8 8-9-9z" />
      <circle cx="7.5" cy="8.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}
