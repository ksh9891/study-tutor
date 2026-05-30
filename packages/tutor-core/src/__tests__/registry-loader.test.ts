import { mkdir, mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { StudyTutorError } from "../errors.js";
import { loadRegistryManifest } from "../registry/loader.js";
import type { CloneRegistry } from "../registry/loader.js";

async function createTempRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "study-tutor-registry-test-root-"));
}

function cloneWithManifest(source: string): CloneRegistry {
  return async ({ destination }) => {
    await mkdir(destination, { recursive: true });
    await writeFile(join(destination, "packs.yaml"), source);
  };
}

describe("loadRegistryManifest", () => {
  it("loads packs.yaml from a cloned registry", async () => {
    const tempRoot = await createTempRoot();

    const manifest = await loadRegistryManifest({
      url: "https://github.com/ksh9891/study-tutor-marketplace.git",
      tempRoot,
      clone: cloneWithManifest([
        "packs:",
        "  - id: jpa-tutor-pack",
        "    name: JPA Tutor Pack",
        "    description: Mini Hibernate를 구현하며 JPA를 배우는 pack",
        "    repo: https://github.com/ksh9891/jpa-tutor-pack.git",
        "    defaultRef: main",
        "    tags:",
        "      - java",
        "      - jpa",
        "      - backend"
      ].join("\n"))
    });

    expect(manifest.packs).toEqual([
      {
        id: "jpa-tutor-pack",
        name: "JPA Tutor Pack",
        description: "Mini Hibernate를 구현하며 JPA를 배우는 pack",
        repo: "https://github.com/ksh9891/jpa-tutor-pack.git",
        defaultRef: "main",
        tags: ["java", "jpa", "backend"]
      }
    ]);
    await expect(readdir(tempRoot)).resolves.toEqual([]);
  });

  it("returns an empty manifest when packs.yaml has no packs", async () => {
    const tempRoot = await createTempRoot();

    const manifest = await loadRegistryManifest({
      url: "https://github.com/ksh9891/study-tutor-marketplace.git",
      tempRoot,
      clone: cloneWithManifest("packs: []")
    });

    expect(manifest.packs).toEqual([]);
    await expect(readdir(tempRoot)).resolves.toEqual([]);
  });

  it("fails when packs.yaml is missing", async () => {
    const tempRoot = await createTempRoot();
    const clone: CloneRegistry = async ({ destination }) => {
      await mkdir(destination, { recursive: true });
    };

    await expect(loadRegistryManifest({
      url: "https://github.com/ksh9891/study-tutor-marketplace.git",
      tempRoot,
      clone
    })).rejects.toMatchObject({
      message: "Registry manifest packs.yaml not found"
    });
    await expect(readdir(tempRoot)).resolves.toEqual([]);
  });

  it("fails when packs.yaml has invalid yaml", async () => {
    const tempRoot = await createTempRoot();

    await expect(loadRegistryManifest({
      url: "https://github.com/ksh9891/study-tutor-marketplace.git",
      tempRoot,
      clone: cloneWithManifest("packs:\n  - id: [")
    })).rejects.toMatchObject({
      message: "Invalid registry manifest YAML"
    });
    await expect(readdir(tempRoot)).resolves.toEqual([]);
  });

  it("fails when packs.yaml does not match the schema", async () => {
    const tempRoot = await createTempRoot();

    await expect(loadRegistryManifest({
      url: "https://github.com/ksh9891/study-tutor-marketplace.git",
      tempRoot,
      clone: cloneWithManifest([
        "packs:",
        "  - id: ../escape",
        "    name: Bad Pack",
        "    description: Invalid pack id",
        "    repo: https://github.com/example/bad-pack.git",
        "    defaultRef: main",
        "    tags: []"
      ].join("\n"))
    })).rejects.toMatchObject({
      message: "Invalid packs.yaml",
      details: expect.arrayContaining([expect.stringContaining("packs.0.id")])
    });
    await expect(readdir(tempRoot)).resolves.toEqual([]);
  });

  it("wraps clone failures and cleans the temporary directory", async () => {
    const tempRoot = await createTempRoot();
    const clone = vi.fn<CloneRegistry>(async () => {
      throw new Error("network denied");
    });

    await expect(loadRegistryManifest({
      url: "https://github.com/ksh9891/study-tutor-marketplace.git",
      tempRoot,
      clone
    })).rejects.toMatchObject({
      message: "Failed to clone registry",
      details: ["network denied"]
    });
    expect(clone).toHaveBeenCalledOnce();
    await expect(readdir(tempRoot)).resolves.toEqual([]);
  });

  it("preserves StudyTutorError clone failures", async () => {
    const tempRoot = await createTempRoot();
    const clone: CloneRegistry = async () => {
      throw new StudyTutorError("Failed to clone registry", ["fatal: repository not found"]);
    };

    await expect(loadRegistryManifest({
      url: "https://github.com/ksh9891/missing-marketplace.git",
      tempRoot,
      clone
    })).rejects.toMatchObject({
      message: "Failed to clone registry",
      details: ["fatal: repository not found"]
    });
    await expect(readdir(tempRoot)).resolves.toEqual([]);
  });
});
