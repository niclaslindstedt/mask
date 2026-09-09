// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useState, type ReactNode } from "react";

import { CloseIcon, PlusIcon } from "@niclaslindstedt/oss-framework/components";

// Edit a flat list of strings: a field + Add button on top, one removable row
// per entry below. Enter adds; a blank or duplicate entry is ignored. What the
// strings *mean* is the caller's — it supplies the labels and, optionally, a
// row renderer for decorating each entry (a kind badge, a hint).

export type StringListEditorLabels = {
  placeholder: string;
  add: string;
  /** Accessible label for a row's remove button. */
  remove: (value: string) => string;
  empty: string;
};

type Props = {
  items: readonly string[];
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
  labels: StringListEditorLabels;
  /** Decorate an entry's row (the entry text is rendered by default). */
  renderItem?: (value: string) => ReactNode;
  /** Something rendered beside the input (a kind picker, say). */
  aside?: ReactNode;
  /** Normalise input before it's added (trim is always applied first). */
  normalize?: (value: string) => string;
};

export function StringListEditor({
  items,
  onAdd,
  onRemove,
  labels,
  renderItem,
  aside,
  normalize,
}: Props) {
  const [draft, setDraft] = useState("");

  function commit() {
    let value = draft.trim();
    if (normalize) value = normalize(value);
    if (!value || items.includes(value)) return;
    onAdd(value);
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-stretch gap-2">
        <input
          type="text"
          value={draft}
          placeholder={labels.placeholder}
          onInput={(e) => setDraft(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
          className="min-w-32 flex-1 rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-fg-bright placeholder:text-muted focus:border-accent focus:outline-none"
        />
        {aside && <span className="flex shrink-0 items-stretch">{aside}</span>}
        <button
          type="button"
          onClick={commit}
          disabled={!draft.trim()}
          className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-line px-3 py-1.5 text-sm text-fg hover:bg-surface-2 hover:text-fg-bright disabled:cursor-not-allowed disabled:opacity-50"
        >
          <PlusIcon className="h-4 w-4" />
          {labels.add}
        </button>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted">{labels.empty}</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-md border border-line">
          {items.map((value) => (
            <li
              key={value}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-fg"
            >
              <span className="min-w-0 flex-1 truncate">
                {renderItem ? renderItem(value) : value}
              </span>
              <button
                type="button"
                aria-label={labels.remove(value)}
                onClick={() => onRemove(value)}
                className="-mr-1 inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded text-muted hover:bg-surface-2 hover:text-danger"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
