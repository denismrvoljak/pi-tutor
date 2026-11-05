// Claude Code status line: "🦉 tutor: ON" while tutor mode is on in this session, else nothing.
import { existsSync } from "node:fs";
import { sessionFlagPath } from "./paths.mjs";

let raw = "";
for await (const chunk of process.stdin) raw += chunk;
const { session_id: sessionId } = JSON.parse(raw || "{}");

if (existsSync(sessionFlagPath(sessionId))) {
  process.stdout.write("🦉 \x1b[2mtutor:\x1b[0m ON\n");
}
