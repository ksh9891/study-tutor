import { lstat, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { StudyTutorError } from "../errors.js";

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : undefined;
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

export async function assertContainedPath(root: string, path: string): Promise<void> {
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
