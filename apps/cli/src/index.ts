#!/usr/bin/env node
import { Command } from "commander";
import { STUDY_TUTOR_CORE_VERSION } from "@study-tutor/core";
import { runInstallCommand } from "./commands/install.js";
import { runNextCommand } from "./commands/next.js";
import { runRegistryAddCommand, runRegistryListCommand } from "./commands/registry.js";
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

const registry = program
  .command("registry")
  .description("Browse tutor pack registries");

registry
  .command("add")
  .argument("<name>")
  .argument("<git-repo-url>")
  .description("Save a marketplace registry URL")
  .action(runRegistryAddCommand);

registry
  .command("list")
  .description("List packs from a marketplace registry")
  .option("--registry <name>", "Saved registry name")
  .option("--url <git-repo-url>", "Git repo URL for the marketplace registry")
  .action((options: { registry?: string; url?: string }) => runRegistryListCommand(options));

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
