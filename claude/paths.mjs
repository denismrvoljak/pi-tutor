import { homedir } from "node:os";
import { join } from "node:path";

// A fixed folder, because the status line command gets no CLAUDE_PLUGIN_DATA.
export const STATE_DIR = join(homedir(), ".claude", "oh-my-tutor");
export const STATUSLINE_LAUNCHER = join(STATE_DIR, "statusline.mjs");

export function sessionFlagPath(sessionId = "default") {
  return join(STATE_DIR, "sessions", sessionId.replace(/[^\w-]/g, "_"));
}
