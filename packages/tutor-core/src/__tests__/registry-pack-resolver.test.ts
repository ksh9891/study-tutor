import { mkdir, mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execa } from "execa";
import { describe, expect, it, vi } from "vitest";
import {
  checkoutPackRepositoryWithGit,
  clonePackRepositoryWithGit,
  resolveRegistryPack
} from "../registry/pack-resolver.js";
import type {
  CheckoutPackRepository,
  ClonePackRepository
} from "../registry/pack-resolver.js";

vi.mock("execa", () => ({
  execa: vi.fn()
}));

async function createTempRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "study-tutor-registry-pack-test-root-"));
}

async function writeMinimalPack(destination: string): Promise<void> {
  await mkdir(join(destination, "steps", "intro"), { recursive: true });
  await writeFile(join(destination, "pack.yaml"), [
    "id: jpa-tutor-pack",
    "name: JPA Tutor Pack",
    "version: 1.0.0",
    "language: java",
    "runtime:",
    "  java: \"21\"",
    "  buildTool: gradle",
    "initialStep: intro"
  ].join("\n"));
  await writeFile(join(destination, "curriculum.yaml"), [
    "courses:",
    "  - id: basics",
    "    title: Basics",
    "    status: active",
    "    steps:",
    "      - intro"
  ].join("\n"));
  await writeFile(join(destination, "steps", "intro", "step.yaml"), [
    "id: intro",
    "order: 1",
    "title: Intro"
  ].join("\n"));
  await writeFile(join(destination, "steps", "intro", "tck.yaml"), "edgeCases: {}\n");
}

describe("resolveRegistryPack", () => {
  it("loads a pack from the registry manifest and returns registry source metadata", async () => {
    const tempRoot = await createTempRoot();
    const clone = vi.fn<ClonePackRepository>(async ({ destination }) => {
      await writeMinimalPack(destination);
    });
    const checkout = vi.fn<CheckoutPackRepository>(async () => {});

    const result = await resolveRegistryPack({
      registryUrl: "https://github.com/ksh9891/study-tutor-marketplace.git",
      packId: "jpa-tutor-pack",
      tempRoot,
      clone,
      checkout,
      loadRegistryManifest: async () => ({
        packs: [
          {
            id: "jpa-tutor-pack",
            name: "JPA Tutor Pack",
            description: "Learn JPA",
            repo: "https://github.com/ksh9891/jpa-tutor-pack.git",
            defaultRef: "main",
            tags: ["java"]
          }
        ]
      })
    });

    expect(result.pack.metadata.id).toBe("jpa-tutor-pack");
    expect(result.pack.root).toBe(result.packRoot);
    expect(result.source).toEqual({
      type: "registry",
      registryUrl: "https://github.com/ksh9891/study-tutor-marketplace.git",
      packRepo: "https://github.com/ksh9891/jpa-tutor-pack.git",
      ref: "main",
      localSnapshot: ".tutor/pack"
    });
    expect(clone).toHaveBeenCalledWith({
      url: "https://github.com/ksh9891/jpa-tutor-pack.git",
      destination: result.packRoot
    });
    expect(checkout).toHaveBeenCalledWith({
      repositoryRoot: result.packRoot,
      ref: "main"
    });

    await result.cleanup();
    await expect(readdir(tempRoot)).resolves.toEqual([]);
  });

  it("fails when the requested pack id is missing", async () => {
    const tempRoot = await createTempRoot();

    await expect(resolveRegistryPack({
      registryUrl: "https://github.com/ksh9891/study-tutor-marketplace.git",
      packId: "missing-pack",
      tempRoot,
      loadRegistryManifest: async () => ({ packs: [] })
    })).rejects.toMatchObject({
      message: "Pack missing-pack was not found in registry",
      details: ["https://github.com/ksh9891/study-tutor-marketplace.git"]
    });
    await expect(readdir(tempRoot)).resolves.toEqual([]);
  });

  it("wraps checkout failures and cleans the temporary pack root", async () => {
    const tempRoot = await createTempRoot();
    const clone: ClonePackRepository = async ({ destination }) => {
      await writeMinimalPack(destination);
    };

    await expect(resolveRegistryPack({
      registryUrl: "https://github.com/ksh9891/study-tutor-marketplace.git",
      packId: "jpa-tutor-pack",
      tempRoot,
      clone,
      checkout: async () => {
        throw new Error("pathspec bad-ref did not match");
      },
      loadRegistryManifest: async () => ({
        packs: [
          {
            id: "jpa-tutor-pack",
            name: "JPA Tutor Pack",
            description: "Learn JPA",
            repo: "https://github.com/ksh9891/jpa-tutor-pack.git",
            defaultRef: "bad-ref",
            tags: []
          }
        ]
      })
    })).rejects.toMatchObject({
      message: "Failed to checkout pack ref",
      details: ["pathspec bad-ref did not match"]
    });
    await expect(readdir(tempRoot)).resolves.toEqual([]);
  });

  it("passes an argv terminator before the pack repository URL when cloning with git", async () => {
    vi.mocked(execa).mockResolvedValueOnce({} as Awaited<ReturnType<typeof execa>>);

    await clonePackRepositoryWithGit({
      url: "-malformed-url",
      destination: "/tmp/study-tutor-pack-test"
    });

    expect(execa).toHaveBeenCalledWith("git", [
      "clone",
      "--depth",
      "1",
      "--",
      "-malformed-url",
      "/tmp/study-tutor-pack-test"
    ], {
      all: true
    });
  });

  it("wraps git checkout failures with command output", async () => {
    vi.mocked(execa).mockRejectedValueOnce({
      all: "pathspec bad-ref did not match"
    });

    await expect(checkoutPackRepositoryWithGit({
      repositoryRoot: "/tmp/study-tutor-pack-test",
      ref: "bad-ref"
    })).rejects.toMatchObject({
      message: "Failed to checkout pack ref",
      details: ["pathspec bad-ref did not match"]
    });
  });
});
