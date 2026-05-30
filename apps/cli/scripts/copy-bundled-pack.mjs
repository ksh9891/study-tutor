import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const cliRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(cliRoot, "../..");
const packId = "jpa-tutor-pack";
const source = join(repositoryRoot, "packs", packId);
const target = join(cliRoot, "dist", "packs", packId);
const cliDist = join(cliRoot, "dist");
const coreRoot = join(repositoryRoot, "packages", "tutor-core");
const coreDistSource = join(coreRoot, "dist");
const packagedCoreRoot = join(cliDist, "node_modules", "@study-tutor", "core");

function isRuntimeCorePath(path) {
  return !path.split(sep).includes("__tests__") && basename(path) !== ".tsbuildinfo";
}

await rm(target, { recursive: true, force: true });
await mkdir(dirname(target), { recursive: true });
await cp(source, target, { recursive: true });

await rm(join(cliDist, "__tests__"), { recursive: true, force: true });
await rm(join(cliDist, ".tsbuildinfo"), { force: true });

await rm(packagedCoreRoot, { recursive: true, force: true });
await mkdir(packagedCoreRoot, { recursive: true });
await cp(coreDistSource, join(packagedCoreRoot, "dist"), {
  recursive: true,
  filter: isRuntimeCorePath
});

const corePackageJson = JSON.parse(await readFile(join(coreRoot, "package.json"), "utf8"));
await writeFile(join(packagedCoreRoot, "package.json"), `${JSON.stringify({
  name: corePackageJson.name,
  version: corePackageJson.version,
  type: corePackageJson.type,
  main: corePackageJson.main,
  exports: corePackageJson.exports
}, null, 2)}\n`);
