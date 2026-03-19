import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@mariozechner/pi-coding-agent";
import piTutorExtension from "../extensions/pi-tutor/index.ts";
import { renderLearnerProfileMarkdown, saveLearnerProfileMarkdown } from "../src/learner-profile.ts";
import {
  buildTrackContextPrompt,
  buildTrackCreationPrompt,
  extractRoadmapChecklistStats,
  matchTrackFromPrompt,
  renderProgressMarkdown,
  renderRoadmapMarkdown,
  renderTrackMarkdown,
  resolveTrackPaths,
  saveTrackMarkdownSet,
  slugifyTrackName,
} from "../src/tracks.ts";

type Handler = (event: unknown, ctx: ExtensionContext) => Promise<unknown> | unknown;
type CommandHandler = (args: string, ctx: ExtensionCommandContext) => Promise<void> | void;

function createTheme() {
  return {
    fg: (_color: string, text: string) => text,
    bold: (text: string) => text,
    italic: (text: string) => text,
    dim: (text: string) => text,
    strikethrough: (text: string) => text,
  };
}

function createMockContext() {
  const statuses: Array<{ key: string; value: string | undefined }> = [];
  const widgets: Array<{ key: string; value: string[] | undefined }> = [];

  const ctx = {
    ui: {
      theme: createTheme(),
      notify: () => {},
      setStatus: (key: string, value: string | undefined) => {
        statuses.push({ key, value });
      },
      setWidget: (key: string, value: string[] | undefined) => {
        widgets.push({ key, value });
      },
    },
    hasUI: true,
    cwd: "/tmp/project",
    sessionManager: {
      getBranch: () => [],
      getEntries: () => [],
    },
    modelRegistry: {},
    model: undefined,
    isIdle: () => true,
    abort: () => {},
    hasPendingMessages: () => false,
    shutdown: () => {},
    getContextUsage: () => undefined,
    compact: () => {},
    getSystemPrompt: () => "base system prompt",
    waitForIdle: async () => {},
    newSession: async () => ({ cancelled: false }),
    fork: async () => ({ cancelled: false }),
    navigateTree: async () => ({ cancelled: false }),
    switchSession: async () => ({ cancelled: false }),
    reload: async () => {},
  } as unknown as ExtensionCommandContext;

  return { ctx, statuses, widgets };
}

function createMockPi() {
  const events = new Map<string, Handler[]>();
  const commands = new Map<string, { handler: CommandHandler }>();

  const api = {
    on(event: string, handler: Handler) {
      const handlers = events.get(event) ?? [];
      handlers.push(handler);
      events.set(event, handlers);
    },
    registerCommand(name: string, options: { handler: CommandHandler }) {
      commands.set(name, options);
    },
    appendEntry() {},
    sendMessage() {},
  } as unknown as ExtensionAPI;

  return {
    api,
    commands,
    getSingleHandler(eventName: string) {
      const handlers = events.get(eventName) ?? [];
      assert.equal(handlers.length, 1, `expected exactly one ${eventName} handler`);
      return handlers[0];
    },
  };
}

test("track helpers create markdown-first self-contained directories", () => {
  assert.equal(slugifyTrackName("SQL Foundations"), "sql-foundations");
  assert.equal(slugifyTrackName("Rails / Hotwire Deep Dive"), "rails-hotwire-deep-dive");

  const paths = resolveTrackPaths("sql-foundations", "/tmp/pi-agent");
  assert.equal(paths.dir, "/tmp/pi-agent/pi-tutor/tracks/sql-foundations");
  assert.equal(paths.track, "/tmp/pi-agent/pi-tutor/tracks/sql-foundations/track.md");
  assert.equal(paths.project, "/tmp/pi-agent/pi-tutor/tracks/sql-foundations/project.md");
  assert.equal(paths.roadmap, "/tmp/pi-agent/pi-tutor/tracks/sql-foundations/roadmap.md");
  assert.equal(paths.progress, "/tmp/pi-agent/pi-tutor/tracks/sql-foundations/progress.md");
});

