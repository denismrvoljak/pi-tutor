import type { ExtensionAPI, ExtensionCommandContext, ExtensionContext, SessionEntry } from "@mariozechner/pi-coding-agent";
import {
  buildConversationalOnboardingPrompt,
  buildLearnerProfilePrompt,
  buildOnboardingKickoffMessage,
  loadLearnerProfileMarkdown,
  resolveLearnerProfilePath,
} from "../../src/learner-profile.ts";
import {
  buildTrackContextPrompt,
  buildTrackCreationPrompt,
  matchTrackFromPrompt,
  resolveTracksRoot,
  shouldConsiderTrack,
} from "../../src/tracks.ts";

export const TUTOR_MODE_CUSTOM_TYPE = "pi-tutor-mode";
export const TUTOR_ONBOARDING_MESSAGE_CUSTOM_TYPE = "pi-tutor-onboarding";
export const TUTOR_WORKFLOW_DISABLED_MESSAGE_CUSTOM_TYPE = "pi-tutor-workflow-disabled";
export const TUTOR_STATUS_KEY = "pi-tutor";

const TUTOR_PROMPT_COMMANDS = new Set(["start_tutoring", "hint", "reflect", "next_step"]);
const TUTOR_SKILL_COMMANDS = new Set(["tutor-implementation", "tutor-learn-topic"]);

export interface TutorModeState {
  version: 1;
  enabled: boolean;
  updatedAt?: string;
}

export const DEFAULT_TUTOR_MODE_STATE: TutorModeState = {
  version: 1,
  enabled: false,
};

export function createTutorModeState(enabled: boolean, updatedAt = new Date().toISOString()): TutorModeState {
  return {
    version: 1,
    enabled,
    updatedAt,
  };
}

export function parseTutorCommand(input: string): "on" | "off" | "status" | undefined {
  const normalized = input.trim().toLowerCase();

  if (normalized === "on" || normalized === "off" || normalized === "status") {
    return normalized;
  }

  return undefined;
}

function isTutorModeState(value: unknown): value is TutorModeState {
  if (typeof value !== "object" || value === null) return false;

  const candidate = value as Partial<TutorModeState>;
  return candidate.version === 1 && typeof candidate.enabled === "boolean";
}

function isCustomEntry(entry: unknown): entry is SessionEntry & { type: "custom"; customType: string; data?: unknown } {
  return typeof entry === "object" && entry !== null && (entry as { type?: unknown }).type === "custom";
}

export function reconstructTutorModeState(entries: readonly unknown[]): TutorModeState {
  let state = DEFAULT_TUTOR_MODE_STATE;

  for (const entry of entries) {
    if (!isCustomEntry(entry)) continue;
    if (entry.customType !== TUTOR_MODE_CUSTOM_TYPE) continue;
    if (!isTutorModeState(entry.data)) continue;
    state = entry.data;
  }

  return state;
}

export function buildTutorModeSystemPrompt(systemPrompt: string): string {
  return `${systemPrompt}

Tutor mode is enabled for this turn.

Tutor behavior rules:
- Use an attempt-first approach whenever it is practical.
- Prefer hints before full solutions.
- Keep teaching notes concise, practical, and focused on the next small step.
- When the learner asks for help, nudge them toward the next useful move instead of taking over immediately.
- Only give a full solution when the learner explicitly asks for it or is clearly stuck after trying.
- Briefly reinforce progress and point to what to try next.`;
}

export function getTutorStatusText(enabled: boolean): string | undefined {
  return enabled ? "📚 tutor mode enabled" : undefined;
}

function parseTutorWorkflowInvocation(input: string): string | undefined {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) return undefined;

  const commandToken = trimmed.slice(1).split(/\s+/, 1)[0] ?? "";
  if (TUTOR_PROMPT_COMMANDS.has(commandToken)) {
    return `/${commandToken}`;
  }

  if (commandToken.startsWith("skill:")) {
    const skillName = commandToken.slice("skill:".length);
    if (TUTOR_SKILL_COMMANDS.has(skillName)) {
      return `/skill:${skillName}`;
    }
  }

  return undefined;
}

function buildTutorWorkflowDisabledMessage(command: string): string {
  return `Tutor mode is off. Run /tutor on before using ${command}.`;
}

function syncTutorUi(ctx: ExtensionContext, state: TutorModeState): void {
  if (!ctx.hasUI) return;

  ctx.ui.setStatus(TUTOR_STATUS_KEY, getTutorStatusText(state.enabled));
  ctx.ui.setWidget("pi-tutor-mode", undefined);
}

function describeTutorState(state: TutorModeState, learnerProfileMarkdown?: string): string {
  const base = state.enabled
    ? "Tutor mode is ON. Expect attempt-first guidance, hints before full solutions, and concise teaching notes."
    : "Tutor mode is OFF. Standard coding-assistant behavior is active.";

  if (!learnerProfileMarkdown) {
    return `${base} No learner profile markdown is loaded yet.`;
  }

  return `${base} Learner profile markdown is loaded and will guide tutoring behavior.`;
}

