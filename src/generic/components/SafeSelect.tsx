// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { KeyboardEvent, ReactNode } from "react";

import {
  CheckIcon,
  ChevronDownIcon,
} from "@niclaslindstedt/oss-framework/components";
import type {
  FloatingPlacement,
  SelectOption,
} from "@niclaslindstedt/oss-framework/components";
import {
  matchPrefixRange,
  useTypeahead,
} from "@niclaslindstedt/oss-framework/hooks";

import type { SafeRegion } from "../safeViewport.ts";
import { SafeFloatingPanel } from "./SafeFloatingPanel.tsx";

// The framework's `SelectPicker` over `SafeFloatingPanel`: same combobox and
// listbox behaviour (typeahead, roving highlight, Home/End, Escape), but the
// menu is placed inside the safe band instead of the raw viewport, so a menu
// that flips above its trigger stops at the app's top chrome rather than
// running under the status bar.

export type { SelectOption };

type Props<T extends string | number> = {
  value: T;
  options: SelectOption<T>[];
  onChange: (next: T) => void;
  placement?: Partial<FloatingPlacement>;
  region?: SafeRegion;
  triggerClassName?: string;
  panelClassName?: string;
  renderValue?: (option: SelectOption<T> | null) => ReactNode;
  ariaLabel?: string;
  typeahead?: boolean;
  disabled?: boolean;
};

// `viewport` (rather than the framework default of `document`) because the app
// shell never scrolls: the panel is fixed to the band it was measured against.
const DEFAULT_PLACEMENT: FloatingPlacement = {
  width: { kind: "min", minPx: 160 },
  anchor: "left",
  coordinateSpace: "viewport",
};

// The trigger lays its value and chevron out in a row, so the row classes are
// always applied — `triggerClassName` replaces the look, never the layout, or
// the chevron drops onto a line of its own beneath the label.
const TRIGGER_LAYOUT_CLASS = "flex cursor-pointer items-center gap-2 text-left";

const DEFAULT_TRIGGER_CLASS =
  "w-full rounded-md border border-line bg-surface-2 px-2.5 py-1.5 text-sm text-fg hover:border-accent focus-visible:border-accent focus-visible:outline-none";

function renderTypeaheadMatch(label: ReactNode, query: string): ReactNode {
  if (typeof label !== "string") return label;
  const range = matchPrefixRange(label, query);
  if (!range) return label;
  return (
    <>
      {label.slice(0, range.start)}
      <mark className="rounded-[2px] bg-accent/30 text-fg-bright [font-weight:inherit]">
        {label.slice(range.start, range.end)}
      </mark>
      {label.slice(range.end)}
    </>
  );
}

