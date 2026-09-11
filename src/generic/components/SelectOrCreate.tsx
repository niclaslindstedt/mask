// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useEffect, useRef, useState } from "react";

import {
  CheckIcon,
  CloseIcon,
  SelectPicker,
  type SelectOption,
} from "@niclaslindstedt/oss-framework/components";

import {
  PLAIN_TEXT_KEYBOARD_PROPS,
  primeSoftKeyboard,
} from "../softKeyboard.ts";

// A `SelectPicker` whose last entry is "something else…": choosing it swaps the
// trigger for a text field, and what the user types becomes the value — a
// one-off option that never had to be defined anywhere first. Escape (or the
// cancel button) puts the previous value back; Enter, the tick, and blurring
// the field all commit.
//
// The value is a plain string either way, so a caller that stores free text
// needs no second code path for "one the user made up".

/** The option value that opens the field. A NUL is used so no typed value can
 *  ever collide with it. */
export const CREATE_OPTION = "\u0000create";

export type SelectOrCreateLabels = {
  /** The entry that opens the field ("Something else…"). */
  create: string;
  /** Placeholder for the field. */
  createPlaceholder: string;
  /** Accessible label for the field. */
  createLabel: string;
  confirm: string;
  cancel: string;
};

type Props = {
  value: string;
  options: SelectOption<string>[];
  onChange: (next: string) => void;
  labels: SelectOrCreateLabels;
  ariaLabel?: string;
  /** Reject a typed value (a duplicate, a reserved word): the tick is
   *  disabled and Enter does nothing while this returns false. */
  accept?: (value: string) => boolean;
  /** Applied to the typed value before it is committed. */
  normalize?: (value: string) => string;
  className?: string;
  triggerClassName?: string;
  inputClassName?: string;
};

const DEFAULT_INPUT_CLASS =
  "min-w-0 flex-1 rounded-md border border-line bg-surface px-2 py-1 text-sm text-fg-bright placeholder:text-muted focus:border-accent focus:outline-none";

export function SelectOrCreate({
  value,
  options,
  onChange,
  labels,
  ariaLabel,
  accept,
  normalize,
  className,
  triggerClassName,
  inputClassName,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const clean = normalize ? normalize(draft) : draft.trim();
  const usable = clean.length > 0 && (accept ? accept(clean) : true);

  function commit() {
    setEditing(false);
    setDraft("");
    if (usable) onChange(clean);
  }

  function cancel() {
    setEditing(false);
    setDraft("");
  }

  if (editing) {
    return (
      <span className={className ?? "flex items-center gap-1"}>
        <input
          ref={inputRef}
          type="text"
          value={draft}
          placeholder={labels.createPlaceholder}
          aria-label={labels.createLabel}
          autoCapitalize="characters"
          {...PLAIN_TEXT_KEYBOARD_PROPS}
          onInput={(e) => setDraft(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (usable) commit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          // Blur commits what is usable and drops what isn't, so tapping
          // elsewhere on a phone never strands a half-typed value.
          onBlur={() => (usable ? commit() : cancel())}
          className={inputClassName ?? DEFAULT_INPUT_CLASS}
        />
        <button
          type="button"
          aria-label={labels.confirm}
          disabled={!usable}
          // The button is pressed before the field's blur lands, so commit on
          // pointer-down rather than click.
          onMouseDown={(e) => {
            e.preventDefault();
            commit();
          }}
          className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          <CheckIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label={labels.cancel}
          onMouseDown={(e) => {
            e.preventDefault();
            cancel();
          }}
          className="inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-danger"
        >
          <CloseIcon className="h-4 w-4" />
        </button>
      </span>
    );
  }

  return (
    <SelectPicker<string>
      value={value}
      options={[...options, { value: CREATE_OPTION, label: labels.create }]}
      onChange={(next) => {
        if (next === CREATE_OPTION) {
          // The field mounts an effect later — prime the keyboard while the
          // tap that asked for it is still live.
          primeSoftKeyboard();
          setEditing(true);
        } else {
          onChange(next);
        }
      }}
      ariaLabel={ariaLabel}
      triggerClassName={triggerClassName}
    />
  );
}
