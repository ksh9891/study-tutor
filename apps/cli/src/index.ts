#!/usr/bin/env node
import { Command } from "commander";
import { STUDY_TUTOR_CORE_VERSION } from "@study-tutor/core";

const program = new Command();

program
  .name("study-tutor")
  .description("CLI learning runtime for tutor packs")
  .version(STUDY_TUTOR_CORE_VERSION);

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
