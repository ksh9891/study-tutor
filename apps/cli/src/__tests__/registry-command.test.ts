import { loadRegistryManifest, StudyTutorError } from "@study-tutor/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatRegistryList, runRegistryListCommand } from "../commands/registry.js";

vi.mock("@study-tutor/core", () => ({
  loadRegistryManifest: vi.fn(),
  StudyTutorError: class StudyTutorError extends Error {
    constructor(
      message: string,
      public readonly details: string[] = []
    ) {
      super(message);
      this.name = "StudyTutorError";
    }
  }
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("formatRegistryList", () => {
  it("formats registry packs for terminal output", () => {
    const output = formatRegistryList({
      packs: [
        {
          id: "jpa-tutor-pack",
          name: "JPA Tutor Pack",
          description: "Mini Hibernate를 구현하며 JPA를 배우는 pack",
          repo: "https://github.com/ksh9891/jpa-tutor-pack.git",
          defaultRef: "main",
          tags: ["java", "jpa", "backend"]
        }
      ]
    });

    expect(output).toContain("Available packs");
    expect(output).toContain("jpa-tutor-pack");
    expect(output).toContain("JPA Tutor Pack");
    expect(output).toContain("Mini Hibernate를 구현하며 JPA를 배우는 pack");
    expect(output).toContain("repo: https://github.com/ksh9891/jpa-tutor-pack.git");
    expect(output).toContain("ref: main");
    expect(output).toContain("tags: java, jpa, backend");
  });

  it("formats an empty registry", () => {
    const output = formatRegistryList({ packs: [] });

    expect(output).toBe("No packs found in registry.");
  });
});

describe("runRegistryListCommand", () => {
  it("loads the registry from the provided url and prints the formatted output", async () => {
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((message?: unknown) => {
      logs.push(String(message ?? ""));
    });
    vi.mocked(loadRegistryManifest).mockResolvedValue({
      packs: [
        {
          id: "jpa-tutor-pack",
          name: "JPA Tutor Pack",
          description: "Mini Hibernate를 구현하며 JPA를 배우는 pack",
          repo: "https://github.com/ksh9891/jpa-tutor-pack.git",
          defaultRef: "main",
          tags: ["java", "jpa"]
        }
      ]
    });

    await runRegistryListCommand({
      url: " https://github.com/ksh9891/study-tutor-marketplace.git "
    });

    expect(loadRegistryManifest).toHaveBeenCalledWith({
      url: "https://github.com/ksh9891/study-tutor-marketplace.git"
    });
    expect(logs.join("\n")).toContain("jpa-tutor-pack");
    expect(logs.join("\n")).toContain("tags: java, jpa");
  });

  it("fails when url is missing", async () => {
    await expect(runRegistryListCommand({})).rejects.toThrow("Missing required option: --url <git-repo-url>");
  });

  it("fails when url is blank", async () => {
    await expect(runRegistryListCommand({ url: "   " })).rejects.toThrow("Missing required option: --url <git-repo-url>");
  });

  it("includes clone failure details in the rejected message", async () => {
    vi.mocked(loadRegistryManifest).mockRejectedValue(
      new StudyTutorError("Failed to clone registry", ["fatal: repository not found"])
    );

    await expect(runRegistryListCommand({ url: "https://example.invalid/registry.git" })).rejects.toThrow(
      /Failed to clone registry[\s\S]*fatal: repository not found/
    );
  });

  it("includes invalid packs.yaml details in the rejected message", async () => {
    vi.mocked(loadRegistryManifest).mockRejectedValue(
      new StudyTutorError("Invalid packs.yaml", ["packs.0.id: must match /^[a-z0-9][a-z0-9-]*$/"])
    );

    await expect(runRegistryListCommand({ url: "https://example.invalid/registry.git" })).rejects.toThrow(
      /Invalid packs.yaml[\s\S]*packs\.0\.id/
    );
  });
});
