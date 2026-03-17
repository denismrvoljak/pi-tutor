import { Type, type Static } from "@sinclair/typebox";

/**
 * Durable tutor state contract for pi-tutor.
 *
 * Learner identity stays global, while each learning track gets its own
 * self-contained markdown directory under the tutor data root.
 */
export const GLOBAL_STATE_ROOT = "${PI_CODING_AGENT_DIR:-~/.pi/agent}/pi-tutor";
export const TRACKS_ROOT = `${GLOBAL_STATE_ROOT}/tracks`;

export const LEARNER_PROFILE_PATH = `${GLOBAL_STATE_ROOT}/learner-profile.md`;
export const TRACK_BRIEF_PATH = `${TRACKS_ROOT}/<slug>/track.md`;
export const ROADMAP_PATH = `${TRACKS_ROOT}/<slug>/roadmap.md`;
export const PROGRESS_PATH = `${TRACKS_ROOT}/<slug>/progress.md`;

export const ConfidenceLevelSchema = Type.Union([
  Type.Literal("low"),
  Type.Literal("medium"),
  Type.Literal("high"),
]);

export const ExerciseStatusSchema = Type.Union([
  Type.Literal("planned"),
  Type.Literal("in_progress"),
  Type.Literal("completed"),
  Type.Literal("blocked"),
]);

export const ProgressEventKindSchema = Type.Union([
  Type.Literal("exercise_completed"),
  Type.Literal("reflection"),
  Type.Literal("milestone_advanced"),
  Type.Literal("note"),
]);

export const LearnerTopicConfidenceSchema = Type.Object({
  topic: Type.String({ minLength: 1 }),
  confidence: ConfidenceLevelSchema,
  evidence: Type.Optional(Type.String()),
});

export const HelpStyleSchema = Type.Object({
  attemptFirst: Type.Boolean(),
  preferHintsBeforeSolutions: Type.Boolean(),
  conciseExplanations: Type.Boolean(),
  reflectionCheckpoints: Type.Boolean(),
  projectBasedLearning: Type.Boolean(),
});

export const LearnerProfileSchema = Type.Object({
  version: Type.Literal(1),
  learnerId: Type.String({ minLength: 1 }),
  learningGoals: Type.Array(Type.String({ minLength: 1 })),
  primaryTopics: Type.Array(Type.String({ minLength: 1 })),
  preferredStackOrDomain: Type.Optional(Type.String()),
  currentLevel: Type.String({ minLength: 1 }),
  helpStyle: HelpStyleSchema,
  strengths: Type.Array(Type.String({ minLength: 1 })),
  stickingPoints: Type.Array(Type.String({ minLength: 1 })),
  confidenceByTopic: Type.Array(LearnerTopicConfidenceSchema),
  notes: Type.Array(Type.String()),
  createdAt: Type.String({ format: "date-time" }),
  updatedAt: Type.String({ format: "date-time" }),
});

export const RoadmapExerciseSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  title: Type.String({ minLength: 1 }),
  outcome: Type.String({ minLength: 1 }),
  concepts: Type.Array(Type.String({ minLength: 1 })),
  status: ExerciseStatusSchema,
});

export const RoadmapMilestoneSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  title: Type.String({ minLength: 1 }),
  objective: Type.String({ minLength: 1 }),
  concepts: Type.Array(Type.String({ minLength: 1 })),
  exercises: Type.Array(RoadmapExerciseSchema),
  completionCriteria: Type.Array(Type.String({ minLength: 1 })),
});

export const ProjectRoadmapSchema = Type.Object({
  version: Type.Literal(1),
  projectId: Type.String({ minLength: 1 }),
  projectTitle: Type.String({ minLength: 1 }),
  brief: Type.String({ minLength: 1 }),
  targetOutcome: Type.String({ minLength: 1 }),
  milestones: Type.Array(RoadmapMilestoneSchema),
  currentMilestoneId: Type.Optional(Type.String()),
  nextStep: Type.Optional(Type.String()),
  createdAt: Type.String({ format: "date-time" }),
  updatedAt: Type.String({ format: "date-time" }),
});

export const ReflectionEntrySchema = Type.Object({
  prompt: Type.String({ minLength: 1 }),
  response: Type.String({ minLength: 1 }),
  timestamp: Type.String({ format: "date-time" }),
});

export const ProgressEventSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  kind: ProgressEventKindSchema,
  summary: Type.String({ minLength: 1 }),
  milestoneId: Type.Optional(Type.String()),
  exerciseId: Type.Optional(Type.String()),
  conceptsTouched: Type.Array(Type.String({ minLength: 1 })),
  blockers: Type.Array(Type.String({ minLength: 1 })),
  confidenceAfter: Type.Optional(ConfidenceLevelSchema),
  timestamp: Type.String({ format: "date-time" }),
});

export const ProjectProgressSchema = Type.Object({
  version: Type.Literal(1),
  projectId: Type.String({ minLength: 1 }),
  completedMilestoneIds: Type.Array(Type.String({ minLength: 1 })),
  completedExerciseIds: Type.Array(Type.String({ minLength: 1 })),
  currentFocus: Type.Optional(Type.String()),
  nextRecommendedStep: Type.Optional(Type.String()),
  hardSpots: Type.Array(Type.String({ minLength: 1 })),
  reflections: Type.Array(ReflectionEntrySchema),
  events: Type.Array(ProgressEventSchema),
  updatedAt: Type.String({ format: "date-time" }),
});

export type LearnerProfile = Static<typeof LearnerProfileSchema>;
export type ProjectRoadmap = Static<typeof ProjectRoadmapSchema>;
export type ProjectProgress = Static<typeof ProjectProgressSchema>;
