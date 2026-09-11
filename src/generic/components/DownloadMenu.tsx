// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useRef, useState, type ReactNode } from "react";

import type { FloatingPlacement } from "@niclaslindstedt/oss-framework/components";
// `ActionMenuList` is a published subpath of its own — the framework's barrel
// re-exports only its `RowAction` type, not the list itself.
import {
  ActionMenuList,
  type RowAction,
} from "@niclaslindstedt/oss-framework/components/ActionMenuList";

import { GlyphButton } from "./GlyphButton.tsx";
import { SafeFloatingPanel } from "./SafeFloatingPanel.tsx";

// A download button that offers a choice of formats: one glyph in a row of
// header controls, opening a menu of the ways the thing beside it can leave
// the app. One format needs no menu — the button just does it — so the caller
// passes the formats it has and this decides which of the two it is.
//
// The menu itself is the framework's (`ActionMenuList` inside a
// `SafeFloatingPanel`), so it keeps the keyboard navigation, the dismissal and
// the safe-area placement every other floating menu in the app has.

export type DownloadFormat = {
  /** Stable id, for the key and for the caller's own bookkeeping. */
  id: string;
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
};

export type DownloadMenuLabels = {
  /** The button's accessible name and its label once there is room. */
  download: string;
  /** The menu's accessible name. */
  menu: string;
};

const PLACEMENT: FloatingPlacement = {
  width: { kind: "min", minPx: 176 },
  anchor: "right",
  coordinateSpace: "viewport",
};

export function DownloadMenu({
  formats,
  labels,
  icon,
  disabled,
}: {
  formats: readonly DownloadFormat[];
  labels: DownloadMenuLabels;
  /** The trigger's glyph, sized by the caller. */
  icon: ReactNode;
  disabled?: boolean;
}) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);

  const actions: RowAction[] = formats.map((format) => ({
    label: format.label,
    icon: format.icon,
    onSelect: format.onSelect,
  }));

  const press = () => {
    if (formats.length === 1) {
      formats[0]!.onSelect();
      return;
    }
    setOpen((was) => !was);
  };

  if (formats.length === 0) return null;

  return (
    <span ref={triggerRef} className="inline-flex">
      <GlyphButton
        icon={icon}
        label={labels.download}
        onClick={press}
        disabled={disabled}
      />
      <SafeFloatingPanel
        open={open}
        onClose={() => setOpen(false)}
        triggerRef={triggerRef}
        placement={PLACEMENT}
      >
        <ActionMenuList
          actions={actions}
          ariaLabel={labels.menu}
          onActivate={(action) => {
            setOpen(false);
            action.onSelect();
          }}
        />
      </SafeFloatingPanel>
    </span>
  );
}
