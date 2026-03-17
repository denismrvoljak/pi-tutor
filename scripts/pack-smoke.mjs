import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readdirSync, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DefaultResourceLoader, SettingsManager } from "@mariozechner/pi-coding-agent";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const expectedTarEntries = [
  "package/README.md",
  "package/extensions/pi-tutor/index.ts",
  "package/skills/tutor-implementation/SKILL.md",
  "package/skills/tutor-learn-topic/SKILL.md",
  "package/prompts/start_tutoring.md",
  "package/prompts/hint.md",
  "package/prompts/reflect.md",
  "package/prompts/next_step.md",
  "package/src/learner-profile.ts",
  "package/src/state.ts",
  "package/src/tracks.ts",
  "package/scripts/pack-smoke.mjs",
];
const expectedPromptCommands = ["start_tutoring", "hint", "reflect", "next_step"];
const expectedSkillNames = ["tutor-implementation", "tutor-learn-topic"];

const packDir = mkdtempSync(join(tmpdir(), "pi-tutor-pack-"));
const unpackDir = mkdtempSync(join(tmpdir(), "pi-tutor-unpack-"));
const agentDir = mkdtempSync(join(tmpdir(), "pi-tutor-agent-"));
const projectDir = mkdtempSync(join(tmpdir(), "pi-tutor-project-"));

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: packageRoot,
    encoding: "utf8",
    ...options,
  });

  if (result.status !== 0) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    throw new Error(`Command failed: ${command} ${args.join(" ")}`);
  }

  return result;
}

try {
  run("pnpm", ["pack", "--pack-destination", packDir]);

  const tarballs = readdirSync(packDir).filter((file) => file.endsWith(".tgz"));
  assert.equal(tarballs.length > 0, true, "Expected pnpm pack to create a tarball.");

  const tarballPath = join(packDir, tarballs[0]);
  const tarEntries = run("tar", ["-tf", tarballPath]).stdout
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);

  for (const expectedEntry of expectedTarEntries) {
    assert.equal(tarEntries.includes(expectedEntry), true, `Missing packed file: ${expectedEntry}`);
  }

  run("tar", ["-xzf", tarballPath, "-C", unpackDir]);
  const unpackedPackagePath = join(unpackDir, "package");

  const env = {
    ...process.env,
    PI_CODING_AGENT_DIR: agentDir,
  };

  run("pi", ["install", "-l", unpackedPackagePath], { cwd: projectDir, env });
  const listResult = run("pi", ["list"], { cwd: projectDir, env });
  assert.match(listResult.stdout, /pi-tutor/i);
  assert.match(listResult.stdout, /package/);

  const settingsManager = SettingsManager.create(projectDir, agentDir);
  const loader = new DefaultResourceLoader({
    cwd: projectDir,
    agentDir,
    settingsManager,
  });
  await loader.reload();

  const promptNames = loader.getPrompts().prompts.map((prompt) => prompt.name);
  const skillNames = loader.getSkills().skills.map((skill) => skill.name);
  const extensionPaths = loader.getExtensions().extensions.map((extension) => String(extension.path));

  for (const promptName of expectedPromptCommands) {
    assert.equal(promptNames.includes(promptName), true, `Prompt command not discoverable after install: ${promptName}`);
  }

  for (const skillName of expectedSkillNames) {
    assert.equal(skillNames.includes(skillName), true, `Skill not discoverable after install: ${skillName}`);
  }

  assert.equal(
    extensionPaths.some((path) => path.includes("extensions/pi-tutor/index.ts")),
    true,
    "Extension not discoverable after tarball install.",
  );

  console.log(`pack:smoke installed ${tarballs[0]} and discovered prompts=${promptNames.join(", ")} skills=${skillNames.join(", ")}`);
} finally {
  rmSync(packDir, { recursive: true, force: true });
  rmSync(unpackDir, { recursive: true, force: true });
  rmSync(agentDir, { recursive: true, force: true });
  rmSync(projectDir, { recursive: true, force: true });
}
