import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execa } from "execa";
import { StudyTutorError } from "../errors.js";
import { loadTutorPack } from "../pack/loader.js";
import { loadRegistryManifest } from "./loader.js";
import type { LoadedTutorPack } from "../pack/schema.js";
import type { RegistryPackSource } from "../progress/progress-store.js";
import type { RegistryManifest } from "./schema.js";

export interface ClonePackRepositoryInput {
  url: string;
  destination: string;
}

export interface CheckoutPackRepositoryInput {
  repositoryRoot: string;
  ref: string;
}

export type ClonePackRepository = (input: ClonePackRepositoryInput) => Promise<void>;
export type CheckoutPackRepository = (input: CheckoutPackRepositoryInput) => Promise<void>;

export interface ResolveRegistryPackInput {
  registryUrl: string;
  packId: string;
  tempRoot?: string;
  clone?: ClonePackRepository;
  checkout?: CheckoutPackRepository;
  cleanup?: (path: string) => Promise<void>;
  loadRegistryManifest?: (input: { url: string }) => Promise<RegistryManifest>;
  loadPack?: (packRoot: string) => Promise<LoadedTutorPack>;
}

export interface ResolvedRegistryPack {
  pack: LoadedTutorPack;
  packRoot: string;
  source: RegistryPackSource;
  cleanup: () => Promise<void>;
}

function errorDetails(error: unknown): string[] {
  if (error instanceof Error) {
    return [error.message];
  }
  return [String(error)];
}

function commandOutput(error: unknown): string {
  if (error && typeof error === "object") {
    const output = (error as { all?: unknown; stderr?: unknown; stdout?: unknown }).all
      ?? (error as { stderr?: unknown; stdout?: unknown }).stderr
      ?? (error as { stderr?: unknown; stdout?: unknown }).stdout;
    if (typeof output === "string" && output.length > 0) {
      return output;
    }
  }

  return error instanceof Error ? error.message : String(error);
}

async function cleanupPackRoot(
  path: string,
  cleanup: (path: string) => Promise<void>
): Promise<void> {
  await cleanup(path);
}

export async function clonePackRepositoryWithGit(input: ClonePackRepositoryInput): Promise<void> {
  try {
    await execa("git", ["clone", "--depth", "1", "--", input.url, input.destination], {
      all: true
    });
  } catch (error) {
    throw new StudyTutorError("Failed to clone pack repository", [commandOutput(error)]);
  }
}

export async function checkoutPackRepositoryWithGit(input: CheckoutPackRepositoryInput): Promise<void> {
  try {
    await execa("git", ["checkout", "--detach", input.ref], {
      cwd: input.repositoryRoot,
      all: true
    });
  } catch (error) {
    throw new StudyTutorError("Failed to checkout pack ref", [commandOutput(error)]);
  }
}

export async function resolveRegistryPack(input: ResolveRegistryPackInput): Promise<ResolvedRegistryPack> {
  const manifest = await (input.loadRegistryManifest ?? loadRegistryManifest)({
    url: input.registryUrl
  });
  const entry = manifest.packs.find((pack) => pack.id === input.packId);
  if (!entry) {
    throw new StudyTutorError(`Pack ${input.packId} was not found in registry`, [input.registryUrl]);
  }

  const cleanup = input.cleanup ?? ((path) => rm(path, { recursive: true, force: true }));
  const packRoot = await mkdtemp(join(input.tempRoot ?? tmpdir(), "study-tutor-pack-"));
  let primaryError: unknown;

  try {
    try {
      await (input.clone ?? clonePackRepositoryWithGit)({
        url: entry.repo,
        destination: packRoot
      });
    } catch (error) {
      if (error instanceof StudyTutorError) {
        throw error;
      }
      throw new StudyTutorError("Failed to clone pack repository", errorDetails(error));
    }

    try {
      await (input.checkout ?? checkoutPackRepositoryWithGit)({
        repositoryRoot: packRoot,
        ref: entry.defaultRef
      });
    } catch (error) {
      if (error instanceof StudyTutorError) {
        throw error;
      }
      throw new StudyTutorError("Failed to checkout pack ref", errorDetails(error));
    }

    const pack = await (input.loadPack ?? loadTutorPack)(packRoot);
    return {
      pack,
      packRoot,
      source: {
        type: "registry",
        registryUrl: input.registryUrl,
        packRepo: entry.repo,
        ref: entry.defaultRef,
        localSnapshot: ".tutor/pack"
      },
      cleanup: () => cleanupPackRoot(packRoot, cleanup)
    };
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    if (primaryError) {
      try {
        await cleanupPackRoot(packRoot, cleanup);
      } catch (cleanupError) {
        if (primaryError instanceof StudyTutorError) {
          primaryError.details.push(`Cleanup failed: ${errorDetails(cleanupError)[0]}`);
        }
      }
    }
  }
}