export function SafeSelect<T extends string | number>({
  value,
  options,
  onChange,
  placement,
  region,
  triggerClassName,
  panelClassName,
  renderValue,
  ariaLabel,
  typeahead = true,
  disabled,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const listboxId = useId();

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value],
  );
  const typeaheadLabels = useMemo(
    () =>
      options.map(
        (o) => o.typeaheadLabel ?? (typeof o.label === "string" ? o.label : ""),
      ),
    [options],
  );
  const typeaheadEnabled =
    typeahead && typeaheadLabels.some((l) => l.length > 0);

  useEffect(() => {
    if (!open) return;
    const idx = options.findIndex((o) => o.value === value);
    setHighlight(idx === -1 ? 0 : idx);
  }, [open, options, value]);

  const {
    onKeyDown: onTypeaheadKey,
    query: typeaheadQuery,
    reset: resetTypeahead,
  } = useTypeahead({
    labels: typeaheadLabels,
    onMatch: (i) => {
      if (!options[i]?.disabled) setHighlight(i);
    },
  });

  const close = useCallback(() => {
    setOpen(false);
    setHighlight(-1);
    resetTypeahead();
  }, [resetTypeahead]);

  useEffect(() => {
    if (!open || highlight < 0) return;
    optionRefs.current[highlight]?.scrollIntoView?.({ block: "nearest" });
  }, [open, highlight]);

  const commit = useCallback(
    (option: SelectOption<T>) => {
      if (option.disabled) return;
      onChange(option.value);
      close();
      triggerRef.current?.focus();
    },
    [onChange, close],
  );

  const moveHighlight = useCallback(
    (delta: number) => {
      if (options.length === 0) return;
      setHighlight((prev) => {
        let next = prev === -1 ? 0 : prev;
        for (let i = 0; i < options.length; i++) {
          next = (next + delta + options.length) % options.length;
          if (!options[next]?.disabled) return next;
        }
        return prev;
      });
    },
    [options],
  );

  function handleTriggerKey(e: KeyboardEvent<HTMLButtonElement>) {
    if (
      e.key === "ArrowDown" ||
      e.key === "ArrowUp" ||
      e.key === "Enter" ||
      e.key === " "
    ) {
      e.preventDefault();
      setOpen(true);
    }
  }

  function handleListKey(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      resetTypeahead();
      moveHighlight(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      resetTypeahead();
      moveHighlight(-1);
    } else if (e.key === "Home") {
      e.preventDefault();
      resetTypeahead();
      const i = options.findIndex((o) => !o.disabled);
      if (i !== -1) setHighlight(i);
    } else if (e.key === "End") {
      e.preventDefault();
      resetTypeahead();
      for (let i = options.length - 1; i >= 0; i--) {
        if (!options[i]?.disabled) {
          setHighlight(i);
          break;
        }
      }
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const option = options[highlight];
      if (option) commit(option);
    } else if (typeaheadEnabled) {
      onTypeaheadKey(e);
    }
  }

  const finalPlacement: FloatingPlacement = {
    ...DEFAULT_PLACEMENT,
    ...placement,
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={handleTriggerKey}
        className={`${TRIGGER_LAYOUT_CLASS} ${
          triggerClassName ?? DEFAULT_TRIGGER_CLASS
        } ${disabled ? "cursor-not-allowed opacity-60" : ""}`.trim()}
      >
        <span className="flex-1 truncate">
          {renderValue ? renderValue(selected) : (selected?.label ?? "")}
        </span>
        <ChevronDownIcon className="h-3.5 w-3.5 shrink-0 text-muted" />
      </button>

      <SafeFloatingPanel
        open={open && !disabled}
        onClose={close}
        triggerRef={triggerRef}
        placement={finalPlacement}
        region={region}
        className={`py-1 ${panelClassName ?? ""}`.trim()}
      >
        <div
          id={listboxId}
          role="listbox"
          tabIndex={-1}
          onKeyDown={handleListKey}
          ref={(el) => {
            if (el && open) el.focus();
          }}
          className="outline-none"
        >
          {options.map((option, i) => {
            const isSelected = option.value === value;
            const isHighlighted = i === highlight;
            return (
              <button
                key={String(option.value)}
                ref={(el) => {
                  optionRefs.current[i] = el;
                }}
                type="button"
                role="option"
                aria-selected={isSelected}
                aria-disabled={option.disabled || undefined}
                disabled={option.disabled}
                onMouseEnter={() => !option.disabled && setHighlight(i)}
                onClick={() => commit(option)}
                className={`flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent px-3 py-2 text-left text-sm text-fg ${
                  option.disabled
                    ? "cursor-not-allowed opacity-50"
                    : isHighlighted
                      ? "bg-surface-3 text-fg-bright"
                      : "hover:bg-surface-3"
                }`}
              >
                <span className="flex flex-1 flex-col gap-0.5 truncate">
                  <span className="truncate" style={option.labelStyle}>
                    {isHighlighted && typeaheadQuery
                      ? renderTypeaheadMatch(option.label, typeaheadQuery)
                      : option.label}
                  </span>
                  {option.hint && (
                    <span className="truncate text-xs text-muted">
                      {option.hint}
                    </span>
                  )}
                </span>
                {isSelected && (
                  <CheckIcon className="h-3.5 w-3.5 shrink-0 text-accent" />
                )}
              </button>
            );
          })}
        </div>
      </SafeFloatingPanel>
    </>
  );
}
