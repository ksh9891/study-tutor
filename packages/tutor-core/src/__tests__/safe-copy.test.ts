import { mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StudyTutorError } from "../errors.js";
import { copyDirectoryWithoutOverwrite } from "../fs/copy.js";

afterEach(() => {
  vi.doUnmock("node:fs/promises");
  vi.resetModules();
});

describe("copyDirectoryWithoutOverwrite", () => {
  it("copies nested files", async () => {
    const root = await mkdtemp(join(tmpdir(), "study-tutor-copy-"));
    const source = join(root, "source");
    const target = join(root, "target");
    await mkdir(join(source, "nested"), { recursive: true });
    await writeFile(join(source, "nested", "file.txt"), "hello");

    await copyDirectoryWithoutOverwrite(source, target);

    await expect(readFile(join(target, "nested", "file.txt"), "utf8")).resolves.toBe("hello");
  });

  it("fails before copying when a target file already exists", async () => {
    const root = await mkdtemp(join(tmpdir(), "study-tutor-copy-conflict-"));
    const source = join(root, "source");
    const target = join(root, "target");
    await mkdir(source, { recursive: true });
    await mkdir(target, { recursive: true });
    await writeFile(join(source, "file.txt"), "new");
    await writeFile(join(target, "file.txt"), "old");

    await expect(copyDirectoryWithoutOverwrite(source, target)).rejects.toThrow("Refusing to overwrite existing files");
    await expect(readFile(join(target, "file.txt"), "utf8")).resolves.toBe("old");
  });

  it("fails before copying when a target parent path already exists as a file", async () => {
    const root = await mkdtemp(join(tmpdir(), "study-tutor-copy-parent-conflict-"));
    const source = join(root, "source");
    const target = join(root, "target");
    await mkdir(join(source, "nested"), { recursive: true });
    await mkdir(target, { recursive: true });
    await writeFile(join(source, "sibling.txt"), "sibling");
    await writeFile(join(source, "nested", "file.txt"), "new");
    await writeFile(join(target, "nested"), "old");

    await expect(copyDirectoryWithoutOverwrite(source, target)).rejects.toMatchObject({
      name: "StudyTutorError",
      message: "Refusing to overwrite existing files",
      details: [join(target, "nested")]
    } satisfies Partial<StudyTutorError>);
    await expect(readFile(join(target, "sibling.txt"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(target, "nested"), "utf8")).resolves.toBe("old");
  });

  it("fails before copying when the target root already exists as a file", async () => {
    const root = await mkdtemp(join(tmpdir(), "study-tutor-copy-root-conflict-"));
    const source = join(root, "source");
    const target = join(root, "target");
    await mkdir(source, { recursive: true });
    await writeFile(join(source, "file.txt"), "new");
    await writeFile(target, "old");

    await expect(copyDirectoryWithoutOverwrite(source, target)).rejects.toMatchObject({
      name: "StudyTutorError",
      message: "Refusing to overwrite existing files",
      details: [target]
    } satisfies Partial<StudyTutorError>);
    await expect(readFile(target, "utf8")).resolves.toBe("old");
  });

  it("fails preflight before copying non-conflicting siblings", async () => {
    const root = await mkdtemp(join(tmpdir(), "study-tutor-copy-sibling-conflict-"));
    const source = join(root, "source");
    const target = join(root, "target");
    await mkdir(source, { recursive: true });
    await mkdir(target, { recursive: true });
    await writeFile(join(source, "sibling.txt"), "sibling");
    await writeFile(join(source, "conflict.txt"), "new");
    await writeFile(join(target, "conflict.txt"), "old");

    await expect(copyDirectoryWithoutOverwrite(source, target)).rejects.toMatchObject({
      name: "StudyTutorError",
      message: "Refusing to overwrite existing files",
      details: [join(target, "conflict.txt")]
    } satisfies Partial<StudyTutorError>);
    await expect(readFile(join(target, "sibling.txt"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(target, "conflict.txt"), "utf8")).resolves.toBe("old");
  });

  it("rejects source symlinks without following or copying them", async () => {
    const root = await mkdtemp(join(tmpdir(), "study-tutor-copy-source-symlink-"));
    const source = join(root, "source");
    const target = join(root, "target");
    const outsideFile = join(root, "outside.txt");
    await mkdir(source, { recursive: true });
    await writeFile(outsideFile, "secret");
    await symlink(outsideFile, join(source, "link.txt"));

    await expect(copyDirectoryWithoutOverwrite(source, target)).rejects.toMatchObject({
      name: "StudyTutorError",
      message: "Refusing to copy symlinks",
      details: [join(source, "link.txt")]
    } satisfies Partial<StudyTutorError>);
    await expect(readFile(join(target, "link.txt"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects target parent symlinks without writing outside the target", async () => {
    const root = await mkdtemp(join(tmpdir(), "study-tutor-copy-target-symlink-"));
    const source = join(root, "source");
    const target = join(root, "target");
    const outside = join(root, "outside");
    await mkdir(join(source, "nested"), { recursive: true });
    await mkdir(target, { recursive: true });
    await mkdir(outside, { recursive: true });
    await writeFile(join(source, "nested", "file.txt"), "new");
    await symlink(outside, join(target, "nested"), "dir");

    await expect(copyDirectoryWithoutOverwrite(source, target)).rejects.toMatchObject({
      name: "StudyTutorError",
      message: "Refusing to copy symlinks",
      details: [join(target, "nested")]
    } satisfies Partial<StudyTutorError>);
    await expect(readFile(join(outside, "file.txt"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rolls back created files and directories when a copy fails midway", async () => {
    const root = await mkdtemp(join(tmpdir(), "study-tutor-copy-rollback-"));
    const source = join(root, "source");
    const target = join(root, "target");
    await mkdir(source, { recursive: true });
    await writeFile(join(source, "a.txt"), "a");
    await writeFile(join(source, "b.txt"), "b");

    let copyAttempts = 0;
    vi.doMock("node:fs/promises", async (importOriginal) => {
      const actual = await importOriginal<typeof import("node:fs/promises")>();
      return {
        ...actual,
        copyFile: vi.fn(async (sourcePath: string, targetPath: string, mode?: number) => {
          copyAttempts += 1;
          if (copyAttempts === 2) {
            throw new Error("simulated copy failure");
          }
          await actual.copyFile(sourcePath, targetPath, mode);
        })
      };
    });
    const { copyDirectoryWithoutOverwrite: copyWithFailingSecondFile } = await import("../fs/copy.js");

    await expect(copyWithFailingSecondFile(source, target)).rejects.toThrow("simulated copy failure");
    expect(copyAttempts).toBe(2);
    await expect(readFile(join(target, "a.txt"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(join(target, "b.txt"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await expect(readFile(target, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });
});
