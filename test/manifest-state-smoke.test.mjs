import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const expectedPromptCommands = ["start_tutoring", "hint", "reflect", "next_step"];
const expectedSkillNames = ["tutor-implementation", "tutor-learn-topic"];

const readJson = (relativePath) => JSON.parse(readFileSync(resolve(packageRoot, relativePath), "utf8"));
const readText = (relativePath) => readFileSync(resolve(packageRoot, relativePath), "utf8");

test("package.json exposes a pi manifest for extensions, skills, and prompts", () => {
  const pkg = readJson("package.json");

  assert.deepEqual(pkg.pi, {
    extensions: ["./extensions"],
    skills: ["./skills"],
    prompts: ["./prompts"],
  });
});

test("package.json declares the required pi peer dependencies", () => {
  const pkg = readJson("package.json");

  for (const dependencyName of [
    "@mariozechner/pi-ai",
    "@mariozechner/pi-coding-agent",
    "@mariozechner/pi-tui",
    "@sinclair/typebox",
  ]) {
    assert.equal(typeof pkg.peerDependencies?.[dependencyName], "string", `${dependencyName} should be a peer dependency`);
  }
});

test("state model source defines learner, roadmap, and progress schemas", () => {
  const source = readText("src/state.ts");

  assert.match(source, /export const LearnerProfileSchema/);
  assert.match(source, /export const ProjectRoadmapSchema/);
  assert.match(source, /export const ProjectProgressSchema/);
  assert.match(source, /learner-profile\.md/);
  assert.match(source, /track\.md/);
  assert.match(source, /roadmap\.md/);
  assert.match(source, /progress\.md/);
  assert.match(source, /TRACKS_ROOT/);
});

test("package resource shells exist for extension, skills, and prompts", () => {
  for (const relativePath of [
    "extensions/pi-tutor/index.ts",
    "skills/tutor-implementation/SKILL.md",
    "skills/tutor-learn-topic/SKILL.md",
    "prompts/start_tutoring.md",
    "prompts/hint.md",
    "prompts/reflect.md",
    "prompts/next_step.md",
  ]) {
    assert.equal(existsSync(resolve(packageRoot, relativePath)), true, `${relativePath} should exist`);
  }
});

test("workflow resources are concrete track-aware package contents instead of placeholders", () => {
  for (const relativePath of [
    "skills/tutor-implementation/SKILL.md",
    "skills/tutor-learn-topic/SKILL.md",
    "prompts/start_tutoring.md",
    "prompts/hint.md",
    "prompts/reflect.md",
    "prompts/next_step.md",
  ]) {
    const text = readText(relativePath);
    assert.equal(/placeholder|package shell/i.test(text), false, `${relativePath} should not be a placeholder`);
  }

  assert.match(readText("skills/tutor-implementation/SKILL.md"), /track\.md/);
  assert.match(readText("skills/tutor-implementation/SKILL.md"), /roadmap\.md/);
  assert.match(readText("skills/tutor-implementation/SKILL.md"), /progress\.md/);
  assert.match(readText("prompts/reflect.md"), /Next step/i);
  assert.match(readText("prompts/next_step.md"), /progress\.md/);
});

test("README documents GitHub install, local dev install, reload, workflow usage, state layout, and current limitations", () => {
  const readme = readText("README.md");

  assert.match(readme, /pi install https:\/\/github\.com\/denismrvoljak\/pi-tutor/);
  assert.match(readme, /pi install \/absolute\/path\/to\/pi-tutor/);
  assert.match(readme, /pi install -l \/absolute\/path\/to\/pi-tutor/);
  assert.match(readme, /\/reload/);
  assert.match(readme, /\/tutor on/);
  assert.match(readme, /\/hint/);
  assert.match(readme, /\/reflect/);
  assert.match(readme, /\/next_step/);
  assert.match(readme, /learner-profile\.md/);
  assert.match(readme, /tracks\/<topic-folder>\//);
  assert.match(readme, /track\.md/);
  assert.match(readme, /roadmap\.md/);
  assert.match(readme, /progress\.md/);
  assert.match(readme, /heuristic track matching/i);
  assert.match(readme, /name the topic clearly/i);
  assert.match(readme, /no hidden active-track state|no active-track state/i);
  assert.match(readme, /single-agent|no subagents/i);
  assert.doesNotMatch(readme, /Install from a tarball/i);
  assert.doesNotMatch(readme, /Optional Future Subagents/i);
  assert.doesNotMatch(readme, /Subagents may be added later/i);
});

test("README workflow examples and pack smoke stay in sync with packaged resources", () => {
  const readme = readText("README.md");
  const script = readText("scripts/pack-smoke.mjs");

  for (const promptName of expectedPromptCommands) {
    assert.match(readme, new RegExp(`/${promptName}\\b`));
    assert.match(script, new RegExp(promptName));
  }

  for (const skillName of expectedSkillNames) {
    assert.match(script, new RegExp(skillName));
  }

  assert.match(readme, /pnpm pack:smoke/);
  assert.match(readme, /pi list/);
  assert.match(script, /pnpm", \["pack", "--pack-destination"/);
  assert.match(script, /DefaultResourceLoader/);
  assert.match(script, /SettingsManager/);
  assert.match(script, /tar", \["-xzf"/);
  assert.match(script, /pi", \["install", "-l", unpackedPackagePath\]/);
  assert.match(script, /pi", \["list"\]/);
});
