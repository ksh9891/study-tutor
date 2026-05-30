import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execa } from "execa";
import YAML from "yaml";
import { StudyTutorError } from "../errors.js";
import { RegistryManifestSchema } from "./schema.js";
import type { RegistryManifest } from "./schema.js";

export interface CloneRegistryInput {
  url: string;
  destination: string;
}

export type CloneRegistry = (input: CloneRegistryInput) => Promise<void>;

export interface LoadRegistryManifestInput {
  url: string;
  tempRoot?: string;
  clone?: CloneRegistry;
}

function errorDetails(error: unknown): string[] {
  if (error instanceof Error) {
    return [error.message];
  }
  return [String(error)];
}

function commandOutput(error: unknown): string {
  if (error && typeof error === "object") {
    const output = (error as { all?: unknown; stdout?: unknown; stderr?: unknown }).all
      ?? (error as { stdout?: unknown; stderr?: unknown }).stderr
      ?? (error as { stdout?: unknown; stderr?: unknown }).stdout;
    if (typeof output === "string" && output.length > 0) {
      return output;
    }
  }

  return error instanceof Error ? error.message : String(error);
}

function formatZodDetails(error: unknown): string[] {
  if (error && typeof error === "object" && "issues" in error) {
    return (error as { issues: Array<{ path: Array<string | number>; message: string }> }).issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  }
  return [String(error)];
}

export async function cloneRegistryWithGit(input: CloneRegistryInput): Promise<void> {
  try {
    await execa("git", ["clone", "--depth", "1", input.url, input.destination], {
      all: true
    });
  } catch (error) {
    throw new StudyTutorError("Failed to clone registry", [commandOutput(error)]);
  }
}

async function readManifestFile(file: string): Promise<unknown> {
  let source: string;
  try {
    source = await readFile(file, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new StudyTutorError("Registry manifest packs.yaml not found", [file]);
    }
    throw error;
  }

  try {
    return YAML.parse(source);
  } catch (error) {
    throw new StudyTutorError("Invalid registry manifest YAML", errorDetails(error));
  }
}

export async function loadRegistryManifest(input: LoadRegistryManifestInput): Promise<RegistryManifest> {
  const tempRoot = input.tempRoot ?? tmpdir();
  const registryRoot = await mkdtemp(join(tempRoot, "study-tutor-registry-"));

  try {
    try {
      await (input.clone ?? cloneRegistryWithGit)({
        url: input.url,
        destination: registryRoot
      });
    } catch (error) {
      if (error instanceof StudyTutorError) {
        throw error;
      }
      throw new StudyTutorError("Failed to clone registry", errorDetails(error));
    }

    const manifestFile = join(registryRoot, "packs.yaml");
    const parsed = await readManifestFile(manifestFile);
    const result = RegistryManifestSchema.safeParse(parsed);
    if (!result.success) {
      throw new StudyTutorError("Invalid packs.yaml", formatZodDetails(result.error));
    }
    return result.data;
  } finally {
    await rm(registryRoot, { recursive: true, force: true });
  }
}
