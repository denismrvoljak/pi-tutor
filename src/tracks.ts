import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { getAgentDir } from "@mariozechner/pi-coding-agent";
import { resolveTutorDataDir } from "./learner-profile.ts";

export const TRACKS_DIRNAME = "tracks";
export const TRACK_FILENAME = "track.md";
export const PROJECT_FILENAME = "project.md";
export const ROADMAP_FILENAME = "roadmap.md";
export const PROGRESS_FILENAME = "progress.md";

export interface TrackPaths {
  dir: string;
  track: string;
  project: string;
  roadmap: string;
  progress: string;
}

export interface TrackMarkdownSetInput {
  slug: string;
  track: string;
  project?: string;
  roadmap: string;
  progress: string;
}

export interface TrackMarkdownSet {
  slug: string;
  dir: string;
  trackPath: string;
  projectPath: string;
  roadmapPath: string;
  progressPath: string;
  trackMarkdown: string;
  projectMarkdown: string;
  roadmapMarkdown: string;
  progressMarkdown: string;
}

export interface RenderTrackMarkdownInput {
  title: string;
  summary: string;
  type?: string;
  status?: string;
  keywords?: string[];
  relatedGoals?: string[];
  notes?: string[];
}

export interface RenderProjectMarkdownInput {
  title: string;
  goal: string;
  learnerOutcome: string;
  scope?: string[];
  acceptanceCriteria?: string[];
  constraints?: string[];
  deliverables?: string[];
}

export interface RenderRoadmapMilestoneInput {
  title: string;
  outcomes?: string[];
  concepts?: string[];
  exercises?: string[];
}

export interface RenderRoadmapMarkdownInput {
  title: string;
  milestones: RenderRoadmapMilestoneInput[];
}

export interface RenderProgressMarkdownInput {
  title: string;
  currentFocus: string;
  nextStep: string;
  completed?: string[];
  reflections?: string[];
  blockers?: string[];
  roadmapCompleted?: number;
  roadmapTotal?: number;
  updatedAt?: string;
}

export interface RoadmapChecklistStats {
  total: number;
  completed: number;
  remaining: number;
  completionPercent: number;
  completedItems: string[];
  remainingItems: string[];
}

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "the",
  "to",
  "my",
  "i",
  "we",
  "you",
  "keep",
  "learning",
  "learn",
  "continue",
  "resume",
  "track",
  "topic",
  "project",
  "specific",
  "want",
  "today",
  "with",
  "for",
  "from",
  "into",
  "about",
]);

export function resolveTracksRoot(agentDir = getAgentDir()): string {
  return join(resolveTutorDataDir(agentDir), TRACKS_DIRNAME);
}

export function slugifyTrackName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/--+/g, "-");

  return slug || "track";
}

export function resolveTrackPaths(slug: string, agentDir = getAgentDir()): TrackPaths {
  const dir = join(resolveTracksRoot(agentDir), slug);
  return {
    dir,
    track: join(dir, TRACK_FILENAME),
    project: join(dir, PROJECT_FILENAME),
    roadmap: join(dir, ROADMAP_FILENAME),
    progress: join(dir, PROGRESS_FILENAME),
  };
}

function renderBulletSection(title: string, items: string[], emptyLabel: string): string[] {
  const lines = [`## ${title}`];
  if (items.length === 0) {
    lines.push(`- ${emptyLabel}`);
  } else {
    lines.push(...items.map((item) => `- ${item}`));
  }
  return lines;
}

export function renderTrackMarkdown(input: RenderTrackMarkdownInput): string {
  const lines = [
    `# Track: ${input.title}`,
    "",
    "## Summary",
    input.summary,
    "",
    "## Type",
    input.type ?? "topic",
    "",
    "## Status",
    input.status ?? "active",
    "",
    ...renderBulletSection("Keywords", input.keywords ?? [], "No keywords recorded yet"),
    "",
    ...renderBulletSection("Related learner goals", input.relatedGoals ?? [], "No related learner goals recorded yet"),
    "",
    ...renderBulletSection("Notes", input.notes ?? [], "No track-specific notes recorded yet"),
    "",
  ];

  return lines.join("\n");
}

export function renderProjectMarkdown(input: RenderProjectMarkdownInput): string {
  const lines = [
    `# Project Brief — ${input.title}`,
    "",
    "## Project goal",
    input.goal,
    "",
    "## Learner outcome",
    input.learnerOutcome,
    "",
    ...renderBulletSection("Scope", input.scope ?? [], "No scope details recorded yet"),
    "",
    ...renderBulletSection(
      "Acceptance criteria",
      input.acceptanceCriteria ?? [],
      "No acceptance criteria recorded yet",
    ),
    "",
    ...renderBulletSection("Constraints", input.constraints ?? [], "No constraints recorded yet"),
    "",
    ...renderBulletSection("Deliverables", input.deliverables ?? [], "No deliverables recorded yet"),
    "",
  ];

  return lines.join("\n");
}

