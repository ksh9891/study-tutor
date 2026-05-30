import { loadRegistryManifest } from "@study-tutor/core";
import type { RegistryPack } from "@study-tutor/core";

export interface RegistryListOptions {
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

export async function runRegistryListCommand(options: RegistryListOptions): Promise<void> {
  const url = options.url?.trim();
  if (!url) {
    throw new Error("Missing required option: --url <git-repo-url>");
  }

  const manifest = await loadRegistryManifest({ url });
  console.log(formatRegistryList({ packs: manifest.packs }));
}
