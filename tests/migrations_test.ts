import { describe, expect, it } from "vitest";

import {
  LATEST_VERSION,
  parseDoc,
  serializeDoc,
} from "../src/app/migrations.ts";
import { emptyDoc } from "../src/app/types.ts";

describe("document migrations", () => {
  it("round-trips the current shape with a version stamp", () => {
    const doc = emptyDoc();
    const raw = serializeDoc(doc);
    expect(JSON.parse(raw).version).toBe(LATEST_VERSION);
    expect(parseDoc(raw)).toEqual(doc);
  });

  it("lifts an unversioned document and fills missing project fields", () => {
    const parsed = parseDoc(
      JSON.stringify({
        projects: [{ id: "p1", name: "Old", createdAt: "x" }],
      }),
    );
    expect(parsed.activeProjectId).toBeNull();
    expect(parsed.projects[0]).toEqual({
      id: "p1",
      name: "Old",
      createdAt: "x",
      documents: [],
      variables: [],
      ignored: [],
      activeDocumentId: null,
    });
  });

  it("refuses a document from a newer build", () => {
    expect(() =>
      parseDoc(JSON.stringify({ version: LATEST_VERSION + 1, projects: [] })),
    ).toThrow();
  });
});
