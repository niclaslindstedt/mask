<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->

# `src/generic/` — framework candidates

Everything in this folder is written to the framework's rules — no app domain
names, no store, labels injected, zero runtime dependencies beyond what the
framework already peers — so it can be lifted into
[`@niclaslindstedt/oss-framework`](https://github.com/niclaslindstedt/oss-framework)
unchanged when a second app needs it. App code (`src/app/`) may import from
here; nothing here may import from `src/app/`.

| Module                                           | What it is                                                                                                                          |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| [`placeholders.ts`](placeholders.ts)             | Placeholder naming schemes (`AAA`, `aaa`, `$1`, `KIND1`, `[KIND 1]`, `{{kind1}}`) — format one, mint the next unused one.           |
| [`textScan.ts`](textScan.ts)                     | Regex + literal scanning over a text into typed spans, overlap resolution, and non-overlapping span substitution (both directions). |
| [`checkDigit.ts`](checkDigit.ts)                 | Luhn (mod 10) check-digit validation.                                                                                               |
| [`extractText/`](extractText)                    | File → plain text: text-like files read directly, PDFs through a lazily-loaded `pdfjs-dist` chunk and a geometry-driven reflow.     |
| [`safeViewport.ts`](safeViewport.ts)             | The band of the viewport a floating panel may land in — the visual viewport minus the safe-area insets and any pinned top chrome.   |
| [`softKeyboard.ts`](softKeyboard.ts)             | Open a touch device's keyboard for a field that mounts a tick later, plus the soft-keyboard hints a short text field wants.         |
| [`components/FileDropZone.tsx`](components)      | Drop target + browse button over the framework's `useFileDrop`.                                                                     |
| [`components/StringListEditor.tsx`](components)  | Add / remove a list of strings.                                                                                                     |
| [`components/SpanText.tsx`](components)          | Render a text with typed spans highlighted (and clickable).                                                                         |
| [`components/CopyablePane.tsx`](components)      | A read-only text pane with a copy button and a character count.                                                                     |
| [`components/SafeFloatingPanel.tsx`](components) | The framework's `FloatingPanel` measured against the safe band, so a panel never lands under the status bar or the app's top bar.   |
| [`components/SafeSelect.tsx`](components)        | The framework's `SelectPicker` over `SafeFloatingPanel` — same combobox behaviour, safe-area-aware menu placement.                  |
