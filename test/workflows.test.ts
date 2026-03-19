import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readText(relativePath: string): string {
  return readFileSync(resolve(packageRoot, relativePath), "utf8");
}

test("tutor-implementation skill defines a track-aware hint ladder and progress update loop", () => {
  const skill = readText("skills/tutor-implementation/SKILL.md");

  assert.equal(/placeholder|initial package shell/i.test(skill), false);
  assert.match(skill, /disable-model-invocation:\s*true/i);
  assert.match(skill, /attempt-first/i);
  assert.match(skill, /Level 1/i);
  assert.match(skill, /Level 2/i);
  assert.match(skill, /Level 3/i);
  assert.match(skill, /track\.md/);
  assert.match(skill, /project\.md/);
  assert.match(skill, /roadmap\.md/);
  assert.match(skill, /progress\.md/);
  assert.match(skill, /Update progress\.md after meaningful completions or reflections/i);
  assert.match(skill, /hidden active-track state/i);
});

test("tutor-learn-topic skill teaches in small chunks with understanding checks tied to the roadmap", () => {
  const skill = readText("skills/tutor-learn-topic/SKILL.md");

  assert.equal(/placeholder|package shell/i.test(skill), false);
  assert.match(skill, /disable-model-invocation:\s*true/i);
  assert.match(skill, /small chunks/i);
  assert.match(skill, /(check-for-understanding|check for understanding|active-recall)/i);
  assert.match(skill, /project\.md/);
  assert.match(skill, /roadmap\.md/);
  assert.match(skill, /(practice|exercise)/i);
  assert.match(skill, /progress\.md/);
});

test("start_tutoring prompt starts or resumes a markdown-first track-aware tutoring flow", () => {
  const prompt = readText("prompts/start_tutoring.md");

  assert.match(prompt, /Start or resume tutoring/i);
  assert.match(prompt, /attempt-first/i);
  assert.match(prompt, /hint-first/i);
  assert.match(prompt, /track\.md/);
  assert.match(prompt, /project\.md/);
  assert.match(prompt, /roadmap\.md/);
  assert.match(prompt, /progress\.md/);
  assert.match(prompt, /Journey status/i);
  assert.match(prompt, /hidden active-track state/i);
});

test("hint prompt defines a leveled hint ladder instead of jumping to a full solution", () => {
  const prompt = readText("prompts/hint.md");

  assert.match(prompt, /Level 1/i);
  assert.match(prompt, /Level 2/i);
  assert.match(prompt, /Level 3/i);
  assert.match(prompt, /Full solution/i);
  assert.match(prompt, /track\.md/);
  assert.match(prompt, /project\.md/);
  assert.match(prompt, /roadmap\.md/);
  assert.match(prompt, /progress\.md/);
});

test("reflect and next_step prompts explicitly maintain progress.md", () => {
  for (const relativePath of ["prompts/reflect.md", "prompts/next_step.md"]) {
    assert.equal(existsSync(resolve(packageRoot, relativePath)), true, `${relativePath} should exist`);
    const prompt = readText(relativePath);

    assert.match(prompt, /progress\.md/);
    assert.match(prompt, /project\.md/);
    assert.match(prompt, /roadmap\.md/);
    assert.match(prompt, /(Journey status|roadmap checkbox)/i);
    assert.match(prompt, /Reflections/i);
    assert.match(prompt, /Blockers/i);
    assert.match(prompt, /Next step/i);
  }
});