import fs from "node:fs";
import path from "node:path";
import process from "node:process";

import { writeExecutable } from "./helpers.mjs";

/**
 * Install a fake `agy` CLI for tests.
 *
 * The fake emulates the one-shot `agy --print` interface (not an app-server):
 *   - `agy --version`            -> prints a version string, exits 0
 *   - `agy --print <prompt> ...` -> prints a canned response, exits 0
 *
 * Output and exit code can be overridden at runtime via env vars so a single
 * installed fake can drive many cases:
 *   - FAKE_AGY_OUTPUT  -> exact stdout to emit (text or JSON)
 *   - FAKE_AGY_EXIT    -> exit code to use (default 0)
 *
 * Otherwise the baked-in `behavior` selects a default canned payload.
 */
export function installFakeAgy(binDir, behavior = "text-ok") {
  const scriptPath = path.join(binDir, "agy");
  const source = `#!/usr/bin/env node
const fs = require("node:fs");
const REVIEW_CLEAN = ${JSON.stringify(
    JSON.stringify({ verdict: "approve", summary: "No material issues found.", findings: [], next_steps: [] })
  )};
const REVIEW_FINDINGS = ${JSON.stringify(
    JSON.stringify({
      verdict: "needs-attention",
      summary: "One concern surfaced.",
      findings: [
        {
          severity: "high",
          title: "Missing empty-state guard",
          body: "The change assumes data is always present.",
          file: "src/app.js",
          line_start: 4,
          line_end: 6,
          confidence: 0.87,
          recommendation: "Handle empty collections before indexing."
        }
      ],
      next_steps: ["Add an empty-state test."]
    })
  )};
const BEHAVIOR = ${JSON.stringify(behavior)};

function readStdin() {
  try {
    return fs.readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

const argv = process.argv.slice(2);
if (argv.includes("--version")) {
  console.log("agy 1.0.0-test");
  process.exit(0);
}

// Extract the prompt: the value following --print/-p/--prompt, else stdin.
let prompt = "";
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "--print" || argv[i] === "-p" || argv[i] === "--prompt") {
    prompt = argv[i + 1] || "";
    break;
  }
}
if (!prompt) {
  prompt = readStdin();
}

function cannedOutput() {
  switch (BEHAVIOR) {
    case "review-clean":
      return REVIEW_CLEAN;
    case "review-findings":
      return REVIEW_FINDINGS;
    case "invalid-json":
      return "not valid json";
    case "text-ok":
    default:
      return "Handled the requested task.";
  }
}

const output = process.env.FAKE_AGY_OUTPUT != null ? process.env.FAKE_AGY_OUTPUT : cannedOutput();
process.stdout.write(output + "\\n");
process.exit(Number(process.env.FAKE_AGY_EXIT || 0));
`;
  writeExecutable(scriptPath, source);

  // On Windows, allow discovery via a .cmd wrapper when spawned with shell.
  if (process.platform === "win32") {
    const cmdWrapper = `@echo off\r\nnode "%~dp0agy" %*\r\n`;
    fs.writeFileSync(path.join(binDir, "agy.cmd"), cmdWrapper, { encoding: "utf8" });
  }
}

export function buildAgyEnv(binDir, extra = {}) {
  const sep = process.platform === "win32" ? ";" : ":";
  return {
    ...process.env,
    PATH: `${binDir}${sep}${process.env.PATH}`,
    ...extra
  };
}