export function renderRoadmapMarkdown(input: RenderRoadmapMarkdownInput): string {
  const lines = [`# Roadmap — ${input.title}`, "", "## Milestones"];

  if (input.milestones.length === 0) {
    lines.push("- No milestones recorded yet.", "");
    return lines.join("\n");
  }

  input.milestones.forEach((milestone, index) => {
    lines.push("", `### ${index + 1}. ${milestone.title}`, "");
    lines.push(...renderBulletSection("Outcomes", milestone.outcomes ?? [], "No outcomes recorded yet"));
    lines.push("");
    lines.push(...renderBulletSection("Concepts", milestone.concepts ?? [], "No concepts recorded yet"));
    lines.push("");
    const exercises = milestone.exercises ?? [];
    lines.push("## Exercises");
    if (exercises.length === 0) {
      lines.push("- [ ] No exercises recorded yet");
    } else {
      lines.push(...exercises.map((exercise) => `- [ ] ${exercise}`));
    }
  });

  lines.push("");
  return lines.join("\n");
}

export function extractRoadmapChecklistStats(roadmapMarkdown: string): RoadmapChecklistStats {
  const lines = roadmapMarkdown.split("\n");
  const checkedItems: string[] = [];
  const uncheckedItems: string[] = [];

  for (const line of lines) {
    const checkedMatch = line.match(/^\s*-\s*\[x\]\s+(.+)$/i);
    if (checkedMatch) {
      const item = (checkedMatch[1] ?? "").trim();
      if (item.length > 0 && !/no exercises recorded yet/i.test(item)) {
        checkedItems.push(item);
      }
      continue;
    }

    const uncheckedMatch = line.match(/^\s*-\s*\[\s\]\s+(.+)$/i);
    if (uncheckedMatch) {
      const item = (uncheckedMatch[1] ?? "").trim();
      if (item.length > 0 && !/no exercises recorded yet/i.test(item)) {
        uncheckedItems.push(item);
      }
    }
  }

  const completed = checkedItems.length;
  const remaining = uncheckedItems.length;
  const total = completed + remaining;
  const completionPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return {
    total,
    completed,
    remaining,
    completionPercent,
    completedItems: checkedItems,
    remainingItems: uncheckedItems,
  };
}

export function renderProgressMarkdown(input: RenderProgressMarkdownInput): string {
  const updatedAt = input.updatedAt ?? new Date().toISOString();
  const completedCount = input.roadmapCompleted ?? 0;
  const totalCount = input.roadmapTotal ?? 0;
  const completionPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const lines = [
    `# Progress — ${input.title}`,
    "",
    "## Journey status",
    `- Roadmap tasks complete: ${completedCount}/${totalCount} (${completionPercent}%)`,
    "",
    "## Current focus",
    input.currentFocus,
    "",
    "## Next step",
    input.nextStep,
    "",
    "## Completed",
    ...(input.completed?.length ? input.completed.map((item) => `- ${item}`) : ["- Nothing completed yet"]),
    "",
    "## Reflections",
    ...(input.reflections?.length ? input.reflections.map((item) => `- ${item}`) : ["- No reflections recorded yet"]),
    "",
    "## Blockers",
    ...(input.blockers?.length ? input.blockers.map((item) => `- ${item}`) : ["- No blockers recorded right now"]),
    "",
    "## Metadata",
    `- Updated at: ${updatedAt}`,
    "",
  ];

  return lines.join("\n");
}

