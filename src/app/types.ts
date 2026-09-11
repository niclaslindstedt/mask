// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import type { PlaceholderStyle } from "../generic/placeholders.ts";

// The app's data model. A namespace holds a document of *projects*; a project
// holds the source documents the user uploaded, the *variables* (a sensitive
// value → the placeholder that stands in for it) shared by every document in
// the project, and the values the user has told it to leave alone.
//
// The global rule sets — always mask / never mask / custom patterns — live
// outside the namespace document (`GlobalRules`) because they carry across
// every namespace and project.

/** The built-in kinds of sensitive value. Custom pattern rules may use any
 *  string as a kind; these are the ones the detectors and the UI know. */
export const ENTITY_KINDS = [
  "name",
  "street",
  "city",
  "postal",
  "phone",
  "pin",
  "email",
  "org",
  "custom",
] as const;
export type EntityKind = (typeof ENTITY_KINDS)[number];

export type Variable = {
  id: string;
  /** The placeholder that replaces the value in masked text. */
  token: string;
  /** The sensitive value, verbatim as first seen. */
  value: string;
  kind: string;
  createdAt: string;
};

export type Doc = {
  id: string;
  name: string;
  /** The extracted plain text. */
  text: string;
  source: "file" | "paste" | "sample";
  format: "text" | "pdf";
  /** Whether `text` is Markdown — the review renders it formatted rather than
   *  verbatim, and a download offers the PDF it can be typeset into. */
  markdown?: boolean;
  addedAt: string;
  pages?: number;
  /** The masked text as last confirmed, if the review was confirmed. */
  masked?: string;
  confirmedAt?: string;
};

export type Project = {
  id: string;
  name: string;
  createdAt: string;
  /** Placeholder style override; the app setting applies when absent. */
  style?: PlaceholderStyle;
  documents: Doc[];
  variables: Variable[];
  activeDocumentId: string | null;
  /** Values the user rejected during review — not suggested again here. */
  ignored: string[];
};

export type AppData = {
  activeProjectId: string | null;
  projects: Project[];
};

/** A value that should always be treated as sensitive, with its kind. */
export type ListEntry = { value: string; kind: string };

/** A user-defined regex detector. */
export type PatternRule = {
  id: string;
  label: string;
  /** The regex source (compiled with the `g` and `u` flags added). */
  pattern: string;
  /** Extra flags, e.g. `i`. */
  flags?: string;
  kind: string;
  enabled: boolean;
};

export type GlobalRules = {
  /** Always mask these values (a value that no detector would find). */
  always: ListEntry[];
  /** Never mask these values (a detector's false positive, a public name). */
  never: string[];
  patterns: PatternRule[];
};

export const EMPTY_RULES: GlobalRules = { always: [], never: [], patterns: [] };

export function emptyDoc(): AppData {
  return { activeProjectId: null, projects: [] };
}

export function activeProject(data: AppData): Project | null {
  return data.projects.find((p) => p.id === data.activeProjectId) ?? null;
}

export function activeDoc(project: Project | null): Doc | null {
  if (!project) return null;
  return (
    project.documents.find((d) => d.id === project.activeDocumentId) ?? null
  );
}
