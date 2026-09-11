// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useState, type RefObject } from "react";

// "Collapse the tall thing at the top once the reader has scrolled past it."
// A phone spends most of its height on whatever sits above the content; once
// the reader is past it, it should shrink to a bar and come back when they
// return to the top.
//
// Two thresholds rather than one: it collapses only after a real scroll and
// expands only near the very top, so a container whose height changes *because*
// of the collapse can't put the two states in a loop.

export type CollapseThresholds = {
  /** Scrolled at least this far (px): collapsed. */
  collapseAt?: number;
  /** Back within this far (px) of the top: expanded. */
  expandAt?: number;
};

export const DEFAULT_COLLAPSE_AT = 56;
export const DEFAULT_EXPAND_AT = 8;

/** What `collapsed` becomes at this scroll offset — between the two
 *  thresholds it keeps the state it already had. */
export function nextCollapsed(
  collapsed: boolean,
  scrollTop: number,
  {
    collapseAt = DEFAULT_COLLAPSE_AT,
    expandAt = DEFAULT_EXPAND_AT,
  }: CollapseThresholds = {},
): boolean {
  if (!Number.isFinite(scrollTop)) return collapsed;
  const low = Math.min(expandAt, collapseAt);
  if (scrollTop <= low) return false;
  if (scrollTop >= collapseAt) return true;
  return collapsed;
}

export type CollapseOnScrollOptions = CollapseThresholds & {
  /** Off — always expanded — when the layout doesn't want it (a desktop
   *  column that scrolls on its own, say). */
  enabled?: boolean;
};

/** Track a scroll container and answer whether its header should be collapsed.
 *  Always `false` while disabled, so a caller can gate it on a media query. */
export function useCollapseOnScroll(
  ref: RefObject<HTMLElement | null>,
  { enabled = true, collapseAt, expandAt }: CollapseOnScrollOptions = {},
): boolean {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) {
      setCollapsed(false);
      return;
    }
    const read = () =>
      setCollapsed((was) =>
        nextCollapsed(was, el.scrollTop, { collapseAt, expandAt }),
      );
    read();
    el.addEventListener("scroll", read, { passive: true });
    return () => el.removeEventListener("scroll", read);
  }, [ref, enabled, collapseAt, expandAt]);

  return collapsed;
}
