import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  buildLearnerProfilePrompt,
  getLearnerProfileTemplate,
  loadLearnerProfileMarkdown,
  renderLearnerProfileMarkdown,
  resolveLearnerProfilePath,
  saveLearnerProfileMarkdown,
} from "../src/learner-profile.ts";

test("resolveLearnerProfilePath stores the learner profile as markdown", () => {
  const agentDir = "/tmp/pi-agent";
  assert.equal(resolveLearnerProfilePath(agentDir), "/tmp/pi-agent/pi-tutor/learner-profile.md");
});

test("renderLearnerProfileMarkdown creates the expected markdown structure", () => {
  const markdown = renderLearnerProfileMarkdown({
    currentLevel: "intermediate",
    preferredStackOrDomain: "React, TypeScript",
    projectBasedLearning: false,
    attemptFirst: true,
    preferHintsBeforeSolutions: true,
    conciseExplanations: false,
    reflectionCheckpoints: true,
    learningGoals: ["Ship a real React app", "Get better at state management"],
    primaryTopics: ["React", "TypeScript"],
    notes: ["Preferred help style: detailed explanations with reflection checkpoints"],
    createdAt: "2026-03-17T12:00:00.000Z",
    updatedAt: "2026-03-17T12:00:00.000Z",
  });

  assert.match(markdown, /# Learner Profile/);
  assert.match(markdown, /## Snapshot/);
  assert.match(markdown, /- Current level: intermediate/);
  assert.match(markdown, /- Project-based learning: no/);
  assert.match(markdown, /- Concise explanations: no/);
  assert.match(markdown, /## Learning goals/);
  assert.match(markdown, /- Ship a real React app/);
  assert.match(markdown, /## Primary topics/);
  assert.match(markdown, /- React/);
});

test("saveLearnerProfileMarkdown and loadLearnerProfileMarkdown round-trip markdown through the agent dir", async () => {
  const agentDir = mkdtempSync(join(tmpdir(), "pi-tutor-agent-"));

  try {
    const markdown = renderLearnerProfileMarkdown({
      currentLevel: "beginner",
      preferredStackOrDomain: "Rails, Hotwire",
      projectBasedLearning: true,
      attemptFirst: true,
      preferHintsBeforeSolutions: true,
      conciseExplanations: true,
      reflectionCheckpoints: true,
      learningGoals: ["Build a Rails app"],
      primaryTopics: ["Rails", "Hotwire"],
      notes: ["Preferred help style: concise hints"],
      createdAt: "2026-03-17T13:00:00.000Z",
      updatedAt: "2026-03-17T13:00:00.000Z",
    });

    const savedPath = await saveLearnerProfileMarkdown(markdown, agentDir);
    assert.equal(savedPath, resolveLearnerProfilePath(agentDir));

    const loaded = await loadLearnerProfileMarkdown(agentDir);
    assert.equal(loaded, markdown);
  } finally {
    rmSync(agentDir, { recursive: true, force: true });
  }
});

test("buildLearnerProfilePrompt treats markdown as the tutoring source of truth", () => {
  const markdown = renderLearnerProfileMarkdown({
    currentLevel: "intermediate",
    preferredStackOrDomain: "React, TypeScript",
    projectBasedLearning: false,
    attemptFirst: true,
    preferHintsBeforeSolutions: true,
    conciseExplanations: false,
    reflectionCheckpoints: true,
    learningGoals: ["Learn React deeply"],
    primaryTopics: ["React", "TypeScript"],
    notes: ["Preferred help style: detailed explanations with reflection checkpoints"],
    createdAt: "2026-03-17T14:00:00.000Z",
    updatedAt: "2026-03-17T14:00:00.000Z",
  });

  const prompt = buildLearnerProfilePrompt(markdown);
  assert.match(prompt, /source of truth/i);
  assert.match(prompt, /Learner Profile/);
  assert.match(prompt, /detailed explanations/i);
});

test("learner profile template gives the agent a markdown scaffold for first-run onboarding", () => {
  const template = getLearnerProfileTemplate();

  assert.match(template, /# Learner Profile/);
  assert.match(template, /## Snapshot/);
  assert.match(template, /## Learning goals/);
  assert.match(template, /## Notes/);
});

test("PI_TUTOR_DIR overrides the host agent dir; an explicit agentDir still wins", () => {
  const previous = process.env.PI_TUTOR_DIR;
  try {
    process.env.PI_TUTOR_DIR = "/tmp/shared-tutor";
    assert.equal(resolveLearnerProfilePath(), "/tmp/shared-tutor/learner-profile.md");
    assert.equal(resolveLearnerProfilePath("/tmp/pi-agent"), "/tmp/pi-agent/pi-tutor/learner-profile.md");
    process.env.PI_TUTOR_DIR = "~/tutor-data";
    assert.equal(resolveLearnerProfilePath(), join(homedir(), "tutor-data", "learner-profile.md"));
  } finally {
    if (previous === undefined) delete process.env.PI_TUTOR_DIR;
    else process.env.PI_TUTOR_DIR = previous;
  }
});

test("the profile lives in ~/.oh-my-tutor unless an override or a pre-rename profile exists", () => {
  const keys = ["HOME", "OH_MY_TUTOR_DIR", "PI_TUTOR_DIR", "PI_CODING_AGENT_DIR"] as const;
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const home = mkdtempSync(join(tmpdir(), "oh-my-tutor-home-"));
  try {
    for (const key of keys) delete process.env[key];
    process.env.HOME = home;
    assert.equal(resolveLearnerProfilePath(), join(home, ".oh-my-tutor", "learner-profile.md"));

    // A profile from before the rename keeps working where it is.
    const legacy = join(home, ".pi", "agent", "pi-tutor");
    mkdirSync(legacy, { recursive: true });
    writeFileSync(join(legacy, "learner-profile.md"), "# Learner Profile\n");
    assert.equal(resolveLearnerProfilePath(), join(legacy, "learner-profile.md"));

    process.env.PI_TUTOR_DIR = "/tmp/old-name";
    assert.equal(resolveLearnerProfilePath(), "/tmp/old-name/learner-profile.md");
    process.env.OH_MY_TUTOR_DIR = "/tmp/new-name";
    assert.equal(resolveLearnerProfilePath(), "/tmp/new-name/learner-profile.md");
  } finally {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    rmSync(home, { recursive: true, force: true });
  }
});
