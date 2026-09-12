// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0

// The layout half of a select trigger's class.
//
// `SelectPicker`'s `triggerClassName` replaces the *whole* class the trigger
// would otherwise carry — its row layout included — so a caller that passes
// nothing but a look (a smaller size, a different border) leaves the trigger
// without `flex`, and its chevron drops onto a line of its own under the
// label. Compose the look on top of this instead, and the value and the
// chevron stay on one row however narrow the column gets.

/** Flex row, full width, chevron pinned beside the value. */
export const PICKER_TRIGGER_LAYOUT =
  "flex w-full cursor-pointer items-center gap-1.5";

/** A trigger class: the row layout above with `look` (colours, border,
 *  padding, type size) on top. */
export function pickerTrigger(look: string): string {
  return `${PICKER_TRIGGER_LAYOUT} ${look}`;
}
