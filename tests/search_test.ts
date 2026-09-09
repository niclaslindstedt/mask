import { describe, expect, it } from "vitest";

import { runSearch } from "../src/app/search.ts";
import type { AppData } from "../src/app/types.ts";

const data: AppData = {
  activeProjectId: "p1",
  projects: [
    {
      id: "p1",
      name: "Bygglov Storstad",
      createdAt: "",
      documents: [
        {
          id: "d1",
          name: "brev.txt",
          text: "Anna Svensson bor på Storgatan.",
          source: "paste",
          format: "text",
          addedAt: "",
        },
      ],
      variables: [
        {
          id: "v1",
          token: "NAME1",
          value: "Anna Svensson",
          kind: "name",
          createdAt: "",
        },
      ],
      activeDocumentId: "d1",
      ignored: [],
    },
  ],
};

describe("runSearch", () => {
  it("finds projects, documents, and placeholders", () => {
    const { results } = runSearch(data, "anna");
    expect(results.map((r) => r.kind)).toEqual(["document", "variable"]);
    expect(results[0]).toMatchObject({ projectId: "p1", docId: "d1" });
    expect(runSearch(data, "storstad").results[0]?.kind).toBe("project");
  });

  it("reports an invalid regex and ignores a blank query", () => {
    expect(runSearch(data, "/(/").invalidRegex).toBe(true);
    expect(runSearch(data, "  ").results).toEqual([]);
  });
});
