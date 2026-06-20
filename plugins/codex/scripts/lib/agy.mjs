import process from "node:process";
import { spawn } from "node:child_process";

import { binaryAvailable, terminateProcessTree } from "./process.mjs";

export const DEFAULT_PRINT_TIMEOUT_MS = 300000;

/**
 * Build the argv for a one-shot `agy --print` invocation.
 *
 * Resume semantics: an explicit conversation id wins (`--conversation <id>`);
 * otherwise `resume` continues the most recent conversation (`--continue`).
 */
export function buildAgyArgs({ prompt = "", model = null, resume = false, conversationId = null, skipPermissions = true } = {}) {
  const args = ["--print", prompt];
  if (model) {
    args.push("--model", model);
  }
  if (conversationId) {
    args.push("--conversation", conversationId);
  } else if (resume) {
    args.push("--continue");
  }
  if (skipPermissions) {
    args.push("--dangerously-skip-permissions");
  }
  return args;
}

/**
 * Run `agy --print` once and capture its output.
 *
 * Resolves with `{ text, stderr, exitCode, signal, timedOut }`. A non-zero exit
 * is reported (not thrown) so callers can decide how to surface it. A spawn
 * failure (e.g. missing binary) rejects.
 */
export function runAgyPrint(options = {}) {
  const {
    cwd = process.cwd(),
    prompt = "",
    model = null,
    resume = false,
    conversationId = null,
    timeoutMs = DEFAULT_PRINT_TIMEOUT_MS,
    onLog = null,
    binaryPath = "agy",
    env = process.env,
    spawnImpl = spawn
  } = options;

  return new Promise((resolve, reject) => {
    const args = buildAgyArgs({ prompt, model, resume, conversationId });

    let child;
    try {
      child = spawnImpl(binaryPath, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
    } catch (error) {
      reject(error);
      return;
    }

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;

    const timer = timeoutMs > 0
      ? setTimeout(() => {
          timedOut = true;
          if (child.pid) {
            terminateProcessTree(child.pid);
          }
        }, timeoutMs)
      : null;

    const finish = (fn) => {
      if (settled) {
        return;
      }
      settled = true;
      if (timer) {
        clearTimeout(timer);
      }
      fn();
    };

    child.stdout?.on("data", (chunk) => {
      const text = chunk.toString();
      stdout += text;
      onLog?.(text);
    });
    child.stderr?.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      onLog?.(text);
    });
    child.on("error", (error) => finish(() => reject(error)));
    child.on("close", (code, signal) => {
      finish(() =>
        resolve({
          text: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code,
          signal: signal ?? null,
          timedOut
        })
      );
    });
  });
}

/**
 * Check whether the `agy` CLI is available. Returns `{ available, detail }`.
 */
export function getAgyAvailability(cwd = process.cwd(), options = {}) {
  return binaryAvailable("agy", ["--version"], { cwd, env: options.env });
}
