import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLUGIN_ROOT = path.join(ROOT, "plugins", "agy");

function read(relativePath) {
  return fs.readFileSync(path.join(PLUGIN_ROOT, relativePath), "utf8");
}

test("review command stays review-only and forwards to the agy companion", () => {
  const source = read("commands/review.md");
  assert.match(source, /AskUserQuestion/);
  assert.match(source, /\bBash\(/);
  assert.match(source, /Do not fix issues/i);
  assert.match(source, /review-only/i);
  assert.match(source, /return Agy's output verbatim to the user/i);
  assert.match(source, /agy-companion\.mjs" review "\$ARGUMENTS"/);
  assert.match(source, /run_in_background:\s*true/);
  assert.match(source, /description:\s*"Agy review"/);
});

test("adversarial review command stays review-only and forwards to the agy companion", () => {
  const source = read("commands/adversarial-review.md");
  assert.match(source, /AskUserQuestion/);
  assert.match(source, /\bBash\(/);
  assert.match(source, /Do not fix issues/i);
  assert.match(source, /review-only/i);
  assert.match(source, /agy-companion\.mjs" adversarial-review "\$ARGUMENTS"/);
  assert.match(source, /run_in_background:\s*true/);
  assert.match(source, /uses the same review target selection as `\/agy:review`/i);
});

test("continue is not exposed as a user-facing command", () => {
  const commandFiles = fs.readdirSync(path.join(PLUGIN_ROOT, "commands")).sort();
  assert.deepEqual(commandFiles, [
    "adversarial-review.md",
    "cancel.md",
    "rescue.md",
    "result.md",
    "review.md",
    "setup.md",
    "status.md"
  ]);
});

test("rescue command is a thin forwarder routed through the agy-rescue subagent", () => {
  const rescue = read("commands/rescue.md");
  const agent = read("agents/agy-rescue.md");
  const runtimeSkill = read("skills/agy-cli-runtime/SKILL.md");

  assert.match(rescue, /The final user-visible response must be Agy's output verbatim/i);
  assert.match(rescue, /allowed-tools:\s*Bash\(node:\*\),\s*AskUserQuestion,\s*Agent/);
  // Regression for the Skill-recursion bug: pin the explicit transport and inline (no-fork) execution.
  assert.match(rescue, /subagent_type: "agy:agy-rescue"/);
  assert.match(rescue, /do not call `Skill\(agy:agy-rescue\)`/i);
  assert.doesNotMatch(rescue, /^context:\s*fork\b/m);
  assert.match(rescue, /--background\|--wait/);
  assert.match(rescue, /--resume\|--fresh/);
  assert.match(rescue, /--model <model>/);
  assert.match(rescue, /task-resume-candidate --json/);
  assert.match(rescue, /AskUserQuestion/);
  assert.match(rescue, /Continue current Agy thread/);
  assert.match(rescue, /Start a new Agy thread/);
  assert.match(rescue, /thin forwarder only/i);
  assert.match(rescue, /Return the Agy companion stdout verbatim to the user/i);

  assert.match(agent, /--resume/);
  assert.match(agent, /--fresh/);
  assert.match(agent, /thin forwarding wrapper/i);
  assert.match(agent, /Use exactly one `Bash` call/i);
  assert.match(agent, /Do not call `review`, `adversarial-review`, `status`, `result`, or `cancel`/i);
  assert.match(agent, /Return the stdout of the `agy-companion` command exactly as-is/i);
  assert.match(agent, /agy-prompting/);

  assert.match(runtimeSkill, /only job is to invoke `task` once and return that stdout unchanged/i);
  assert.match(runtimeSkill, /Do not call `setup`, `review`, `adversarial-review`, `status`, `result`, or `cancel`/i);
});

test("result and cancel commands are deterministic runtime entrypoints", () => {
  const result = read("commands/result.md");
  const cancel = read("commands/cancel.md");
  const resultHandling = read("skills/agy-result-handling/SKILL.md");

  assert.match(result, /disable-model-invocation:\s*true/);
  assert.match(result, /agy-companion\.mjs" result "\$ARGUMENTS"/);
  assert.match(cancel, /disable-model-invocation:\s*true/);
  assert.match(cancel, /agy-companion\.mjs" cancel "\$ARGUMENTS"/);
  assert.match(resultHandling, /do not turn a failed or incomplete Agy run into a Claude-side implementation attempt/i);
  assert.match(resultHandling, /if Agy was never successfully invoked, do not generate a substitute answer at all/i);
});

test("internal docs use task terminology for rescue runs", () => {
  const runtimeSkill = read("skills/agy-cli-runtime/SKILL.md");
  const promptingSkill = read("skills/agy-prompting/SKILL.md");
  const promptRecipes = read("skills/agy-prompting/references/agy-prompt-recipes.md");

  assert.match(runtimeSkill, /agy-companion\.mjs" task "<raw arguments>"/);
  assert.match(runtimeSkill, /Use `task` for every rescue request/i);
  assert.match(runtimeSkill, /task --resume-last/i);
  assert.match(promptingSkill, /Use `task` when the task is diagnosis/i);
  assert.match(promptRecipes, /Agy task prompts/i);
});

test("hooks keep session-end cleanup and stop gating enabled", () => {
  const source = read("hooks/hooks.json");
  assert.match(source, /SessionStart/);
  assert.match(source, /SessionEnd/);
  assert.match(source, /stop-review-gate-hook\.mjs/);
  assert.match(source, /session-lifecycle-hook\.mjs/);
});

test("setup command checks the agy CLI without npm or login flows", () => {
  const setup = read("commands/setup.md");
  assert.match(setup, /argument-hint:\s*'\[--enable-review-gate\|--disable-review-gate\]'/);
  assert.match(setup, /agy-companion\.mjs" setup --json \$ARGUMENTS/);
  assert.match(setup, /install the `agy` CLI/i);
  assert.doesNotMatch(setup, /npm/i);
  assert.doesNotMatch(setup, /login/i);
});

test("no codex/openai/spark leakage remains in plugin docs", () => {
  const docFiles = [
    "commands/review.md",
    "commands/adversarial-review.md",
    "commands/rescue.md",
    "commands/setup.md",
    "commands/status.md",
    "commands/result.md",
    "commands/cancel.md",
    "agents/agy-rescue.md",
    "skills/agy-cli-runtime/SKILL.md",
    "skills/agy-result-handling/SKILL.md",
    "skills/agy-prompting/SKILL.md"
  ];
  for (const file of docFiles.map(read)) {
    assert.doesNotMatch(file, /codex/i);
    assert.doesNotMatch(file, /@openai/i);
    assert.doesNotMatch(file, /\bspark\b/i);
    assert.doesNotMatch(file, /npm install/i);
  }
  // README may reference the upstream fork (openai/codex-plugin-cc) for attribution,
  // but must not carry codex runtime semantics like spark or npm installs.
  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  assert.doesNotMatch(readme, /\bspark\b/i);
  assert.doesNotMatch(readme, /npm install/i);
  assert.match(readme, /fork of \[openai\/codex-plugin-cc\]/);
});

test("README documents the agy commands and install flow", () => {
  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  assert.match(readme, /`agy:agy-rescue` subagent/i);
  assert.match(readme, /### `\/agy:setup`/);
  assert.match(readme, /### `\/agy:review`/);
  assert.match(readme, /### `\/agy:adversarial-review`/);
  assert.match(readme, /### `\/agy:rescue`/);
  assert.match(readme, /### `\/agy:status`/);
  assert.match(readme, /### `\/agy:result`/);
  assert.match(readme, /### `\/agy:cancel`/);
  assert.match(readme, /uses the same review target selection as `\/agy:review`/i);
  assert.match(readme, /agy` CLI installed and on your `PATH`/i);
});
