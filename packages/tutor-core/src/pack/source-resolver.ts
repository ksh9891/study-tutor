import { access } from "node:fs/promises";
import { join } from "node:path";
import { StudyTutorError } from "../errors.js";
import { assertContainedPath } from "../fs/containment.js";
import { readPackLock } from "../progress/progress-store.js";

export interface ResolveInstalledPackRootOptions {
  bundledPackRoot: (packId: string) => string;
}

async function assertSnapshotExists(path: string): Promise<void> {
  try {
    await access(path);
  } catch {
    throw new StudyTutorError("Local registry pack snapshot is missing", [path]);
  }
}

export async function resolveInstalledPackRoot(
  projectRoot: string,
  options: ResolveInstalledPackRootOptions
): Promise<string> {
  const packLock = await readPackLock(projectRoot);

  if (typeof packLock.source === "string" || packLock.source.type === "bundled") {
    return options.bundledPackRoot(packLock.pack);
  }

  const snapshot = join(projectRoot, packLock.source.localSnapshot);
  await assertContainedPath(projectRoot, snapshot);
  await assertSnapshotExists(snapshot);
  return snapshot;
}
