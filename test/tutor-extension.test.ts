import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext } from "@mariozechner/pi-coding-agent";
import piTutorExtension, {
  TUTOR_MODE_CUSTOM_TYPE,
  buildTutorModeSystemPrompt,
  parseTutorCommand,
  reconstructTutorModeState,
} from "../extensions/pi-tutor/index.ts";
import {
  renderLearnerProfileMarkdown,
  resolveLearnerProfilePath,
  saveLearnerProfileMarkdown,
} from "../src/learner-profile.ts";

type Handler = (event: unknown, ctx: ExtensionContext) => Promise<unknown> | unknown;
type CommandHandler = (args: string, ctx: ExtensionCommandContext) => Promise<void> | void;

type EntryLike = {
  type: string;
  customType?: string;
  data?: unknown;
};

function createTheme() {
  return {
    fg: (_color: string, text: string) => text,
    bold: (text: string) => text,
    italic: (text: string) => text,
    dim: (text: string) => text,
    strikethrough: (text: string) => text,
  };
}

function createMockContext(options?: {
  branch?: EntryLike[];
  inputs?: Array<string | undefined>;
  confirms?: boolean[];
}) {
  const branch = options?.branch ?? [];
  const inputQueue = [...(options?.inputs ?? [])];
  const confirmQueue = [...(options?.confirms ?? [])];
  const notifications: Array<{ message: string; level?: string }> = [];
  const statuses: Array<{ key: string; value: string | undefined }> = [];
  const widgets: Array<{ key: string; value: string[] | undefined }> = [];
  const inputCalls: Array<{ title: string; placeholder?: string }> = [];
  const confirmCalls: Array<{ title: string; message: string }> = [];

  const ctx = {
    ui: {
      theme: createTheme(),
      notify: (message: string, level?: string) => {
        notifications.push({ message, level });
      },
      setStatus: (key: string, value: string | undefined) => {
        statuses.push({ key, value });
      },
      setWidget: (key: string, value: string[] | undefined) => {
        widgets.push({ key, value });
      },
      input: async (title: string, placeholder?: string) => {
        inputCalls.push({ title, placeholder });
        return inputQueue.shift();
      },
      confirm: async (title: string, message: string) => {
        confirmCalls.push({ title, message });
        return confirmQueue.shift() ?? false;
      },
    },
    hasUI: true,
    cwd: "/tmp/project",
    sessionManager: {
      getBranch: () => branch,
      getEntries: () => branch,
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

  return { ctx, notifications, statuses, widgets, inputCalls, confirmCalls };
}

function createMockPi() {
  const commands = new Map<string, { handler: CommandHandler }>();
  const events = new Map<string, Handler[]>();
  const appendedEntries: Array<{ customType: string; data: unknown }> = [];
  const sentMessages: Array<{
    message: { customType: string; content: string | unknown[]; display: boolean; details?: unknown };
    options?: { triggerTurn?: boolean; deliverAs?: "steer" | "followUp" | "nextTurn" };
  }> = [];

  const api = {
    on(event: string, handler: Handler) {
      const handlers = events.get(event) ?? [];
      handlers.push(handler);
      events.set(event, handlers);
    },
    registerCommand(name: string, options: { handler: CommandHandler }) {
      commands.set(name, options);
    },
    appendEntry(customType: string, data?: unknown) {
      appendedEntries.push({ customType, data });
    },
    sendMessage(
      message: { customType: string; content: string | unknown[]; display: boolean; details?: unknown },
      options?: { triggerTurn?: boolean; deliverAs?: "steer" | "followUp" | "nextTurn" },
    ) {
      sentMessages.push({ message, options });
    },
  } as unknown as ExtensionAPI;

  return {
    api,
    commands,
    appendedEntries,
    sentMessages,
    getSingleHandler(eventName: string) {
      const handlers = events.get(eventName) ?? [];
      assert.equal(handlers.length, 1, `expected exactly one ${eventName} handler`);
      return handlers[0];
    },
  };
}

test("parseTutorCommand accepts on, off, and status", () => {
  assert.equal(parseTutorCommand("on"), "on");
  assert.equal(parseTutorCommand(" OFF  "), "off");
  assert.equal(parseTutorCommand("status"), "status");
  assert.equal(parseTutorCommand(""), undefined);
  assert.equal(parseTutorCommand("toggle"), undefined);
});

test("reconstructTutorModeState restores the latest tutor custom entry on the active branch", () => {
  const state = reconstructTutorModeState([
    { type: "custom", customType: "something-else", data: { enabled: true } },
    {
      type: "custom",
      customType: TUTOR_MODE_CUSTOM_TYPE,
      data: { version: 1, enabled: false, updatedAt: "2026-03-17T09:00:00.000Z" },
    },
    {
      type: "custom",
      customType: TUTOR_MODE_CUSTOM_TYPE,
      data: { version: 1, enabled: true, updatedAt: "2026-03-17T10:00:00.000Z" },
    },
  ]);

  assert.deepEqual(state, {
    version: 1,
    enabled: true,
    updatedAt: "2026-03-17T10:00:00.000Z",
  });
});

test("buildTutorModeSystemPrompt appends narrow tutor-mode guidance", () => {
  const prompt = buildTutorModeSystemPrompt("Base prompt");

  assert.match(prompt, /^Base prompt/);
  assert.match(prompt, /attempt-first/i);
  assert.match(prompt, /hints before full solutions/i);
  assert.match(prompt, /concise/i);
});

test("extension registers tutor command and tutor-mode hooks", () => {
  const mockPi = createMockPi();

  piTutorExtension(mockPi.api);

  assert.equal(mockPi.commands.has("tutor"), true);
  mockPi.getSingleHandler("input");
  mockPi.getSingleHandler("before_agent_start");
  mockPi.getSingleHandler("session_start");
  mockPi.getSingleHandler("session_switch");
  mockPi.getSingleHandler("session_fork");
  mockPi.getSingleHandler("session_tree");
});

test("input guard blocks tutor prompt templates while tutor mode is off", async () => {
  const mockPi = createMockPi();
  piTutorExtension(mockPi.api);

  const inputHandler = mockPi.getSingleHandler("input");
  const { ctx, notifications } = createMockContext();

  const result = await inputHandler({ text: "/hint LEFT JOIN filtering", source: "interactive" }, ctx);

  assert.deepEqual(result, { action: "handled" });
  assert.match(notifications.at(-1)?.message ?? "", /Tutor mode is off/i);
  assert.equal(mockPi.sentMessages.length, 1);
  assert.equal(mockPi.sentMessages[0]?.options?.triggerTurn, false);
  assert.match(String(mockPi.sentMessages[0]?.message.content), /\/tutor on/);
  assert.match(String(mockPi.sentMessages[0]?.message.content), /\/hint/);
});

test("input guard blocks tutor skill commands while tutor mode is off", async () => {
  const mockPi = createMockPi();
  piTutorExtension(mockPi.api);

  const inputHandler = mockPi.getSingleHandler("input");
  const { ctx, notifications } = createMockContext();

  const result = await inputHandler({ text: "/skill:tutor-implementation help me with joins", source: "interactive" }, ctx);

  assert.deepEqual(result, { action: "handled" });
  assert.match(notifications.at(-1)?.message ?? "", /Tutor mode is off/i);
  assert.match(String(mockPi.sentMessages[0]?.message.content), /\/tutor on/);
  assert.match(String(mockPi.sentMessages[0]?.message.content), /\/skill:tutor-implementation/);
});

test("input guard allows tutor workflows when tutor mode is on", async () => {
  const mockPi = createMockPi();
  piTutorExtension(mockPi.api);

  const inputHandler = mockPi.getSingleHandler("input");
  const sessionStart = mockPi.getSingleHandler("session_start");
  const { ctx } = createMockContext({
    branch: [
      {
        type: "custom",
        customType: TUTOR_MODE_CUSTOM_TYPE,
        data: { version: 1, enabled: true, updatedAt: "2026-03-17T22:00:00.000Z" },
      },
    ],
  });

  await sessionStart({ type: "session_start" }, ctx);
  const result = await inputHandler({ text: "/hint LEFT JOIN filtering", source: "interactive" }, ctx);

  assert.deepEqual(result, { action: "continue" });
  assert.equal(mockPi.sentMessages.length, 0);
});

test("/tutor on persists enabled state, updates UI, and queues conversational onboarding when the profile markdown is missing", async () => {
  const mockPi = createMockPi();
  piTutorExtension(mockPi.api);

  const tutorCommand = mockPi.commands.get("tutor");
  const beforeAgentStart = mockPi.getSingleHandler("before_agent_start");
  const { ctx, notifications, statuses, widgets, inputCalls, confirmCalls } = createMockContext();
  const agentDir = mkdtempSync(join(tmpdir(), "pi-tutor-agent-"));
  const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = agentDir;

  try {
    await tutorCommand?.handler("on", ctx);

    assert.equal(mockPi.appendedEntries.length, 1);
    assert.equal(mockPi.appendedEntries[0]?.customType, TUTOR_MODE_CUSTOM_TYPE);
    assert.equal((mockPi.appendedEntries[0]?.data as { enabled: boolean }).enabled, true);
    assert.match(String((mockPi.appendedEntries[0]?.data as { updatedAt: string }).updatedAt), /^\d{4}-\d{2}-\d{2}T/);

    assert.match(notifications.at(-1)?.message ?? "", /enabled/i);
    assert.equal(statuses.at(-1)?.value, "📚 tutor mode enabled");
    assert.equal(widgets.at(-1)?.value, undefined);

    assert.equal(inputCalls.length, 0);
    assert.equal(confirmCalls.length, 0);
    assert.equal(mockPi.sentMessages.length, 1);
    assert.equal(mockPi.sentMessages[0]?.options?.triggerTurn, true);
    assert.match(String(mockPi.sentMessages[0]?.message.content), /conversational onboarding/i);
    assert.match(String(mockPi.sentMessages[0]?.message.content), /learner profile/i);

    const result = await beforeAgentStart({ systemPrompt: "Base prompt" }, ctx);
    const prompt = String((result as { systemPrompt?: string } | undefined)?.systemPrompt);
    assert.match(prompt, /normal conversation/i);
    assert.match(prompt, /learner-profile\.md/);
    assert.match(prompt, /write tool/i);
  } finally {
    if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
    rmSync(agentDir, { recursive: true, force: true });
  }
});

test("existing learner profile markdown is reused without repeating onboarding and changes tutor guidance", async () => {
  const mockPi = createMockPi();
  piTutorExtension(mockPi.api);

  const tutorCommand = mockPi.commands.get("tutor");
  const sessionStart = mockPi.getSingleHandler("session_start");
  const beforeAgentStart = mockPi.getSingleHandler("before_agent_start");
  const agentDir = mkdtempSync(join(tmpdir(), "pi-tutor-agent-"));
  const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = agentDir;

  try {
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
      createdAt: "2026-03-17T15:00:00.000Z",
      updatedAt: "2026-03-17T15:00:00.000Z",
    });
    await saveLearnerProfileMarkdown(markdown, agentDir);

    const { ctx, inputCalls, confirmCalls } = createMockContext({
      branch: [
        {
          type: "custom",
          customType: TUTOR_MODE_CUSTOM_TYPE,
          data: { version: 1, enabled: true, updatedAt: "2026-03-17T15:00:00.000Z" },
        },
      ],
    });

    await sessionStart({ type: "session_start" }, ctx);
    await tutorCommand?.handler("on", ctx);

    assert.equal(inputCalls.length, 0);
    assert.equal(confirmCalls.length, 0);
    assert.equal(mockPi.sentMessages.length, 0);

    const injected = await beforeAgentStart({ systemPrompt: "Base prompt" }, ctx);
    const prompt = String((injected as { systemPrompt?: string } | undefined)?.systemPrompt);
    assert.match(prompt, /Learner profile markdown is the source of truth/i);
    assert.match(prompt, /Current level: intermediate/);
    assert.match(prompt, /Preferred stack\/topic: React, TypeScript/);
    assert.match(prompt, /Concise explanations: no/);
    assert.match(prompt, /Reflection checkpoints: yes/);
  } finally {
    if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
    rmSync(agentDir, { recursive: true, force: true });
  }
});

