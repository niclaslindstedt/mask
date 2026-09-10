// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useRef } from "react";
import type { ReactNode, RefObject } from "react";
import { createPortal } from "react-dom";

import { DismissBackdrop } from "@niclaslindstedt/oss-framework/components";
import type { FloatingPlacement } from "@niclaslindstedt/oss-framework/components";
import { useEscapeKey } from "@niclaslindstedt/oss-framework/hooks";

import { useSafeFloatingPosition, type SafeRegion } from "../safeViewport.ts";

// The framework's `FloatingPanel`, positioned against the safe band rather than
// the raw visual viewport — see `safeViewport.ts`. Same markup, same dismiss
// and focus-restore behaviour, so it is a drop-in swap at the call sites.

export type SafeFloatingPanelProps = {
  open: boolean;
  onClose: () => void;
  triggerRef: RefObject<HTMLElement | null>;
  placement: FloatingPlacement;
  /** Override the reserved edges. Defaults to the device insets plus any
   *  `data-floating-edge="top"` chrome. */
  region?: SafeRegion;
  className?: string;
  children: ReactNode;
};

export function SafeFloatingPanel({
  open,
  onClose,
  triggerRef,
  placement,
  region,
  className = "",
  children,
}: SafeFloatingPanelProps) {
  const position = useSafeFloatingPosition(triggerRef, open, placement, region);
  useEscapeKey(open, onClose);

  // Hand focus back to the trigger when the panel closes without moving it.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      return;
    }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    const trigger = triggerRef.current;
    if (!trigger) return;
    if (document.activeElement === document.body) {
      trigger.focus({ preventScroll: true });
    }
  }, [open, triggerRef]);

  if (!open || !position) return null;

  const positionClass =
    placement.coordinateSpace === "viewport" ? "fixed" : "absolute";
  const flipUp = position.placement === "above";
  const maxWidth =
    placement.width.kind === "max" ? position.width : position.maxWidth;

  return createPortal(
    <>
      <DismissBackdrop onDismiss={onClose} />
      <div
        className={`${positionClass} z-[60] flex flex-col overflow-y-auto rounded-md border border-line bg-surface-2 shadow-lg focus-within:border-accent ${className}`.trim()}
        style={{
          top: position.top,
          left: position.left,
          minWidth: position.width,
          maxWidth,
          maxHeight: position.maxHeight,
          transform: flipUp ? "translateY(-100%)" : undefined,
        }}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}
