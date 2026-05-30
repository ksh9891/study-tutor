import { describe, expect, it } from "vitest";
import { RegistryManifestSchema } from "../registry/schema.js";

describe("RegistryManifestSchema", () => {
  it("parses a marketplace manifest with one pack", () => {
    const manifest = RegistryManifestSchema.parse({
      packs: [
        {
          id: "jpa-tutor-pack",
          name: "JPA Tutor Pack",
          description: "Mini Hibernate를 구현하며 JPA를 배우는 pack",
          repo: "https://github.com/ksh9891/jpa-tutor-pack.git",
          defaultRef: "main",
          tags: ["java", "jpa", "backend"]
        }
      ]
    });

    expect(manifest.packs).toEqual([
      {
        id: "jpa-tutor-pack",
        name: "JPA Tutor Pack",
        description: "Mini Hibernate를 구현하며 JPA를 배우는 pack",
        repo: "https://github.com/ksh9891/jpa-tutor-pack.git",
        defaultRef: "main",
        tags: ["java", "jpa", "backend"]
      }
    ]);
  });

  it("allows an empty pack list", () => {
    const manifest = RegistryManifestSchema.parse({ packs: [] });

    expect(manifest.packs).toEqual([]);
  });

  it("rejects path-like pack ids", () => {
    expect(() => RegistryManifestSchema.parse({
      packs: [
        {
          id: "../escape",
          name: "Bad Pack",
          description: "Invalid pack id",
          repo: "https://github.com/example/bad-pack.git",
          defaultRef: "main",
          tags: []
        }
      ]
    })).toThrow();
  });

  it("rejects empty required fields", () => {
    expect(() => RegistryManifestSchema.parse({
      packs: [
        {
          id: "empty-pack",
          name: "",
          description: "",
          repo: "",
          defaultRef: "",
          tags: []
        }
      ]
    })).toThrow();
  });
});
