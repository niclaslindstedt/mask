// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import { createTestDataBackend } from "../src/app/dev/seedBackend.ts";
import { buildTestData } from "../src/app/dev/testData.ts";
import { unmaskText } from "../src/app/masking.ts";
import { emptyDoc } from "../src/app/types.ts";

describe("developer test data", () => {
  const data = buildTestData();

  it("opens on a project with documents", () => {
    expect(data.projects.length).toBeGreaterThan(1);
    expect(data.activeProjectId).toBe(data.projects[0].id);
    for (const p of data.projects) {
      expect(p.documents.length).toBeGreaterThan(0);
      expect(p.documents.some((d) => d.id === p.activeDocumentId)).toBe(true);
      expect(p.documents.every((d) => d.text.trim().length > 0)).toBe(true);
    }
  });

  it("mints one distinct placeholder per value", () => {
    for (const p of data.projects) {
      const tokens = p.variables.map((v) => v.token);
      const values = p.variables.map((v) => v.value);
      expect(new Set(tokens).size).toBe(tokens.length);
      expect(new Set(values).size).toBe(values.length);
    }
  });

  it("ships a confirmed document whose masked text restores", () => {
    const project = data.projects.find((p) =>
      p.documents.some((d) => d.masked),
    );
    expect(project).toBeDefined();
    const doc = project!.documents.find((d) => d.masked)!;
    expect(doc.confirmedAt).toBeTruthy();
    for (const v of project!.variables) {
      expect(doc.text).toContain(v.value);
      expect(doc.masked).toContain(v.token);
      expect(doc.masked).not.toContain(v.value);
    }
    expect(unmaskText(doc.masked!, project!.variables)).toBe(doc.text);
  });

  it("keeps edits in memory, one document per namespace", () => {
    const backend = createTestDataBackend();
    expect(backend.id).toBe("dev");
    const first = backend.load("work");
    expect(first.readable).toBe(true);
    expect(backend.load("work").data).toBe(first.data);
    expect(backend.load("other").data).not.toBe(first.data);

    backend.save("work", emptyDoc());
    expect(backend.load("work").data.projects).toEqual([]);
    // The other namespace, and a fresh backend, are untouched.
    expect(backend.load("other").data.projects.length).toBeGreaterThan(0);
    expect(createTestDataBackend().load("work").data.projects.length).toBe(
      data.projects.length,
    );
  });
});
