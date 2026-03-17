import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
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
