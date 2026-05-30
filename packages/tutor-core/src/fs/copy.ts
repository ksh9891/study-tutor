import { constants } from "node:fs";
import { copyFile, lstat, mkdir, readdir, realpath, rmdir, rm } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { StudyTutorError } from "../errors.js";

type PathKind = "directory" | "file" | "symlink";

export interface CopyDirectoryOptions {
  containmentRoot?: string;
}

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

function containmentError(path: string): StudyTutorError {
  return new StudyTutorError("Refusing to write outside project root", [path]);
}

function pathIsInsideOrEqual(root: string, candidate: string): boolean {
  const relativePath = relative(root, candidate);
  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

async function nearestExistingAncestor(path: string): Promise<string> {
  let currentPath = resolve(path);

  while (true) {
    try {
      await lstat(currentPath);
      return currentPath;
    } catch (error) {
      const code = errorCode(error);
      if (code !== "ENOENT" && code !== "ENOTDIR") {
        throw error;
      }

      const parentPath = dirname(currentPath);
      if (parentPath === currentPath) {
        throw error;
      }
      currentPath = parentPath;
    }
  }
}

async function assertContainedPath(root: string, path: string): Promise<void> {
  const absoluteRoot = resolve(root);
  const absolutePath = resolve(path);

  if (!pathIsInsideOrEqual(absoluteRoot, absolutePath)) {
    throw containmentError(path);
  }

  const realRoot = await realpath(absoluteRoot);
  const existingAncestor = await nearestExistingAncestor(absolutePath);
  const realAncestor = await realpath(existingAncestor);

  if (!pathIsInsideOrEqual(realRoot, realAncestor)) {
    throw containmentError(path);
  }
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

async function assertTargetPathsContained(source: string, target: string, sourceFiles: string[], containmentRoot?: string): Promise<void> {
  if (!containmentRoot) {
    return;
  }

  await assertContainedPath(containmentRoot, target);
  for (const sourceFile of sourceFiles) {
    const targetFile = targetFileFor(source, target, sourceFile);
    await assertContainedPath(containmentRoot, dirname(targetFile));
    await assertContainedPath(containmentRoot, targetFile);
  }
}

async function ensureContainedTargetDirectory(
  target: string,
  directory: string,
  createdDirectories: string[],
  containmentRoot?: string
): Promise<void> {
  const baseDirectory = containmentRoot ?? target;
  for (const directoryPath of targetDirectoryPaths(baseDirectory, directory)) {
    if (containmentRoot) {
      await assertContainedPath(containmentRoot, directoryPath);
    }

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

export async function copyDirectoryWithoutOverwrite(
  source: string,
  target: string,
  options: CopyDirectoryOptions = {}
): Promise<void> {
  const sourceFiles = await listFiles(source);
  await assertTargetPathsContained(source, target, sourceFiles, options.containmentRoot);

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
      await ensureContainedTargetDirectory(target, dirname(targetFile), createdDirectories, options.containmentRoot);
      if (options.containmentRoot) {
        await assertContainedPath(options.containmentRoot, targetFile);
      }
      await copyFile(sourceFile, targetFile, constants.COPYFILE_EXCL);
      createdFiles.push(targetFile);
    }
  } catch (error) {
    await rollbackCreatedPaths(createdFiles, createdDirectories);
    throw error;
  }
}
