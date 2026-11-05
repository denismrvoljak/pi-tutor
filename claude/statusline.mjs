// Claude Code status line: an animated pixel owl while tutor mode is on in this session, else nothing.
// Use "refreshInterval": 1 in the statusLine setting so the owl animates.
import { existsSync } from "node:fs";
import { renderOwl, OWL_LABELS } from "../src/owl.ts";
import { sessionFlagPath } from "./paths.mjs";

let raw = "";
for await (const chunk of process.stdin) raw += chunk;
const { session_id: sessionId } = JSON.parse(raw || "{}");

if (existsSync(sessionFlagPath(sessionId))) {
  process.stdout.write(`${renderOwl(Math.floor(Date.now() / 1000), OWL_LABELS).join("\n")}\n`);
}
