import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { installFakeAgy, buildAgyEnv } from "./fake-agy-fixture.mjs";
import { buildAgyArgs, runAgyPrint, getAgyAvailability } from "../plugins/codex/scripts/lib/agy.mjs";

async function withFakeAgy(behavior, fn) {
  const binDir = fs.mkdtempSync(path.join(os.tmpdir(), "agy-bin-"));
  installFakeAgy(binDir, behavior);
  try {
    return await fn(path.join(binDir, "agy"), binDir);
  } finally {
    fs.rmSync(binDir, { recursive: true, force: true });
  }
}

test("buildAgyArgs composes print, model, and resume flags", () => {
  assert.deepEqual(buildAgyArgs({ prompt: "hi", model: "M" }), [
    "--print",
    "hi",
    "--model",
    "M",
    "--dangerously-skip-permissions"
  ]);
  assert.deepEqual(buildAgyArgs({ prompt: "hi", resume: true }), [
    "--print",
    "hi",
    "--continue",
    "--dangerously-skip-permissions"
  ]);
  assert.deepEqual(buildAgyArgs({ prompt: "hi", conversationId: "c1", resume: true }), [
    "--print",
    "hi",
    "--conversation",
    "c1",
    "--dangerously-skip-permissions"
  ]);
});

test("runAgyPrint returns trimmed text and exit code 0", async () => {
  await withFakeAgy("text-ok", async (binaryPath) => {
    const result = await runAgyPrint({ prompt: "do it", binaryPath });
    assert.equal(result.text, "Handled the requested task.");
    assert.equal(result.exitCode, 0);
  });
});

test("runAgyPrint surfaces a non-zero exit code (errors are values)", async () => {
  await withFakeAgy("text-ok", async (binaryPath, binDir) => {
    const result = await runAgyPrint({
      prompt: "do it",
      binaryPath,
      env: buildAgyEnv(binDir, { FAKE_AGY_EXIT: "1", FAKE_AGY_OUTPUT: "boom" })
    });
    assert.equal(result.exitCode, 1);
    assert.equal(result.text, "boom");
  });
});

test("runAgyPrint streams output to onLog", async () => {
  await withFakeAgy("text-ok", async (binaryPath) => {
    let logged = "";
    await runAgyPrint({ prompt: "do it", binaryPath, onLog: (chunk) => (logged += chunk) });
    assert.match(logged, /Handled the requested task\./);
  });
});

test("getAgyAvailability reports available when agy --version succeeds", () => {
  withFakeAgy("text-ok", (_binaryPath, binDir) => {
    const status = getAgyAvailability(process.cwd(), { env: buildAgyEnv(binDir) });
    assert.equal(status.available, true);
  });
});

test("getAgyAvailability reports unavailable when agy is missing", () => {
  const status = getAgyAvailability(process.cwd(), {
    env: { ...process.env, PATH: "/nonexistent-path-for-agy" }
  });
  assert.equal(status.available, false);
});
