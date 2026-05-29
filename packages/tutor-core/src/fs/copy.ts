import { constants } from "node:fs";
import { copyFile, lstat, mkdir, readdir, rmdir, rm } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { StudyTutorError } from "../errors.js";

type PathKind = "directory" | "file" | "symlink";

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

function symlinkError(paths: string[]): StudyTutorError {
  return new StudyTutorError("Refusing to copy symlinks", [...paths].sort());
}

function overwriteError(paths: string[]): StudyTutorError {
  return new StudyTutorError("Refusing to overwrite existing files", [...paths].sort());
}

async function pathKind(path: string): Promise<PathKind | undefined> {
  try {
    const pathStat = await lstat(path);
    if (pathStat.isSymbolicLink()) {
      return "symlink";
    }
    return pathStat.isDirectory() ? "directory" : "file";
  } catch (error) {
    const code = errorCode(error);
    if (code === "ENOENT" || code === "ENOTDIR") {
      return undefined;
    }
    throw error;
  }
}

async function listFiles(root: string): Promise<string[]> {
  const rootKind = await pathKind(root);
  if (rootKind === "symlink") {
    throw symlinkError([root]);
  }

  const entries = (await readdir(root)).sort();
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(root, entry);
    const entryKind = await pathKind(fullPath);
    if (entryKind === "symlink") {
      throw symlinkError([fullPath]);
    }
    if (entryKind === "directory") {
      files.push(...await listFiles(fullPath));
    } else if (entryKind === "file") {
      files.push(fullPath);
    }
  }

  return files;
}

function targetFileFor(source: string, target: string, sourceFile: string): string {
  return join(target, relative(source, sourceFile));
}

function targetParentPaths(source: string, target: string, sourceFile: string): string[] {
  const relativeParent = dirname(relative(source, sourceFile));
  if (relativeParent === ".") {
    return [];
  }

  const paths: string[] = [];
  let currentPath = target;
  for (const part of relativeParent.split(sep)) {
    currentPath = join(currentPath, part);
    paths.push(currentPath);
  }
  return paths;
}

function targetDirectoryPaths(target: string, directory: string): string[] {
  const paths = [target];
  const relativeDirectory = relative(target, directory);
  if (relativeDirectory === "") {
    return paths;
  }

  let currentPath = target;
  for (const part of relativeDirectory.split(sep)) {
    currentPath = join(currentPath, part);
    paths.push(currentPath);
  }
  return paths;
}

function addDirectoryConflict(
  path: string,
  kind: PathKind | undefined,
  conflicts: Set<string>,
  symlinks: Set<string>
): void {
  if (kind === "symlink") {
    symlinks.add(path);
  } else if (kind !== undefined && kind !== "directory") {
    conflicts.add(path);
  }
}

function addFileConflict(
  path: string,
  kind: PathKind | undefined,
  conflicts: Set<string>,
  symlinks: Set<string>
): void {
  if (kind === "symlink") {
    symlinks.add(path);
  } else if (kind !== undefined) {
    conflicts.add(path);
  }
}

async function ensureTargetDirectory(target: string, directory: string, createdDirectories: string[]): Promise<void> {
  for (const directoryPath of targetDirectoryPaths(target, directory)) {
    const directoryKind = await pathKind(directoryPath);
    if (directoryKind === undefined) {
      await mkdir(directoryPath);
      createdDirectories.push(directoryPath);
    } else if (directoryKind === "symlink") {
      throw symlinkError([directoryPath]);
    } else if (directoryKind !== "directory") {
      throw overwriteError([directoryPath]);
    }
  }
}

async function rollbackCreatedPaths(createdFiles: string[], createdDirectories: string[]): Promise<void> {
  for (const file of [...createdFiles].reverse()) {
    await rm(file, { force: true });
  }

  for (const directory of [...createdDirectories].reverse()) {
    try {
      await rmdir(directory);
    } catch (error) {
      const code = errorCode(error);
      if (code !== "ENOENT" && code !== "ENOTEMPTY") {
        throw error;
      }
    }
  }
}

export async function copyDirectoryWithoutOverwrite(source: string, target: string): Promise<void> {
  const sourceFiles = await listFiles(source);
  const conflicts = new Set<string>();
  const symlinks = new Set<string>();
  const targetKind = await pathKind(target);

  addDirectoryConflict(target, targetKind, conflicts, symlinks);

  for (const sourceFile of sourceFiles) {
    for (const parentPath of targetParentPaths(source, target, sourceFile)) {
      addDirectoryConflict(parentPath, await pathKind(parentPath), conflicts, symlinks);
    }

    const targetFile = targetFileFor(source, target, sourceFile);
    addFileConflict(targetFile, await pathKind(targetFile), conflicts, symlinks);
  }

  if (symlinks.size > 0) {
    throw symlinkError([...symlinks]);
  }

  if (conflicts.size > 0) {
    throw overwriteError([...conflicts]);
  }

  const createdFiles: string[] = [];
  const createdDirectories: string[] = [];

  try {
    for (const sourceFile of sourceFiles) {
      const targetFile = targetFileFor(source, target, sourceFile);
      await ensureTargetDirectory(target, dirname(targetFile), createdDirectories);
      await copyFile(sourceFile, targetFile, constants.COPYFILE_EXCL);
      createdFiles.push(targetFile);
    }
  } catch (error) {
    await rollbackCreatedPaths(createdFiles, createdDirectories);
    throw error;
  }
}
