// Claude Code UserPromptSubmit hook: the Claude counterpart of extensions/pi-tutor.
// It reuses the Pi extension's prompt builders. Node strips the TypeScript types on import (Node >= 22.18).
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildTutorModeSystemPrompt, parseTutorCommand } from "../extensions/pi-tutor/index.ts";
import {
  buildConversationalOnboardingPrompt,
  buildLearnerProfilePrompt,
  buildOnboardingKickoffMessage,
  loadLearnerProfileMarkdown,
  resolveLearnerProfilePath,
} from "../src/learner-profile.ts";
import {
  buildTrackContextPrompt,
  buildTrackCreationPrompt,
  matchTrackFromPrompt,
  resolveProjectRoot,
  resolveTracksRoot,
  shouldConsiderTrack,
} from "../src/tracks.ts";

const WORKFLOWS = new Set(["start_tutoring", "hint", "reflect", "next_step", "tutor-implementation", "tutor-learn-topic"]);

let raw = "";
for await (const chunk of process.stdin) raw += chunk;
const { prompt = "", session_id: sessionId = "default", cwd = process.cwd() } = JSON.parse(raw);

// Tutor mode is per session, like in Pi. shortcut: one tiny file per session is never cleaned up; prune if it ever matters.
const flagPath = join(process.env.CLAUDE_PLUGIN_DATA || join(tmpdir(), "pi-tutor"), "sessions", sessionId.replace(/[^\w-]/g, "_"));
let enabled = await stat(flagPath).then(() => true, () => false);

const reply = (output) => process.stdout.write(JSON.stringify(output));
const addContext = (additionalContext) =>
  reply({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext } });

// Plugin commands arrive as "/pi-tutor:<name> args"; accept the bare "/<name>" form too.
const [, command, args = ""] = prompt.trim().match(/^\/(?:pi-tutor:)?([\w-]+)\s*([\s\S]*)$/) ?? [];
const profilePath = resolveLearnerProfilePath();

if (command === "tutor") {
  const action = parseTutorCommand(args);
  if (!action) {
    reply({ decision: "block", reason: "Usage: /pi-tutor:tutor on | off | status" });
  } else {
    if (action === "on") {
      await mkdir(join(flagPath, ".."), { recursive: true });
      await writeFile(flagPath, new Date().toISOString());
      enabled = true;
    } else if (action === "off") {
      await rm(flagPath, { force: true });
      enabled = false;
    }
    const profile = await loadLearnerProfileMarkdown();
    const lines = [
      enabled
        ? "Tutor mode is ON. Expect attempt-first guidance, hints before full solutions, and concise teaching notes."
        : "Tutor mode is OFF. Standard coding-assistant behavior is active.",
      profile ? `Learner profile loaded from ${profilePath}.` : `No learner profile exists yet at ${profilePath}.`,
    ];
    if (enabled && !profile) {
      lines.push(buildOnboardingKickoffMessage(profilePath), buildConversationalOnboardingPrompt(profilePath));
    }
    addContext(lines.join("\n\n"));
  }
} else if (WORKFLOWS.has(command) && !enabled) {
  reply({ decision: "block", reason: `Tutor mode is off. Run /pi-tutor:tutor on before using /pi-tutor:${command}.` });
} else if (enabled) {
  const profile = await loadLearnerProfileMarkdown();
  const parts = [buildTutorModeSystemPrompt("").trim()];
  if (!profile) {
    parts.push(buildConversationalOnboardingPrompt(profilePath));
  } else {
    parts.push(buildLearnerProfilePrompt(profile));
    const projectRoot = resolveProjectRoot(cwd);
    const track = await matchTrackFromPrompt(prompt, projectRoot);
    if (track) parts.push(buildTrackContextPrompt(track));
    else if (shouldConsiderTrack(prompt)) parts.push(buildTrackCreationPrompt(resolveTracksRoot(projectRoot)));
  }
  addContext(parts.join("\n\n"));
}
