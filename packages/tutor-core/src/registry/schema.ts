import { z } from "zod";
import { IdSchema } from "../pack/schema.js";

export const RegistryPackSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  repo: z.string().min(1),
  defaultRef: z.string().min(1),
  tags: z.array(IdSchema).default([])
});

export const RegistryManifestSchema = z.object({
  packs: z.array(RegistryPackSchema)
});

export const RegistryConfigEntrySchema = z.object({
  url: z.string().min(1)
});

export const RegistryConfigSchema = z.object({
  registries: z.record(IdSchema, RegistryConfigEntrySchema).default({})
});

export type RegistryPack = z.infer<typeof RegistryPackSchema>;
export type RegistryManifest = z.infer<typeof RegistryManifestSchema>;
export type RegistryConfigEntry = z.infer<typeof RegistryConfigEntrySchema>;
export type RegistryConfig = z.infer<typeof RegistryConfigSchema>;