test("/tutor on treats the presence of learner-profile.md as onboarding completion", async () => {
  const mockPi = createMockPi();
  piTutorExtension(mockPi.api);

  const tutorCommand = mockPi.commands.get("tutor");
  const agentDir = mkdtempSync(join(tmpdir(), "pi-tutor-agent-"));
  const previousAgentDir = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = agentDir;

  try {
    await saveLearnerProfileMarkdown(
      renderLearnerProfileMarkdown({
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
        createdAt: "2026-03-17T16:00:00.000Z",
        updatedAt: "2026-03-17T16:00:00.000Z",
      }),
      agentDir,
    );

    const { ctx } = createMockContext();
    await tutorCommand?.handler("on", ctx);

    assert.equal(mockPi.sentMessages.length, 0);
    assert.equal(resolveLearnerProfilePath(agentDir).endsWith("learner-profile.md"), true);
  } finally {
    if (previousAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previousAgentDir;
    rmSync(agentDir, { recursive: true, force: true });
  }
});

test("session_start restores persisted state and /tutor off clears the widget", async () => {
  const mockPi = createMockPi();
  piTutorExtension(mockPi.api);

  const sessionStart = mockPi.getSingleHandler("session_start");
  const beforeAgentStart = mockPi.getSingleHandler("before_agent_start");
  const tutorCommand = mockPi.commands.get("tutor");
  const { ctx, notifications, statuses, widgets } = createMockContext({
    branch: [
      {
        type: "custom",
        customType: TUTOR_MODE_CUSTOM_TYPE,
        data: { version: 1, enabled: true, updatedAt: "2026-03-17T12:00:00.000Z" },
      },
    ],
  });

  await sessionStart({ type: "session_start" }, ctx);
  assert.equal(statuses.at(-1)?.value, "📚 tutor mode enabled");
  assert.equal(widgets.at(-1)?.value, undefined);

  const injected = await beforeAgentStart({ systemPrompt: "Base prompt" }, ctx);
  assert.match(String((injected as { systemPrompt?: string } | undefined)?.systemPrompt), /hints before full solutions/i);

  await tutorCommand?.handler("off", ctx);
  assert.match(notifications.at(-1)?.message ?? "", /disabled/i);
  assert.equal(statuses.at(-1)?.value, undefined);
  assert.equal(widgets.at(-1)?.value, undefined);
});
