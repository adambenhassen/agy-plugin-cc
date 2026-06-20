import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

import { installFakeAgy, buildAgyEnv } from "./fake-agy-fixture.mjs";
import { initGitRepo, run } from "./helpers.mjs";

const COMPANION = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "plugins",
  "codex",
  "scripts",
  "codex-companion.mjs"
);

function setup(behavior = "text-ok") {
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), "agy-cmd-bin-"));
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "agy-cmd-repo-"));
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "agy-cmd-data-"));
  installFakeAgy(binDir, behavior);
  initGitRepo(repo);
  fs.writeFileSync(path.join(repo, "app.js"), "const x = arr[0];\n");
  const env = buildAgyEnv(binDir, { CLAUDE_PLUGIN_DATA: dataDir });
  return { binDir, repo, dataDir, env };
}

function cleanup(ctx) {
  for (const dir of [ctx.binDir, ctx.repo, ctx.dataDir]) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function companion(ctx, args) {
  return run("node", [COMPANION, ...args], { cwd: ctx.repo, env: ctx.env });
}

test("setup reports ready when the agy CLI is available", () => {
  const ctx = setup();
  try {
    const result = companion(ctx, ["setup", "--json"]);
    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    assert.equal(report.ready, true);
    assert.equal(report.codex.available, true);
  } finally {
    cleanup(ctx);
  }
});

test("review renders structured findings from agy JSON output", () => {
  const ctx = setup("review-findings");
  try {
    const result = companion(ctx, ["review", "--scope", "working-tree"]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Verdict: needs-attention/);
    assert.match(result.stdout, /Missing empty-state guard/);
    assert.match(result.stdout, /src\/app\.js:4-6/);
  } finally {
    cleanup(ctx);
  }
});

test("review falls back to raw output when agy does not return JSON", () => {
  const ctx = setup("invalid-json");
  try {
    const result = companion(ctx, ["review", "--scope", "working-tree"]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /did not return valid structured JSON/i);
    assert.match(result.stdout, /not valid json/);
  } finally {
    cleanup(ctx);
  }
});

test("adversarial review accepts focus text and renders findings", () => {
  const ctx = setup("review-findings");
  try {
    const result = companion(ctx, ["adversarial-review", "--scope", "working-tree", "check", "auth"]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Missing empty-state guard/);
  } finally {
    cleanup(ctx);
  }
});

test("task returns the agy output for a foreground run", () => {
  const ctx = setup("text-ok");
  try {
    const result = companion(ctx, ["task", "investigate the failing build"]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Handled the requested task\./);
  } finally {
    cleanup(ctx);
  }
});

test("task --resume-last fails clearly when there is no previous task", () => {
  const ctx = setup("text-ok");
  try {
    const result = companion(ctx, ["task", "--resume-last"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /No previous Agy task/i);
  } finally {
    cleanup(ctx);
  }
});

test("background task creates a job that status and result can resolve", () => {
  const ctx = setup("text-ok");
  try {
    const launch = companion(ctx, ["task", "--background", "--json", "do background work"]);
    assert.equal(launch.status, 0, launch.stderr);
    const jobId = JSON.parse(launch.stdout).jobId;
    assert.ok(jobId);

    // Poll status until the detached worker finishes.
    let job;
    for (let i = 0; i < 50; i++) {
      const status = companion(ctx, ["status", jobId, "--json"]);
      assert.equal(status.status, 0, status.stderr);
      job = JSON.parse(status.stdout).job;
      if (job.status !== "queued" && job.status !== "running") {
        break;
      }
      run("sleep", ["0.1"], {});
    }
    assert.equal(job.status, "completed", `job ended as ${job?.status}`);

    const result = companion(ctx, ["result", jobId]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Handled the requested task\./);
  } finally {
    cleanup(ctx);
  }
});
