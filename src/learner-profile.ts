import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { getAgentDir } from "@mariozechner/pi-coding-agent";

export interface LearnerProfileMarkdownInput {
  learnerId?: string;
  currentLevel: string;
  preferredStackOrDomain: string;
  projectBasedLearning: boolean;
  attemptFirst: boolean;
  preferHintsBeforeSolutions: boolean;
  conciseExplanations: boolean;
  reflectionCheckpoints: boolean;
  learningGoals: string[];
  primaryTopics: string[];
  strengths?: string[];
  stickingPoints?: string[];
  notes?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export const LEARNER_PROFILE_FILENAME = "learner-profile.md";

export const LEARNER_PROFILE_TEMPLATE = `# Learner Profile

## Snapshot
- Learner ID: default
- Current level: <beginner | intermediate | advanced>
- Preferred stack/topic: <stack, language, framework, or domain>
- Project-based learning: <yes|no>
- Attempt-first: <yes|no>
- Hints before full solutions: <yes|no>
- Concise explanations: <yes|no>
- Reflection checkpoints: <yes|no>
- Created at: <ISO timestamp>
- Updated at: <ISO timestamp>

## Learning goals
- <goal 1>

## Primary topics
- <topic 1>

## Strengths
- None recorded yet

## Sticking points
- None recorded yet

## Notes
- Preferred help style: <free-form description>
`;

function yesNo(value: boolean): string {
  return value ? "yes" : "no";
}

function renderListSection(title: string, items: string[], emptyLabel: string): string[] {
  const lines = [`## ${title}`];
  if (items.length === 0) {
    lines.push(`- ${emptyLabel}`);
  } else {
    lines.push(...items.map((item) => `- ${item}`));
  }
  return lines;
}

export function resolveTutorDataDir(agentDir = getAgentDir()): string {
  return join(agentDir, "pi-tutor");
}

export function resolveLearnerProfilePath(agentDir = getAgentDir()): string {
  return join(resolveTutorDataDir(agentDir), LEARNER_PROFILE_FILENAME);
}

export function getLearnerProfileTemplate(): string {
  return LEARNER_PROFILE_TEMPLATE;
}

export function renderLearnerProfileMarkdown(input: LearnerProfileMarkdownInput): string {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const updatedAt = input.updatedAt ?? createdAt;
  const learnerId = input.learnerId ?? "default";

  const lines = [
    "# Learner Profile",
    "",
    "## Snapshot",
    `- Learner ID: ${learnerId}`,
    `- Current level: ${input.currentLevel}`,
    `- Preferred stack/topic: ${input.preferredStackOrDomain}`,
    `- Project-based learning: ${yesNo(input.projectBasedLearning)}`,
    `- Attempt-first: ${yesNo(input.attemptFirst)}`,
    `- Hints before full solutions: ${yesNo(input.preferHintsBeforeSolutions)}`,
    `- Concise explanations: ${yesNo(input.conciseExplanations)}`,
    `- Reflection checkpoints: ${yesNo(input.reflectionCheckpoints)}`,
    `- Created at: ${createdAt}`,
    `- Updated at: ${updatedAt}`,
    "",
    ...renderListSection("Learning goals", input.learningGoals, "No goals recorded yet"),
    "",
    ...renderListSection("Primary topics", input.primaryTopics, "No topics recorded yet"),
    "",
    ...renderListSection("Strengths", input.strengths ?? [], "None recorded yet"),
    "",
    ...renderListSection("Sticking points", input.stickingPoints ?? [], "None recorded yet"),
    "",
    ...renderListSection("Notes", input.notes ?? [], "No notes recorded yet"),
    "",
  ];

  return lines.join("\n");
}

export async function loadLearnerProfileMarkdown(agentDir = getAgentDir()): Promise<string | undefined> {
  try {
    return await readFile(resolveLearnerProfilePath(agentDir), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return undefined;
    }
    return undefined;
  }
}

export async function saveLearnerProfileMarkdown(markdown: string, agentDir = getAgentDir()): Promise<string> {
  const profilePath = resolveLearnerProfilePath(agentDir);
  await mkdir(dirname(profilePath), { recursive: true });
  const normalized = markdown.endsWith("\n") ? markdown : `${markdown}\n`;
  await writeFile(profilePath, normalized, "utf8");
  return profilePath;
}

export function buildLearnerProfilePrompt(markdown: string): string {
  return [
    "Learner profile markdown is the source of truth for tutoring decisions.",
    "Use it to adapt pacing, explanation depth, hint style, and project framing.",
    "If the user explicitly updates preferences, update the markdown file before relying on the new state.",
    markdown.trim(),
  ].join("\n\n");
}

export function buildConversationalOnboardingPrompt(profilePath: string): string {
  return [
    `Tutor onboarding is not complete yet because no learner profile exists at ${profilePath}.`,
    "Do onboarding in normal conversation, not modal UI.",
    "Collect these facts from the learner:",
    "- what they want to learn",
    "- desired stack/topic",
    "- current level",
    "- preferred help style",
    "- whether project-based learning is desired",
    "Rules:",
    "- Ask only the minimum follow-up questions needed.",
    "- If the current user message already contains enough detail, create the file immediately instead of asking another question.",
    `- Create or update ${profilePath} with the write tool using this exact markdown structure:`,
    LEARNER_PROFILE_TEMPLATE.trim(),
    "After writing the file, briefly confirm what you captured and continue tutoring.",
  ].join("\n");
}

export function buildOnboardingKickoffMessage(profilePath: string): string {
  return [
    "Tutor mode is enabled, but no learner profile exists yet.",
    "Start conversational onboarding now.",
    "Ask me to describe what I want to learn, my desired stack/topic, my current level, my preferred help style, and whether I want project-based learning.",
    `When you have enough information, create ${profilePath} as a markdown learner profile.`,
  ].join(" ");
}
