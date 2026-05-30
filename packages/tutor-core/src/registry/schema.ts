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

export type RegistryPack = z.infer<typeof RegistryPackSchema>;
export type RegistryManifest = z.infer<typeof RegistryManifestSchema>;
