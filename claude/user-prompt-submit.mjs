// Claude Code UserPromptSubmit hook: the Claude counterpart of extensions/oh-my-tutor.
// It reuses the Pi extension's prompt builders. Node strips the TypeScript types on import (Node >= 22.18).
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { STATUSLINE_LAUNCHER, sessionFlagPath } from "./paths.mjs";
import { buildTutorModeSystemPrompt, parseTutorCommand } from "../extensions/oh-my-tutor/index.ts";
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
const flagPath = sessionFlagPath(sessionId);
let enabled = await stat(flagPath).then(() => true, () => false);

const reply = (output) => process.stdout.write(JSON.stringify(output));
const addContext = (additionalContext) =>
  reply({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext } });

// Plugin commands arrive as "/tutor:<name> args"; accept the bare "/<name>" form too.
// "/" is a Claude Code command; "$" is a Codex skill mention, the closest thing Codex has to a plugin command.
const [, sigil, command, args = ""] = prompt.trim().match(/^([/$@])(?:tutor:)?([\w-]+)\s*([\s\S]*)$/) ?? [];
// Answer in the syntax the user typed: "@tutor on" / "$hint" in Codex, "/tutor:hint" in Claude Code.
const cmd = (name) => (sigil === "/" ? `/tutor:${name}` : `${sigil}${name}`);
const profilePath = resolveLearnerProfilePath();

if (command === "tutor") {
  const action = parseTutorCommand(args);
  if (!action) {
    reply({ decision: "block", reason: `Usage: ${cmd("tutor")} on | off | status` });
  } else {
    if (action === "on") {
      await mkdir(dirname(flagPath), { recursive: true });
      await writeFile(flagPath, new Date().toISOString());
      // A stable launcher for the statusLine setting; the plugin's own path changes with each version.
      await writeFile(STATUSLINE_LAUNCHER, `import ${JSON.stringify(new URL("statusline.mjs", import.meta.url).href)};\n`);
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
  reply({ decision: "block", reason: `Tutor mode is off. Run ${cmd("tutor")} on before using ${cmd(command)}.` });
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
