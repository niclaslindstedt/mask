import { describe, expect, it } from "vitest";

import {
  folderDocFileName,
  planFolderSetup,
} from "../src/app/folderStorage.ts";
import { serializeDoc } from "../src/app/migrations.ts";
import { emptyDoc, type AppData, type Project } from "../src/app/types.ts";

function project(id: string, name = id): Project {
  return {
    id,
    name,
    createdAt: "2026-01-01T00:00:00.000Z",
    documents: [],
    variables: [],
    activeDocumentId: null,
    ignored: [],
  };
}

function docWith(...projects: Project[]): AppData {
  return { projects, activeProjectId: projects[0]?.id ?? null };
}

describe("folder document file names", () => {
  it("gives the default workspace the bare name", () => {
    expect(folderDocFileName("default")).toBe("mask.json");
  });

  it("suffixes every other workspace with its slug", () => {
    expect(folderDocFileName("socialtjansten")).toBe(
      "mask-socialtjansten.json",
    );
  });

  it("never lets a slug climb out of the picked folder", () => {
    expect(folderDocFileName("../../etc")).toBe("mask-------etc.json");
  });
});

describe("planning what an opened folder does", () => {
  const device = docWith(project("p1"));

  it("writes this device's document into an empty folder", () => {
    expect(planFolderSetup(null, device, true)).toEqual({ action: "push" });
    expect(planFolderSetup("", device, true)).toEqual({ action: "push" });
  });

  it("writes this device's document over a folder with no projects", () => {
    expect(planFolderSetup(serializeDoc(emptyDoc()), device, true)).toEqual({
      action: "push",
    });
  });

  it("adopts the folder's document when this device has nothing", () => {
    const folder = docWith(project("p2"));
    expect(planFolderSetup(serializeDoc(folder), emptyDoc(), true)).toEqual({
      action: "adopt",
      data: folder,
    });
  });

  it("adopts silently when both sides already carry the same projects", () => {
    // The open project is a per-device pointer, so it must not raise a
    // question on its own.
    const folder = { ...device, activeProjectId: null };
    expect(planFolderSetup(serializeDoc(folder), device, true)).toEqual({
      action: "adopt",
      data: folder,
    });
  });

  it("asks when a fresh connect finds projects on both sides", () => {
    const folder = docWith(project("p2"));
    expect(planFolderSetup(serializeDoc(folder), device, true)).toEqual({
      action: "ask",
      data: folder,
    });
  });

  it("lets the folder win on a later start — it is the storage", () => {
    const folder = docWith(project("p2"));
    expect(planFolderSetup(serializeDoc(folder), device, false)).toEqual({
      action: "adopt",
      data: folder,
    });
  });

  it("refuses to touch a file it cannot parse", () => {
    expect(planFolderSetup("{ not json", device, true)).toEqual({
      action: "unreadable",
    });
    expect(planFolderSetup("{ not json", device, false)).toEqual({
      action: "unreadable",
    });
  });
});
