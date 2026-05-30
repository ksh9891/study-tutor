import { access, mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import YAML from "yaml";
import { describe, expect, it } from "vitest";
import { resolveInstalledPackRoot } from "../pack/source-resolver.js";
import type { PackLock } from "../progress/progress-store.js";

async function writeLock(packLock: PackLock): Promise<string> {
  const projectRoot = await mkdtemp(join(tmpdir(), "study-tutor-pack-source-"));
  await mkdir(join(projectRoot, ".tutor"), { recursive: true });
  await writeFile(join(projectRoot, ".tutor", "pack.lock"), YAML.stringify(packLock));
  return projectRoot;
}

describe("resolveInstalledPackRoot", () => {
  it("returns bundled pack root for bundled source object", async () => {
    const projectRoot = await writeLock({
      pack: "jpa-tutor-pack",
      version: "0.1.0",
      course: "mini-hibernate",
      source: {
        type: "bundled",
        path: "packs/jpa-tutor-pack"
      }
    });

    const root = await resolveInstalledPackRoot(projectRoot, {
      bundledPackRoot: (packId) => `/bundled/${packId}`
    });

    expect(root).toBe("/bundled/jpa-tutor-pack");
  });

  it("treats legacy string source as bundled", async () => {
    const projectRoot = await writeLock({
      pack: "jpa-tutor-pack",
      version: "0.1.0",
      course: "mini-hibernate",
      source: "bundled:packs/jpa-tutor-pack"
    });

    const root = await resolveInstalledPackRoot(projectRoot, {
      bundledPackRoot: (packId) => `/bundled/${packId}`
    });

    expect(root).toBe("/bundled/jpa-tutor-pack");
  });

  it("returns .tutor/pack for registry source", async () => {
    const projectRoot = await writeLock({
      pack: "jpa-tutor-pack",
      version: "0.1.0",
      course: "mini-hibernate",
      source: {
        type: "registry",
        registryUrl: "https://github.com/me/marketplace.git",
        packRepo: "https://github.com/me/jpa-tutor-pack.git",
        ref: "main",
        localSnapshot: ".tutor/pack"
      }
    });
    await mkdir(join(projectRoot, ".tutor", "pack"), { recursive: true });

    const root = await resolveInstalledPackRoot(projectRoot, {
      bundledPackRoot: (packId) => `/bundled/${packId}`
    });

    expect(root).toBe(join(projectRoot, ".tutor", "pack"));
    await expect(access(root)).resolves.toBeUndefined();
  });

  it("fails when registry source snapshot is missing", async () => {
    const projectRoot = await writeLock({
      pack: "jpa-tutor-pack",
      version: "0.1.0",
      course: "mini-hibernate",
      source: {
        type: "registry",
        registryUrl: "https://github.com/me/marketplace.git",
        packRepo: "https://github.com/me/jpa-tutor-pack.git",
        ref: "main",
        localSnapshot: ".tutor/pack"
      }
    });

    await expect(resolveInstalledPackRoot(projectRoot, {
      bundledPackRoot: (packId) => `/bundled/${packId}`
    })).rejects.toMatchObject({
      name: "StudyTutorError",
      message: "Local registry pack snapshot is missing",
      details: [join(projectRoot, ".tutor", "pack")]
    });
  });

  it("rejects registry snapshot traversal outside the project root", async () => {
    const projectRoot = await writeLock({
      pack: "jpa-tutor-pack",
      version: "0.1.0",
      course: "mini-hibernate",
      source: {
        type: "registry",
        registryUrl: "https://github.com/me/marketplace.git",
        packRepo: "https://github.com/me/jpa-tutor-pack.git",
        ref: "main",
        localSnapshot: "../outside-pack"
      }
    });
    await mkdir(join(projectRoot, "..", "outside-pack"), { recursive: true });

    await expect(resolveInstalledPackRoot(projectRoot, {
      bundledPackRoot: (packId) => `/bundled/${packId}`
    })).rejects.toThrow("outside project root");
  });

  it("rejects registry snapshot symlinks outside the project root", async () => {
    const projectRoot = await writeLock({
      pack: "jpa-tutor-pack",
      version: "0.1.0",
      course: "mini-hibernate",
      source: {
        type: "registry",
        registryUrl: "https://github.com/me/marketplace.git",
        packRepo: "https://github.com/me/jpa-tutor-pack.git",
        ref: "main",
        localSnapshot: ".tutor/pack"
      }
    });
    const outside = await mkdtemp(join(tmpdir(), "study-tutor-outside-pack-"));
    await symlink(outside, join(projectRoot, ".tutor", "pack"));

    await expect(resolveInstalledPackRoot(projectRoot, {
      bundledPackRoot: (packId) => `/bundled/${packId}`
    })).rejects.toThrow("outside project root");
  });
});
