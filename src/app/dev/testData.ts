// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The developer test-data document: a handful of fictional projects, each
// carrying the sample files from `examples/`, so a developer can open the app
// on something that looks lived-in — several projects, documents in both
// states, minted placeholders, a confirmed masked text for the Restore tab.
//
// Nothing here may reach a production user: this module (and the ~10 kB of
// sample text it inlines) is imported only from `seedBackend.ts`, which
// `useDevSeed` pulls in through a dynamic `import()` when the toggle turns on.
//
// The documents are the real files in `examples/` — the same fixtures the
// README points at — so the test data and the documented samples can't drift.

import caseNote from "../../../examples/sample-case-note.txt?raw";
import letter from "../../../examples/sample-letter.txt?raw";
import procurement from "../../../examples/sample-procurement-email.txt?raw";
import schoolLetter from "../../../examples/sample-school-letter.txt?raw";

import {
  mintPlaceholder,
  type PlaceholderStyle,
} from "../../generic/placeholders.ts";
import { maskText } from "../masking.ts";
import type { AppData, Doc, Project, Variable } from "../types.ts";

// Fixed timestamps and ids: the document is rebuilt on every toggle, and a
// stable shape keeps a reload comparable with the one before it.
const DAY = 86_400_000;
const EPOCH = Date.UTC(2026, 2, 2, 9, 0, 0);

function at(daysAgo: number): string {
  return new Date(EPOCH - daysAgo * DAY).toISOString();
}

type ValueSpec = { value: string; kind: string };

/** Mint a project's variables: each value gets the first free placeholder of
 *  the project's style, exactly as a confirmed review would have. */
function variables(
  prefix: string,
  style: PlaceholderStyle,
  values: readonly ValueSpec[],
): Variable[] {
  const taken = new Set<string>();
  return values.map((v, i) => {
    const token = mintPlaceholder(style, v.kind, taken);
    taken.add(token);
    return {
      id: `${prefix}-var-${i + 1}`,
      token,
      value: v.value,
      kind: v.kind,
      createdAt: at(10 - i),
    };
  });
}

type DocSpec = {
  name: string;
  text: string;
  addedAt: string;
  /** Confirm the review: the document carries the masked text as well. */
  confirmed?: boolean;
};

function documents(
  prefix: string,
  specs: readonly DocSpec[],
  vars: readonly Variable[],
): Doc[] {
  return specs.map((spec, i) => ({
    id: `${prefix}-doc-${i + 1}`,
    name: spec.name,
    text: spec.text,
    source: "sample" as const,
    format: "text" as const,
    addedAt: spec.addedAt,
    ...(spec.confirmed
      ? {
          masked: maskText(spec.text, vars),
          confirmedAt: spec.addedAt,
        }
      : {}),
  }));
}

function project(spec: {
  id: string;
  name: string;
  createdAt: string;
  style: PlaceholderStyle;
  values: readonly ValueSpec[];
  docs: readonly DocSpec[];
  activeDocIndex?: number;
  ignored?: readonly string[];
}): Project {
  const vars = variables(spec.id, spec.style, spec.values);
  const docs = documents(spec.id, spec.docs, vars);
  const active = docs[spec.activeDocIndex ?? 0];
  return {
    id: spec.id,
    name: spec.name,
    createdAt: spec.createdAt,
    style: spec.style,
    documents: docs,
    variables: vars,
    activeDocumentId: active?.id ?? null,
    ignored: [...(spec.ignored ?? [])],
  };
}

/** Build a fresh test-data document. Called once per namespace by the
 *  in-memory backend, so every workspace opens on its own populated copy. */
export function buildTestData(): AppData {
  const projects: Project[] = [
    project({
      id: "test-bygglov",
      name: "Bygglov Kvarnbacken 3",
      createdAt: at(12),
      style: "kindNumber",
      values: [
        { value: "Anna Svensson", kind: "name" },
        { value: "Erik Andersson", kind: "name" },
        { value: "Karin Andersson", kind: "name" },
        { value: "Lars-Erik Berg", kind: "name" },
        { value: "Fatima Hassan", kind: "name" },
        { value: "811218-9876", kind: "pin" },
        { value: "556012-5790", kind: "org" },
        { value: "Storgatan 12 B", kind: "street" },
        { value: "Kvarnvägen 7", kind: "street" },
        { value: "Storstad", kind: "city" },
        { value: "123 45", kind: "postal" },
        { value: "123 46", kind: "postal" },
        { value: "070-123 45 67", kind: "phone" },
        { value: "08-123 456 78", kind: "phone" },
        { value: "+46 70 987 65 43", kind: "phone" },
        { value: "anna.svensson@example.se", kind: "email" },
      ],
      docs: [
        {
          name: "sample-letter.txt",
          text: letter,
          addedAt: at(12),
          confirmed: true,
        },
      ],
    }),
    project({
      id: "test-skola",
      name: "Skolärende – anpassad studiegång",
      createdAt: at(5),
      style: "bracketKind",
      values: [
        { value: "Karin Lindqvist", kind: "name" },
        { value: "Nils Lindqvist", kind: "name" },
        { value: "Peter Lindqvist", kind: "name" },
        { value: "900203-4560", kind: "pin" },
        { value: "651208-7658", kind: "pin" },
      ],
      docs: [
        { name: "sample-case-note.txt", text: caseNote, addedAt: at(5) },
        {
          name: "sample-school-letter.txt",
          text: schoolLetter,
          addedAt: at(4),
        },
      ],
      activeDocIndex: 1,
      // A locality the city detector offers that this caseworker keeps.
      ignored: ["Uddevalla"],
    }),
    project({
      id: "test-upphandling",
      name: "Upphandling städtjänster",
      createdAt: at(1),
      style: "upperLetters",
      values: [],
      docs: [
        {
          name: "sample-procurement-email.txt",
          text: procurement,
          addedAt: at(1),
        },
      ],
    }),
  ];

  return { activeProjectId: projects[0].id, projects };
}
