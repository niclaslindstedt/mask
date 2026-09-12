// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// Augment lib.dom with the one slice of the File System Access API the local
// folder storage touches directly: the directory picker. Everything past the
// pick — the permission probe, the handle's IndexedDB round trip, and the
// reads and writes themselves — goes through the framework's folder helpers,
// which carry their own declarations.

declare global {
  interface DirectoryPickerOptions {
    /** Groups the picker's "last used" memory per call site. */
    id?: string;
    mode?: "read" | "readwrite";
  }

  interface Window {
    showDirectoryPicker?(
      options?: DirectoryPickerOptions,
    ): Promise<FileSystemDirectoryHandle>;
  }
}

export {};
