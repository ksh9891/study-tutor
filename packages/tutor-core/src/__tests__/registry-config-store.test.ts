import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  addRegistry,
  readRegistryConfig,
  registryConfigPath,
  resolveRegistryUrl
} from "../registry/config-store.js";

async function createConfigRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "study-tutor-registry-config-"));
}

describe("registry config store", () => {
  it("returns an empty config when registries.json does not exist", async () => {
    const configRoot = await createConfigRoot();

    await expect(readRegistryConfig({ configRoot })).resolves.toEqual({ registries: {} });
  });

  it("adds a registry and can resolve it by name", async () => {
    const configRoot = await createConfigRoot();

    await addRegistry({
      configRoot,
      name: "official",
      url: "https://github.com/me/study-tutor-marketplace.git"
    });

    await expect(readRegistryConfig({ configRoot })).resolves.toEqual({
      registries: {
        official: {
          url: "https://github.com/me/study-tutor-marketplace.git"
        }
      }
    });
    await expect(resolveRegistryUrl({ configRoot, name: "official" })).resolves.toBe(
      "https://github.com/me/study-tutor-marketplace.git"
    );
    await expect(readFile(registryConfigPath(configRoot), "utf8")).resolves.toBe(
      `${JSON.stringify({
        registries: {
          official: {
            url: "https://github.com/me/study-tutor-marketplace.git"
          }
        }
      }, null, 2)}\n`
    );
  });

  it("rejects duplicate registry names", async () => {
    const configRoot = await createConfigRoot();
    await addRegistry({ configRoot, name: "official", url: "https://github.com/me/one.git" });

    await expect(addRegistry({
      configRoot,
      name: "official",
      url: "https://github.com/me/two.git"
    })).rejects.toThrow("Registry already exists: official");
  });

  it("treats inherited object property names as normal registry names", async () => {
    const configRoot = await createConfigRoot();

    await addRegistry({
      configRoot,
      name: "constructor",
      url: "https://github.com/me/constructor.git"
    });

    await expect(resolveRegistryUrl({ configRoot, name: "constructor" })).resolves.toBe(
      "https://github.com/me/constructor.git"
    );
  });

  it("rejects invalid registry names", async () => {
    const configRoot = await createConfigRoot();

    await expect(addRegistry({
      configRoot,
      name: "../escape",
      url: "https://github.com/me/registry.git"
    })).rejects.toMatchObject({
      message: "Invalid registry name"
    });
  });

  it("fails with details when registries.json is malformed", async () => {
    const configRoot = await createConfigRoot();
    await mkdir(join(configRoot, ".study-tutor"), { recursive: true });
    await writeFile(registryConfigPath(configRoot), "{");

    await expect(readRegistryConfig({ configRoot })).rejects.toMatchObject({
      message: "Invalid registry config"
    });
  });

  it("fails when resolving an unknown registry", async () => {
    const configRoot = await createConfigRoot();

    await expect(resolveRegistryUrl({ configRoot, name: "missing" })).rejects.toThrow(
      "Unknown registry: missing"
    );
  });
});
