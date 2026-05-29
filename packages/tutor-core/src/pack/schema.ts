import { z } from "zod";

export const IdSchema = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "must match /^[a-z0-9][a-z0-9-]*$/");

export const PackSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  version: z.string().min(1),
  language: z.literal("java"),
  runtime: z.object({
    java: z.string().min(1),
    buildTool: z.literal("gradle")
  }),
  initialStep: IdSchema
});

export const CourseSchema = z.object({
  id: IdSchema,
  title: z.string().min(1),
  status: z.enum(["active", "coming-soon"]),
  steps: z.array(IdSchema).optional()
});

export const CurriculumSchema = z.object({
  courses: z.array(CourseSchema).min(1)
});

export const StepSchema = z.object({
  id: IdSchema,
  order: z.number().int().positive(),
  title: z.string().min(1)
});

export const TckSchema = z.object({
  edgeCases: z.record(IdSchema, z.object({
    testClass: z.string().min(1),
    title: z.string().min(1),
    whyImportant: z.string().min(1),
    hint: z.string().min(1)
  })).default({})
});

export type PackMetadata = z.infer<typeof PackSchema>;
export type Course = z.infer<typeof CourseSchema>;
export type Curriculum = z.infer<typeof CurriculumSchema>;
export type StepMetadata = z.infer<typeof StepSchema>;
export type TckMetadataFile = z.infer<typeof TckSchema>;

export interface TckEdgeCase {
  id: string;
  testClass: string;
  title: string;
  whyImportant: string;
  hint: string;
}

export interface LoadedStep {
  id: string;
  order: number;
  title: string;
  root: string;
  tck: {
    edgeCases: TckEdgeCase[];
  };
}

export interface LoadedTutorPack {
  root: string;
  metadata: PackMetadata;
  curriculum: Curriculum;
  activeCourses: Course[];
  comingSoonCourses: Course[];
  steps: LoadedStep[];
  stepById: Map<string, LoadedStep>;
}
