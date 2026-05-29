import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function repoRootFromCliSource(): string {
  const currentFile = fileURLToPath(import.meta.url);
  return join(dirname(currentFile), "..", "..", "..");
}

export function bundledPackRoot(packId: string): string {
  return join(repoRootFromCliSource(), "packs", packId);
}