export default function piTutorExtension(pi: ExtensionAPI): void {
  let tutorModeState = DEFAULT_TUTOR_MODE_STATE;
  let learnerProfileMarkdown: string | undefined;

  const restoreTutorState = async (ctx: ExtensionContext) => {
    tutorModeState = reconstructTutorModeState(ctx.sessionManager.getBranch());
    learnerProfileMarkdown = await loadLearnerProfileMarkdown();
    syncTutorUi(ctx, tutorModeState);
  };

  const persistTutorState = (enabled: boolean, ctx: ExtensionContext) => {
    tutorModeState = createTutorModeState(enabled);
    pi.appendEntry(TUTOR_MODE_CUSTOM_TYPE, tutorModeState);
    syncTutorUi(ctx, tutorModeState);
  };

  pi.registerCommand("tutor", {
    description: "Control tutor mode: /tutor on, /tutor off, /tutor status",
    getArgumentCompletions: (prefix) => {
      const normalized = prefix.trim().toLowerCase();
      const options = ["on", "off", "status"];
      const matches = options.filter((option) => option.startsWith(normalized));
      return matches.length > 0 ? matches.map((option) => ({ value: option, label: option })) : null;
    },
    handler: async (args: string, ctx: ExtensionCommandContext) => {
      const command = parseTutorCommand(args);

      if (!command) {
        syncTutorUi(ctx, tutorModeState);
        ctx.ui.notify("Usage: /tutor on | /tutor off | /tutor status", "warning");
        return;
      }

      if (command === "status") {
        learnerProfileMarkdown = await loadLearnerProfileMarkdown();
        syncTutorUi(ctx, tutorModeState);
        ctx.ui.notify(describeTutorState(tutorModeState, learnerProfileMarkdown), "info");
        return;
      }

      if (command === "off") {
        persistTutorState(false, ctx);
        ctx.ui.notify("Tutor mode disabled.", "info");
        return;
      }

      learnerProfileMarkdown = await loadLearnerProfileMarkdown();
      persistTutorState(true, ctx);

      if (!learnerProfileMarkdown) {
        const profilePath = resolveLearnerProfilePath();
        ctx.ui.notify("Tutor mode enabled. Starting conversational onboarding.", "info");
        pi.sendMessage(
          {
            customType: TUTOR_ONBOARDING_MESSAGE_CUSTOM_TYPE,
            content: buildOnboardingKickoffMessage(profilePath),
            display: true,
          },
          { triggerTurn: true },
        );
        return;
      }

      ctx.ui.notify("Tutor mode enabled.", "info");
    },
  });

  pi.on("input", async (event, ctx) => {
    const workflowCommand = parseTutorWorkflowInvocation(event.text);
    if (!workflowCommand) {
      return { action: "continue" };
    }

    if (tutorModeState.enabled) {
      return { action: "continue" };
    }

    const message = buildTutorWorkflowDisabledMessage(workflowCommand);
    if (ctx.hasUI) {
      ctx.ui.notify(message, "info");
    }
    pi.sendMessage(
      {
        customType: TUTOR_WORKFLOW_DISABLED_MESSAGE_CUSTOM_TYPE,
        content: message,
        display: true,
      },
      { triggerTurn: false },
    );
    return { action: "handled" };
  });

  pi.on("before_agent_start", async (event) => {
    if (!tutorModeState.enabled) return undefined;

    learnerProfileMarkdown = await loadLearnerProfileMarkdown();
    const profilePath = resolveLearnerProfilePath();

    let systemPrompt = buildTutorModeSystemPrompt(event.systemPrompt);
    if (!learnerProfileMarkdown) {
      systemPrompt += `\n\n${buildConversationalOnboardingPrompt(profilePath)}`;
      return { systemPrompt };
    }

    systemPrompt += `\n\n${buildLearnerProfilePrompt(learnerProfileMarkdown)}`;

    const userPrompt = typeof event.prompt === "string" ? event.prompt : "";
    const matchedTrack = await matchTrackFromPrompt(userPrompt);
    if (matchedTrack) {
      systemPrompt += `\n\n${buildTrackContextPrompt(matchedTrack)}`;
    } else if (shouldConsiderTrack(userPrompt)) {
      systemPrompt += `\n\n${buildTrackCreationPrompt(resolveTracksRoot())}`;
    }

    return {
      systemPrompt,
    };
  });

  pi.on("session_start", async (_event, ctx) => {
    await restoreTutorState(ctx);
  });

  pi.on("session_switch", async (_event, ctx) => {
    await restoreTutorState(ctx);
  });

  pi.on("session_fork", async (_event, ctx) => {
    await restoreTutorState(ctx);
  });

  pi.on("session_tree", async (_event, ctx) => {
    await restoreTutorState(ctx);
  });
}
