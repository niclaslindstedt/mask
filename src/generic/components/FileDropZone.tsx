// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { useRef, type ReactNode } from "react";

import { UploadIcon } from "@niclaslindstedt/oss-framework/components";
import { useFileDrop } from "@niclaslindstedt/oss-framework/hooks";

// A file intake surface: drop files onto it, or press it to browse. The
// framework's `useFileDrop` owns the drag mechanics (depth-counted enter /
// leave, `preventDefault`, the accepts gate); this component adds the visible
// target, the hidden `<input type="file">` a click opens, and the "drop now"
// highlight. Labels inject — the component has no vocabulary for what the
// files are.

export type FileDropZoneLabels = {
  /** Headline inside the zone ("Drop files here"). */
  title: string;
  /** Secondary line ("PDF or text, or press to browse"). */
  hint?: string;
  /** Shown while a file drag hovers the zone. */
  active: string;
};

type Props = {
  onFiles: (files: File[]) => void;
  /** The `accept` attribute of the hidden file input. */
  accept?: string;
  multiple?: boolean;
  labels: FileDropZoneLabels;
  /** Something extra to render under the hint (a "load sample" link, say). */
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
};

export function FileDropZone({
  onFiles,
  accept,
  multiple = true,
  labels,
  children,
  className = "",
  disabled = false,
}: Props) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { active } = useFileDrop({
    targetRef: zoneRef,
    claim: true,
    onDrop: (files) => {
      if (!disabled && files.length > 0) onFiles(files);
    },
  });

  const highlight = active
    ? "border-accent bg-accent/10 text-fg-bright"
    : "border-line bg-surface text-muted hover:border-accent/60 hover:text-fg";

  return (
    <div
      ref={zoneRef}
      className={`relative rounded-lg border-2 border-dashed transition-colors ${highlight} ${className}`.trim()}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="flex w-full cursor-pointer flex-col items-center gap-1 px-4 py-6 text-center disabled:cursor-not-allowed"
      >
        <UploadIcon className="h-6 w-6" />
        <span className="text-sm font-medium">
          {active ? labels.active : labels.title}
        </span>
        {labels.hint && !active && (
          <span className="text-xs text-muted">{labels.hint}</span>
        )}
      </button>
      {children && (
        <div className="flex justify-center px-4 pb-4 text-xs">{children}</div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const input = e.currentTarget;
          const files = Array.from(input.files ?? []);
          input.value = "";
          if (files.length > 0) onFiles(files);
        }}
      />
    </div>
  );
}
