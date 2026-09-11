// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { IconProps } from "@niclaslindstedt/oss-framework/components";

// The app's own mark: three asterisks in a row, a masked password — the same
// glyph `public/icons/icon.svg` and `scripts/generate-icons.mjs` draw, redrawn
// in the icon set's 24-unit box (each star has arm radius 2.8 on y 12, spokes
// at 90° / 30° / 150°, centres 7.4 apart). The stroke is lighter than the set's
// 2 because three glyphs share the width one normally gets.
export function MaskIcon({ className }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M4.6 9.2v5.6M2.18 10.6l4.84 2.8M2.18 13.4l4.84-2.8" />
      <path d="M12 9.2v5.6M9.58 10.6l4.84 2.8M9.58 13.4l4.84-2.8" />
      <path d="M19.4 9.2v5.6M16.98 10.6l4.84 2.8M16.98 13.4l4.84-2.8" />
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
