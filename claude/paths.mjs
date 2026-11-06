import { homedir } from "node:os";
import { join } from "node:path";

// The shared oh-my-tutor home, fixed because the Claude status line command gets no plugin env vars.
export const STATE_DIR = join(homedir(), ".oh-my-tutor");
export const STATUSLINE_LAUNCHER = join(STATE_DIR, "statusline.mjs");

export function sessionFlagPath(sessionId = "default") {
  return join(STATE_DIR, "sessions", sessionId.replace(/[^\w-]/g, "_"));
}
