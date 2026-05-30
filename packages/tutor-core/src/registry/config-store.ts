import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { z } from "zod";
import { StudyTutorError } from "../errors.js";
import { IdSchema } from "../pack/schema.js";
import { RegistryConfigSchema } from "./schema.js";
import type { RegistryConfig } from "./schema.js";

export interface RegistryConfigStoreOptions {
  configRoot?: string;
}

export interface AddRegistryInput extends RegistryConfigStoreOptions {
  name: string;
  url: string;
}

export interface ResolveRegistryUrlInput extends RegistryConfigStoreOptions {
  name: string;
}

export function registryConfigPath(configRoot = homedir()): string {
  return join(configRoot, ".study-tutor", "registries.json");
}

function getConfigRoot(options: RegistryConfigStoreOptions = {}): string {
  return options.configRoot ?? homedir();
}

function invalidRegistryConfig(error: unknown): StudyTutorError {
  if (error instanceof z.ZodError) {
    return new StudyTutorError("Invalid registry config", error.issues.map((issue) => issue.message));
  }

  if (error instanceof Error) {
    return new StudyTutorError("Invalid registry config", [error.message]);
  }

  return new StudyTutorError("Invalid registry config");
}

function parseRegistryName(name: string): string {
  const trimmedName = name.trim();
  const result = IdSchema.safeParse(trimmedName);

  if (!result.success) {
    throw new StudyTutorError("Invalid registry name", result.error.issues.map((issue) => issue.message));
  }

  return result.data;
}

function hasRegistry(config: RegistryConfig, name: string): boolean {
  return Object.hasOwn(config.registries, name);
}

export async function readRegistryConfig(
  options: RegistryConfigStoreOptions = {}
): Promise<RegistryConfig> {
  try {
    const content = await readFile(registryConfigPath(getConfigRoot(options)), "utf8");
    return RegistryConfigSchema.parse(JSON.parse(content));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return { registries: {} };
    }

    throw invalidRegistryConfig(error);
  }
}

export async function writeRegistryConfig(
  config: RegistryConfig,
  options: RegistryConfigStoreOptions = {}
): Promise<void> {
  const path = registryConfigPath(getConfigRoot(options));
  const parsedConfig = RegistryConfigSchema.parse(config);

  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(parsedConfig, null, 2)}\n`);
}

export async function addRegistry(input: AddRegistryInput): Promise<RegistryConfig> {
  const name = parseRegistryName(input.name);
  const url = input.url.trim();

  if (url.length === 0) {
    throw new StudyTutorError("Registry URL is required");
  }

  const config = await readRegistryConfig(input);

  if (hasRegistry(config, name)) {
    throw new StudyTutorError(`Registry already exists: ${name}`);
  }

  const updatedConfig: RegistryConfig = {
    registries: {
      ...config.registries,
      [name]: { url }
    }
  };

  await writeRegistryConfig(updatedConfig, input);

  return updatedConfig;
}

export async function resolveRegistryUrl(input: ResolveRegistryUrlInput): Promise<string> {
  const name = parseRegistryName(input.name);
  const config = await readRegistryConfig(input);

  if (!hasRegistry(config, name)) {
    throw new StudyTutorError(`Unknown registry: ${name}`);
  }

  const registry = config.registries[name];

  return registry.url;
}
