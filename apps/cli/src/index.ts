#!/usr/bin/env node
import { Command } from "commander";
import { STUDY_TUTOR_CORE_VERSION } from "@study-tutor/core";
import { runInstallCommand } from "./commands/install.js";
import { runNextCommand } from "./commands/next.js";
import { runStatusCommand } from "./commands/status.js";
import { runTestCommand } from "./commands/test.js";

const program = new Command();

program
  .name("study-tutor")
  .description("CLI learning runtime for tutor packs")
  .version(STUDY_TUTOR_CORE_VERSION);

program
  .command("install")
  .argument("<pack-id>")
  .description("Install a tutor pack into a new study project")
  .action(runInstallCommand);

program
  .command("status")
  .description("Show current study progress and next actions")
  .action(() => runStatusCommand());

program
  .command("test")
  .description("Run learner tests and public sanity tests")
  .action(() => runTestCommand());

program
  .command("next")
  .description("Run completion checks and create the next step")
  .action(() => runNextCommand());

program.parseAsync(process.argv).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