test("rendered progress markdown keeps next-step and reflection sections", () => {
  const progress = renderProgressMarkdown({
    title: "SQL Foundations",
    currentFocus: "JOINs",
    nextStep: "Practice LEFT JOIN filtering with three exercises.",
    completed: ["Basic SELECT queries"],
    reflections: ["JOIN direction still feels shaky."],
    blockers: ["LEFT JOIN filter placement confusion"],
    roadmapCompleted: 1,
    roadmapTotal: 4,
    updatedAt: "2026-03-17T18:00:00.000Z",
  });

  assert.match(progress, /# Progress — SQL Foundations/);
  assert.match(progress, /## Journey status/);
  assert.match(progress, /1\/4 \(25%\)/);
  assert.match(progress, /## Next step/);
  assert.match(progress, /Practice LEFT JOIN filtering/);
  assert.match(progress, /## Reflections/);
  assert.match(progress, /JOIN direction still feels shaky/);
});

test("extractRoadmapChecklistStats derives completion percentage from markdown checkboxes", () => {
  const stats = extractRoadmapChecklistStats(`## Exercises\n- [x] Finish lesson 1\n- [ ] Finish lesson 2\n- [ ] Finish lesson 3\n`);

  assert.equal(stats.completed, 1);
  assert.equal(stats.remaining, 2);
  assert.equal(stats.total, 3);
  assert.equal(stats.completionPercent, 33);
  assert.deepEqual(stats.completedItems, ["Finish lesson 1"]);
  assert.deepEqual(stats.remainingItems, ["Finish lesson 2", "Finish lesson 3"]);
});

test("matchTrackFromPrompt picks the right track from natural-language topic references", async () => {
  const agentDir = mkdtempSync(join(tmpdir(), "pi-tutor-agent-"));

  try {
    await saveTrackMarkdownSet(
      {
        slug: "sql-foundations",
        track: renderTrackMarkdown({
          title: "SQL Foundations",
          summary: "Learn SQL querying fundamentals and JOIN reasoning.",
          keywords: ["sql", "joins", "postgres"],
        }),
        roadmap: renderRoadmapMarkdown({
          title: "SQL Foundations",
          milestones: [
            {
              title: "JOIN fundamentals",
              outcomes: ["Understand INNER vs LEFT JOIN"],
              concepts: ["joins", "filter order"],
              exercises: ["Write three LEFT JOIN examples"],
            },
          ],
        }),
        progress: renderProgressMarkdown({
          title: "SQL Foundations",
          currentFocus: "LEFT JOIN semantics",
          nextStep: "Do one focused LEFT JOIN debugging session.",
          reflections: [],
          completed: [],
          blockers: [],
          updatedAt: "2026-03-17T18:00:00.000Z",
        }),
      },
      agentDir,
    );

    await saveTrackMarkdownSet(
      {
        slug: "rails-hotwire",
        track: renderTrackMarkdown({
          title: "Rails Hotwire",
          summary: "Build Rails apps with Turbo and Stimulus.",
          keywords: ["rails", "hotwire", "turbo"],
        }),
        roadmap: renderRoadmapMarkdown({
          title: "Rails Hotwire",
          milestones: [],
        }),
        progress: renderProgressMarkdown({
          title: "Rails Hotwire",
          currentFocus: "Turbo Frames",
          nextStep: "Build one CRUD screen with Turbo Frames.",
          reflections: [],
          completed: [],
          blockers: [],
          updatedAt: "2026-03-17T18:00:00.000Z",
        }),
      },
      agentDir,
    );

    const match = await matchTrackFromPrompt("I want to keep learning SQL joins and continue where I left off.", agentDir);

    assert.equal(match?.slug, "sql-foundations");
    assert.match(match?.trackMarkdown ?? "", /SQL Foundations/);
  } finally {
    rmSync(agentDir, { recursive: true, force: true });
  }
});

test("buildTrackContextPrompt includes roadmap, progress, next step, and update instructions", () => {
  const prompt = buildTrackContextPrompt({
    slug: "sql-foundations",
    dir: "/tmp/pi-agent/pi-tutor/tracks/sql-foundations",
    trackPath: "/tmp/pi-agent/pi-tutor/tracks/sql-foundations/track.md",
    projectPath: "/tmp/pi-agent/pi-tutor/tracks/sql-foundations/project.md",
    roadmapPath: "/tmp/pi-agent/pi-tutor/tracks/sql-foundations/roadmap.md",
    progressPath: "/tmp/pi-agent/pi-tutor/tracks/sql-foundations/progress.md",
    trackMarkdown: "# Track: SQL Foundations\n",
    projectMarkdown: "# Project Brief — SQL Foundations\n",
    roadmapMarkdown: "# Roadmap — SQL Foundations\n## Milestone 1\n- [x] Exercise 1\n- [ ] Exercise 2\n",
    progressMarkdown: "# Progress — SQL Foundations\n## Next step\nPractice LEFT JOIN filtering.\n",
  });

  assert.match(prompt, /Matched learning track: sql-foundations/);
  assert.match(prompt, /progress\.md/);
  assert.match(prompt, /roadmap\.md/);
  assert.match(prompt, /project\.md/);
  assert.match(prompt, /Checklist snapshot/i);
  assert.match(prompt, /Roadmap tasks complete: 1\/2 \(50%\)/i);
  assert.match(prompt, /Update progress\.md after meaningful completions or reflections/i);
  assert.match(prompt, /Next step/i);
});

test("buildTrackContextPrompt explicitly covers reflect and next-step updates without hidden state", () => {
  const prompt = buildTrackContextPrompt({
    slug: "sql-foundations",
    dir: "/tmp/pi-agent/pi-tutor/tracks/sql-foundations",
    trackPath: "/tmp/pi-agent/pi-tutor/tracks/sql-foundations/track.md",
    projectPath: "/tmp/pi-agent/pi-tutor/tracks/sql-foundations/project.md",
    roadmapPath: "/tmp/pi-agent/pi-tutor/tracks/sql-foundations/roadmap.md",
    progressPath: "/tmp/pi-agent/pi-tutor/tracks/sql-foundations/progress.md",
    trackMarkdown: "# Track: SQL Foundations\n",
    projectMarkdown: "# Project Brief — SQL Foundations\n",
    roadmapMarkdown: "# Roadmap — SQL Foundations\n## Milestone 1\n- [x] Exercise 1\n- [ ] Exercise 2\n",
    progressMarkdown: "# Progress — SQL Foundations\n## Next step\nPractice LEFT JOIN filtering.\n",
  });

  assert.match(prompt, /reflect/i);
  assert.match(prompt, /what to do next/i);
  assert.match(prompt, /hidden active-track state/i);
});

test("buildTrackCreationPrompt keeps new tracks markdown-first and topic-named", () => {
  const prompt = buildTrackCreationPrompt("/tmp/pi-agent/pi-tutor/tracks");

  assert.match(prompt, /markdown-first/i);
  assert.match(prompt, /hidden active-track state/i);
  assert.match(prompt, /name the topic clearly/i);
  assert.match(prompt, /track\.md/);
  assert.match(prompt, /project\.md/);
  assert.match(prompt, /roadmap\.md/);
  assert.match(prompt, /checkbox/i);
  assert.match(prompt, /progress\.md/);
  assert.match(prompt, /Journey status/i);
});

test("extension injects matched track context for new sessions that name a saved topic", async () => {
  const mockPi = createMockPi();
  piTutorExtension(mockPi.api);

  const sessionStart = mockPi.getSingleHandler("session_start");
  const beforeAgentStart = mockPi.getSingleHandler("before_agent_start");
  const tutorCommand = mockPi.commands.get("tutor");
  const agentDir = mkdtempSync(join(tmpdir(), "pi-tutor-agent-"));
  const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = agentDir;

  try {
    await saveLearnerProfileMarkdown(
      renderLearnerProfileMarkdown({
        currentLevel: "intermediate",
        preferredStackOrDomain: "SQL, PostgreSQL",
        projectBasedLearning: true,
        attemptFirst: true,
        preferHintsBeforeSolutions: true,
        conciseExplanations: true,
        reflectionCheckpoints: true,
        learningGoals: ["Get comfortable with SQL joins"],
        primaryTopics: ["SQL", "PostgreSQL"],
        notes: ["Preferred help style: concise hints"],
        createdAt: "2026-03-17T19:00:00.000Z",
        updatedAt: "2026-03-17T19:00:00.000Z",
      }),
      agentDir,
    );

    await saveTrackMarkdownSet(
      {
        slug: "sql-foundations",
        track: renderTrackMarkdown({
          title: "SQL Foundations",
          summary: "Learn SQL querying fundamentals and JOIN reasoning.",
          keywords: ["sql", "joins", "postgres"],
        }),
        roadmap: renderRoadmapMarkdown({
          title: "SQL Foundations",
          milestones: [
            {
              title: "JOIN fundamentals",
              outcomes: ["Understand INNER vs LEFT JOIN"],
              concepts: ["joins", "filter order"],
              exercises: ["Write three LEFT JOIN examples"],
            },
          ],
        }),
        progress: renderProgressMarkdown({
          title: "SQL Foundations",
          currentFocus: "LEFT JOIN semantics",
          nextStep: "Practice LEFT JOIN filtering with one debugging exercise.",
          reflections: ["I still confuse WHERE vs ON filtering."],
          completed: ["Basic SELECT queries"],
          blockers: ["LEFT JOIN filter placement"],
          updatedAt: "2026-03-17T19:00:00.000Z",
        }),
      },
      agentDir,
    );

    const { ctx } = createMockContext();
    await sessionStart({ type: "session_start" }, ctx);
    await tutorCommand?.handler("on", ctx);

    const result = await beforeAgentStart(
      { systemPrompt: "Base prompt", prompt: "I want to keep learning SQL joins today." },
      ctx,
    );
    const prompt = String((result as { systemPrompt?: string } | undefined)?.systemPrompt);

    assert.match(prompt, /Matched learning track: sql-foundations/);
    assert.match(prompt, /Roadmap — SQL Foundations/);
    assert.match(prompt, /Progress — SQL Foundations/);
    assert.match(prompt, /Checklist snapshot/);
    assert.match(prompt, /Practice LEFT JOIN filtering with one debugging exercise/);
    assert.match(prompt, /Update progress\.md after meaningful completions or reflections/i);
  } finally {
    if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
    rmSync(agentDir, { recursive: true, force: true });
  }
});

test("extension injects track-creation instructions when no saved track matches the requested topic", async () => {
  const mockPi = createMockPi();
  piTutorExtension(mockPi.api);

  const sessionStart = mockPi.getSingleHandler("session_start");
  const beforeAgentStart = mockPi.getSingleHandler("before_agent_start");
  const tutorCommand = mockPi.commands.get("tutor");
  const agentDir = mkdtempSync(join(tmpdir(), "pi-tutor-agent-"));
  const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = agentDir;

  try {
    await saveLearnerProfileMarkdown(
      renderLearnerProfileMarkdown({
        currentLevel: "intermediate",
        preferredStackOrDomain: "Backend, SQL",
        projectBasedLearning: true,
        attemptFirst: true,
        preferHintsBeforeSolutions: true,
        conciseExplanations: true,
        reflectionCheckpoints: true,
        learningGoals: ["Get better at backend performance topics"],
        primaryTopics: ["Backend", "SQL"],
        notes: ["Preferred help style: concise hints"],
        createdAt: "2026-03-17T19:30:00.000Z",
        updatedAt: "2026-03-17T19:30:00.000Z",
      }),
      agentDir,
    );

    const { ctx } = createMockContext();
    await sessionStart({ type: "session_start" }, ctx);
    await tutorCommand?.handler("on", ctx);

    const result = await beforeAgentStart(
      { systemPrompt: "Base prompt", prompt: "I want to keep learning Redis caching patterns." },
      ctx,
    );
    const prompt = String((result as { systemPrompt?: string } | undefined)?.systemPrompt);

    assert.match(prompt, /No matching learning track was found/i);
    assert.match(prompt, /create a new self-contained track directory/i);
    assert.match(prompt, /track\.md/);
    assert.match(prompt, /roadmap\.md/);
    assert.match(prompt, /progress\.md/);
    assert.match(prompt, /Reflections/);
    assert.match(prompt, /Next step/);
  } finally {
    if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
    rmSync(agentDir, { recursive: true, force: true });
  }
});