async function readIfExists(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export async function saveTrackMarkdownSet(input: TrackMarkdownSetInput, agentDir = getAgentDir()): Promise<TrackPaths> {
  const paths = resolveTrackPaths(input.slug, agentDir);
  await mkdir(paths.dir, { recursive: true });
  const normalize = (value: string) => (value.endsWith("\n") ? value : `${value}\n`);
  await writeFile(paths.track, normalize(input.track), "utf8");
  const defaultProjectMarkdown = renderProjectMarkdown({
    title: getHeadingTitle(input.track) ?? input.slug,
    goal: "Define the concrete project this learning track will build.",
    learnerOutcome: "Be able to explain and implement the project independently.",
  });
  await writeFile(paths.project, normalize(input.project ?? defaultProjectMarkdown), "utf8");
  await writeFile(paths.roadmap, normalize(input.roadmap), "utf8");
  await writeFile(paths.progress, normalize(input.progress), "utf8");
  return paths;
}

export async function loadTrackMarkdownSet(slug: string, agentDir = getAgentDir()): Promise<TrackMarkdownSet | undefined> {
  const paths = resolveTrackPaths(slug, agentDir);
  const trackMarkdown = await readIfExists(paths.track);
  if (!trackMarkdown) return undefined;

  return {
    slug,
    dir: paths.dir,
    trackPath: paths.track,
    projectPath: paths.project,
    roadmapPath: paths.roadmap,
    progressPath: paths.progress,
    trackMarkdown,
    projectMarkdown:
      (await readIfExists(paths.project)) ??
      renderProjectMarkdown({
        title: getHeadingTitle(trackMarkdown) ?? slug,
        goal: "Define the concrete project this learning track will build.",
        learnerOutcome: "Be able to explain and implement the project independently.",
      }),
    roadmapMarkdown: (await readIfExists(paths.roadmap)) ?? `# Roadmap — ${slug}\n\n## Milestones\n- No milestones recorded yet.\n`,
    progressMarkdown:
      (await readIfExists(paths.progress)) ??
      renderProgressMarkdown({
        title: getHeadingTitle(trackMarkdown) ?? slug,
        currentFocus: "Not recorded yet.",
        nextStep: "Decide the next step.",
        roadmapCompleted: 0,
        roadmapTotal: 0,
      }),
  };
}

export async function listTrackMarkdownSets(agentDir = getAgentDir()): Promise<TrackMarkdownSet[]> {
  const root = resolveTracksRoot(agentDir);
  let dirEntries: Array<{ name: string; isDirectory: () => boolean }> = [];

  try {
    dirEntries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const tracks: TrackMarkdownSet[] = [];
  for (const dirEntry of dirEntries) {
    if (!dirEntry.isDirectory()) continue;
    const loaded = await loadTrackMarkdownSet(dirEntry.name, agentDir);
    if (loaded) tracks.push(loaded);
  }

  return tracks;
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getHeadingTitle(markdown: string): string | undefined {
  const match = markdown.match(/^#\s*(?:Track:\s*)?(.+)$/m);
  return match?.[1]?.trim();
}

function getSectionBullets(markdown: string, section: string): string[] {
  const lines = markdown.split("\n");
  const sectionHeading = `## ${section}`.toLowerCase();
  const collected: string[] = [];
  let inSection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.toLowerCase() === sectionHeading) {
      inSection = true;
      continue;
    }
    if (inSection && trimmed.startsWith("## ")) {
      break;
    }
    if (inSection && trimmed.startsWith("- ")) {
      collected.push(trimmed.slice(2).trim());
    }
  }

  return collected;
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}

function scoreTrackMatch(prompt: string, track: TrackMarkdownSet): number {
  const normalizedPrompt = normalizeText(prompt);
  if (!normalizedPrompt) return 0;

  const title = getHeadingTitle(track.trackMarkdown) ?? basename(track.dir);
  const slugPhrase = track.slug.replace(/-/g, " ");
  const keywords = getSectionBullets(track.trackMarkdown, "Keywords");

  let score = 0;
  const strongPhrases = [slugPhrase, title, ...keywords].map(normalizeText).filter(Boolean);
  for (const phrase of strongPhrases) {
    if (phrase.length > 2 && normalizedPrompt.includes(phrase)) {
      score += 6;
    }
  }

  const tokens = new Set<string>([
    ...tokenize(track.slug),
    ...tokenize(title),
    ...keywords.flatMap((keyword) => tokenize(keyword)),
  ]);
  for (const token of tokens) {
    if (normalizedPrompt.split(" ").includes(token)) {
      score += 1;
    }
  }

  return score;
}

export async function matchTrackFromPrompt(prompt: string, agentDir = getAgentDir()): Promise<TrackMarkdownSet | undefined> {
  const tracks = await listTrackMarkdownSets(agentDir);
  let bestTrack: TrackMarkdownSet | undefined;
  let bestScore = 0;

  for (const track of tracks) {
    const score = scoreTrackMatch(prompt, track);
    if (score > bestScore) {
      bestScore = score;
      bestTrack = track;
    }
  }

  return bestScore > 0 ? bestTrack : undefined;
}

export function shouldConsiderTrack(prompt: string): boolean {
  return /(learn|learning|study|studying|road ?map|curriculum|plan|track|continue|resume|progress|reflect|practice|next step|project)/i.test(
    prompt,
  );
}

export function buildTrackContextPrompt(track: TrackMarkdownSet): string {
  const checklist = extractRoadmapChecklistStats(track.roadmapMarkdown);

  return [
    `Matched learning track: ${track.slug}`,
    "Use this self-contained track directory as the active learning stream for the current request.",
    "Track paths:",
    `- track.md: ${track.trackPath}`,
    `- project.md: ${track.projectPath}`,
    `- roadmap.md: ${track.roadmapPath}`,
    `- progress.md: ${track.progressPath}`,
    "Checklist snapshot:",
    `- Roadmap tasks complete: ${checklist.completed}/${checklist.total} (${checklist.completionPercent}%)`,
    "Rules:",
    "- Continue within this track instead of starting a brand-new one.",
    "- Keep project.md up to date with the project goal, scope, and acceptance criteria.",
    "- Keep roadmap.md focused on milestones and concept-linked exercises.",
    "- Roadmap tasks in roadmap.md must use markdown checkboxes (- [ ] / - [x]) so progress is trackable.",
    "- When the learner completes a roadmap task, mark the matching checkbox in roadmap.md and mirror the completion in progress.md.",
    "- Keep the Journey status line in progress.md synchronized with roadmap checkbox completion counts.",
    "- Update progress.md after meaningful completions or reflections.",
    "- Keep the Next step section in progress.md current, concrete, and actionable.",
    "- If the user reflects, reports progress, or gets stuck, record it in progress.md and adjust blockers/completed items/next step.",
    "- If the user asks what to do next or uses a reflection-style workflow, update progress.md before you answer.",
    "- Do not rely on hidden active-track state; resuming should work when the learner names the topic.",
    "Current track files:",
    `--- ${TRACK_FILENAME} (${track.trackPath}) ---`,
    track.trackMarkdown.trim(),
    `--- ${PROJECT_FILENAME} (${track.projectPath}) ---`,
    track.projectMarkdown.trim(),
    `--- ${ROADMAP_FILENAME} (${track.roadmapPath}) ---`,
    track.roadmapMarkdown.trim(),
    `--- ${PROGRESS_FILENAME} (${track.progressPath}) ---`,
    track.progressMarkdown.trim(),
  ].join("\n");
}

export function buildTrackCreationPrompt(tracksRoot: string): string {
  return [
    "No matching learning track was found for the current request.",
    `If the user is clearly starting or resuming a learning topic/project stream, create a new self-contained track directory under ${tracksRoot}/<topic-folder>/.`,
    "Enforcement:",
    "- If the topic/project is clear, create the track files first in the same turn before giving tutoring advice.",
    "- Only ask a clarifying question when the topic/project is ambiguous.",
    "Required files:",
    `- ${TRACK_FILENAME}`,
    `- ${PROJECT_FILENAME}`,
    `- ${ROADMAP_FILENAME}`,
    `- ${PROGRESS_FILENAME}`,
    "Rules:",
    "- Use markdown-first docs, not JSON.",
    "- Do not rely on hidden active-track state; the learner should be able to resume when they name the topic clearly.",
    "- Infer a short stable folder name from the topic or project.",
    "- track.md should summarize the topic/project, keywords, and learner-specific notes.",
    "- project.md must describe the concrete build (goal, scope, acceptance criteria, constraints, deliverables).",
    "- roadmap.md should contain milestones and concept-linked exercises.",
    "- roadmap.md must include markdown checkbox todo items (- [ ] / - [x]) for tasks/exercises.",
    "- progress.md should contain Journey status, current focus, completed items, reflections, blockers, and a Next step section.",
    "- Keep Journey status counts in progress.md synchronized with roadmap checkbox completion.",
    "- If the learner asks what to do next or shares a reflection, update progress.md before answering.",
    "- If the request is ambiguous, ask one short clarifying question instead of creating the wrong track.",
    "Suggested templates:",
    renderTrackMarkdown({
      title: "<Track title>",
      summary: "<What this track is about and why it matters>",
      keywords: ["<keyword 1>", "<keyword 2>"],
      notes: ["<Learner-specific note>"],
    }).trim(),
    renderProjectMarkdown({
      title: "<Track title>",
      goal: "<What project should be built in this track>",
      learnerOutcome: "<What the learner can do after building it>",
      scope: ["<Scope item 1>", "<Scope item 2>"],
      acceptanceCriteria: ["<Acceptance criterion 1>"],
      constraints: ["<Constraint 1>"],
      deliverables: ["<Deliverable 1>"],
    }).trim(),
    renderRoadmapMarkdown({
      title: "<Track title>",
      milestones: [
        {
          title: "<Milestone 1>",
          outcomes: ["<Outcome>"],
          concepts: ["<Concept 1>", "<Concept 2>"],
          exercises: ["<Exercise 1>", "<Exercise 2>"],
        },
      ],
    }).trim(),
    renderProgressMarkdown({
      title: "<Track title>",
      currentFocus: "<Current focus>",
      nextStep: "<Next step>",
      completed: [],
      reflections: ["<Initial reflection>"],
      blockers: [],
      roadmapCompleted: 0,
      roadmapTotal: 0,
      updatedAt: "<ISO timestamp>",
    }).trim(),
  ].join("\n\n");
}
