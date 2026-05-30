import { addRegistry, loadRegistryManifest, resolveRegistryUrl, StudyTutorError } from "@study-tutor/core";
import type { RegistryPack } from "@study-tutor/core";

export interface RegistryListOptions {
  registry?: string;
  url?: string;
}

export interface RegistryListView {
  packs: RegistryPack[];
}

function formatTags(tags: string[]): string {
  return tags.length > 0 ? tags.join(", ") : "-";
}

export function formatRegistryList(view: RegistryListView): string {
  if (view.packs.length === 0) {
    return "No packs found in registry.";
  }

  const lines = ["Available packs", ""];
  for (const pack of view.packs) {
    lines.push(
      pack.id,
      `  ${pack.name}`,
      `  ${pack.description}`,
      `  repo: ${pack.repo}`,
      `  ref: ${pack.defaultRef}`,
      `  tags: ${formatTags(pack.tags)}`,
      ""
    );
  }

  return lines.slice(0, -1).join("\n");
}

function formatStudyTutorError(error: StudyTutorError): Error {
  const details = error.details.map((detail) => `  - ${detail}`).join("\n");
  return new Error(details ? `${error.message}\n${details}` : error.message);
}

async function withStudyTutorErrorDetails<T>(operation: Promise<T>): Promise<T> {
  return operation.catch((error: unknown) => {
    if (error instanceof StudyTutorError) {
      throw formatStudyTutorError(error);
    }

    throw error;
  });
}

export async function runRegistryAddCommand(name: string, url: string): Promise<void> {
  const registryName = name.trim();
  const registryUrl = url.trim();

  await addRegistry({ name: registryName, url: registryUrl });

  console.log([`Registry added: ${registryName}`, `URL: ${registryUrl}`].join("\n"));
}

async function resolveRegistryListUrl(options: RegistryListOptions): Promise<string> {
  const registry = options.registry?.trim();
  const url = options.url?.trim();

  if (registry && url) {
    throw new Error("Use either --registry or --url, not both");
  }

  if (registry) {
    return withStudyTutorErrorDetails(resolveRegistryUrl({ name: registry }));
  }

  if (url) {
    return url;
  }

  throw new Error("Missing required option: --registry <name> or --url <git-repo-url>");
}

export async function runRegistryListCommand(options: RegistryListOptions): Promise<void> {
  const url = await resolveRegistryListUrl(options);

  const manifest = await withStudyTutorErrorDetails(loadRegistryManifest({ url }));
  console.log(formatRegistryList({ packs: manifest.packs }));
}
