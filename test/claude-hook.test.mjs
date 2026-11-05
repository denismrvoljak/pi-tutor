import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const hook = new URL("../claude/user-prompt-submit.mjs", import.meta.url).pathname;

function run(env, prompt, sessionId = "s1") {
  const out = execFileSync("node", [hook], {
    input: JSON.stringify({ prompt, session_id: sessionId, cwd: env.cwd }),
    env: { ...process.env, HOME: env.home, PI_TUTOR_DIR: env.tutor },
  }).toString();
  return out ? JSON.parse(out) : undefined;
}

test("claude hook toggles tutor mode per session and gates workflows", () => {
  const root = mkdtempSync(join(tmpdir(), "pi-tutor-claude-"));
  const env = { home: join(root, "home"), tutor: join(root, "tutor"), cwd: root };

  assert.equal(run(env, "plain question"), undefined);
  assert.equal(run(env, "/tutor:hint loops").decision, "block");
  assert.equal(run(env, "/tutor:tutor bogus").decision, "block");

  const on = run(env, "/tutor:tutor on").hookSpecificOutput.additionalContext;
  assert.match(on, /Tutor mode is ON/);
  assert.match(on, /Start conversational onboarding/);

  mkdirSync(env.tutor, { recursive: true });
  writeFileSync(join(env.tutor, "learner-profile.md"), "# Learner Profile\n- Current level: beginner\n");
  const turn = run(env, "/tutor:hint loops").hookSpecificOutput.additionalContext;
  assert.match(turn, /Tutor mode is enabled/);
  assert.match(turn, /Current level: beginner/);

  assert.equal(run(env, "plain question", "other-session"), undefined);

  // The launcher the hook wrote draws the owl only for the session with tutor mode on.
  const statusline = (sessionId) =>
    execFileSync("node", [join(env.home, ".claude", "oh-my-tutor", "statusline.mjs")], {
      input: JSON.stringify({ session_id: sessionId }),
      env: { ...process.env, HOME: env.home },
    }).toString();
  const owl = statusline("s1").trimEnd().split("\n");
  assert.equal(owl.length, 3);
  assert.match(owl[1], /tutor mode/);
  assert.equal(statusline("other-session"), "");

  assert.match(run(env, "/tutor off").hookSpecificOutput.additionalContext, /Tutor mode is OFF/);
  assert.equal(run(env, "plain question"), undefined);
});
