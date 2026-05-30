import { addRegistry, loadRegistryManifest, resolveRegistryUrl, StudyTutorError } from "@study-tutor/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatRegistryList, runRegistryAddCommand, runRegistryListCommand } from "../commands/registry.js";

vi.mock("@study-tutor/core", () => ({
  addRegistry: vi.fn(),
  loadRegistryManifest: vi.fn(),
  resolveRegistryUrl: vi.fn(),
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

  it("loads the registry from a saved registry name", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.mocked(resolveRegistryUrl).mockResolvedValue("https://github.com/me/study-tutor-marketplace.git");
    vi.mocked(loadRegistryManifest).mockResolvedValue({ packs: [] });

    await runRegistryListCommand({ registry: "official" });

    expect(resolveRegistryUrl).toHaveBeenCalledWith({ name: "official" });
    expect(loadRegistryManifest).toHaveBeenCalledWith({
      url: "https://github.com/me/study-tutor-marketplace.git"
    });
  });

  it("fails when registry and url are both provided", async () => {
    await expect(
      runRegistryListCommand({
        registry: "official",
        url: "https://github.com/ksh9891/study-tutor-marketplace.git"
      })
    ).rejects.toThrow("Use either --registry or --url, not both");
  });

  it("fails when neither registry nor url is provided", async () => {
    await expect(runRegistryListCommand({})).rejects.toThrow(
      "Missing required option: --registry <name> or --url <git-repo-url>"
    );
  });

  it("fails when url is blank", async () => {
    await expect(runRegistryListCommand({ url: "   " })).rejects.toThrow(
      "Missing required option: --registry <name> or --url <git-repo-url>"
    );
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

describe("runRegistryAddCommand", () => {
  it("saves a named registry and prints the saved registry details", async () => {
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((message?: unknown) => {
      logs.push(String(message ?? ""));
    });
    vi.mocked(addRegistry).mockResolvedValue({
      registries: {
        official: {
          url: "https://github.com/me/study-tutor-marketplace.git"
        }
      }
    });

    await runRegistryAddCommand("official", " https://github.com/me/study-tutor-marketplace.git ");

    expect(addRegistry).toHaveBeenCalledWith({
      name: "official",
      url: "https://github.com/me/study-tutor-marketplace.git"
    });
    expect(logs.join("\n")).toContain("Registry added: official");
    expect(logs.join("\n")).toContain("URL: https://github.com/me/study-tutor-marketplace.git");
  });
});
