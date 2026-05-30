import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

function cliModuleDirectory(): string {
  return dirname(fileURLToPath(import.meta.url));
}

export function repoRootFromCliSource(): string {
  return join(cliModuleDirectory(), "..", "..", "..");
}

export function bundledPackRoot(packId: string): string {
  const packagedPackRoot = join(cliModuleDirectory(), "packs", packId);
  if (existsSync(packagedPackRoot)) {
    return packagedPackRoot;
  }

  return join(repoRootFromCliSource(), "packs", packId);
}
