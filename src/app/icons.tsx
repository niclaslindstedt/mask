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

/** An open eye — the whitelist: a value left readable. */
export function WhitelistIcon({ className }: IconProps) {
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
      <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6z" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  );
}

/** The same eye, struck through — the blacklist: a value always hidden. */
export function BlacklistIcon({ className }: IconProps) {
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
      <path d="M4.5 7.5C2.9 9.1 2 12 2 12s3.6 6 10 6c1.7 0 3.2-.4 4.5-1" />
      <path d="M9.6 6.3A11 11 0 0 1 12 6c6.4 0 10 6 10 6s-1 1.7-2.8 3.3" />
      <path d="M10.2 10.2a2.6 2.6 0 0 0 3.6 3.6" />
      <path d="M3 3l18 18" />
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

/**
 * A lettered format badge — the shared frame behind `FilePdfIcon` and
 * `FileMarkdownIcon`, so the two download rows read as one family of format
 * marks rather than as two unrelated pictures. Ported from the sibling
 * `notes` app, where the same two rows sit in the same kind of menu.
 *
 * The letters get the whole glyph, and the frame is a hairline rather than the
 * set's usual 2px: at the ~16px these render at, a page-with-a-corner-fold plus
 * tiny lettering is an unreadable generic page icon, and a 2px border on a
 * 24-unit box eats the interior the lettering needs.
 */
function FormatBadge({
  className,
  letters,
  fontSize,
}: IconProps & { letters: string; fontSize: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect x="1" y="4.25" width="22" height="15.5" rx="3" />
      <text
        x="12"
        y="15.4"
        textAnchor="middle"
        stroke="none"
        fill="currentColor"
        fontSize={fontSize}
        fontWeight="700"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        {letters}
      </text>
    </svg>
  );
}

/** The `PDF` badge — the download menu's PDF row. */
export function FilePdfIcon({ className }: IconProps) {
  return <FormatBadge className={className} letters="PDF" fontSize={9} />;
}

/** The `MD` badge — the download menu's Markdown row. */
export function FileMarkdownIcon({ className }: IconProps) {
  return <FormatBadge className={className} letters="MD" fontSize={11} />;
}
