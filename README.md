# Agy plugin for Claude Code

Use Agy from inside Claude Code for code reviews or to delegate tasks to Agy.

This plugin is for Claude Code users who want an easy way to delegate work to the `agy` CLI from
the workflow they already have.

## What You Get

- `/agy:review` for a read-only Agy code review
- `/agy:adversarial-review` for a steerable challenge review
- `/agy:rescue`, `/agy:status`, `/agy:result`, and `/agy:cancel` to delegate work and manage background jobs

## Requirements

- **The `agy` CLI installed and on your `PATH`.**
- **Node.js 18.18 or later.**

## Install

Add the marketplace in Claude Code:

```bash
/plugin marketplace add adambenhassen/agy-plugin-cc
```

Install the plugin:

```bash
/plugin install agy@agy
```

Reload plugins:

```bash
/reload-plugins
```

Then run:

```bash
/agy:setup
```

`/agy:setup` tells you whether the `agy` CLI is installed and on your `PATH`. If it is missing,
install `agy` and make sure it is on your `PATH`, then rerun `/agy:setup`. If `agy` is already
installed, you can update it with `agy update`.

After install, you should see:

- the slash commands listed below
- the `agy:agy-rescue` subagent in `/agents`

One simple first run is:

```bash
/agy:review --background
/agy:status
/agy:result
```

## Usage

### `/agy:review`

Runs a read-only Agy review of your current work.

> [!NOTE]
> Code review, especially for multi-file changes, might take a while. It's generally recommended to run it in the background.

Use it when you want:

- a review of your current uncommitted changes
- a review of your branch compared to a base branch like `main`

Use `--base <ref>` for branch review. It also supports `--wait` and `--background`. Use
[`/agy:adversarial-review`](#agyadversarial-review) when you want to challenge a specific decision
or risk area.

Examples:

```bash
/agy:review
/agy:review --base main
/agy:review --background
```

This command is read-only and will not perform any changes. When run in the background you can use
[`/agy:status`](#agystatus) to check on the progress and [`/agy:cancel`](#agycancel) to cancel the
ongoing task.

### `/agy:adversarial-review`

Runs a **steerable** review that questions the chosen implementation and design.

It can be used to pressure-test assumptions, tradeoffs, failure modes, and whether a different approach would have been safer or simpler.

It uses the same review target selection as `/agy:review`, including `--base <ref>` for branch review.
It also supports `--wait` and `--background`. Unlike `/agy:review`, it can take extra focus text after the flags.

Use it when you want:

- a review before shipping that challenges the direction, not just the code details
- review focused on design choices, tradeoffs, hidden assumptions, and alternative approaches
- pressure-testing around specific risk areas like auth, data loss, rollback, race conditions, or reliability

Examples:

```bash
/agy:adversarial-review
/agy:adversarial-review --base main challenge whether this was the right caching and retry design
/agy:adversarial-review --background look for race conditions and question the chosen approach
```

This command is read-only. It does not fix code.

### `/agy:rescue`

Hands a task to Agy through the `agy:agy-rescue` subagent.

Use it when you want Agy to:

- investigate a bug
- try a fix
- continue a previous Agy task
- take a pass with a specific model

> [!NOTE]
> Depending on the task and the model you choose, these tasks might take a long time, so it's generally recommended to run the task in the background or move the agent to the background.

It supports `--background`, `--wait`, `--resume`, and `--fresh`. If you omit `--resume` and `--fresh`, the plugin can offer to continue the latest rescue task for this repo.

Examples:

```bash
/agy:rescue investigate why the tests started failing
/agy:rescue fix the failing test with the smallest safe patch
/agy:rescue --resume apply the top fix from the last run
/agy:rescue --model "Claude Opus 4.6 (Thinking)" investigate the flaky integration test
/agy:rescue --background investigate the regression
```

You can also just ask for a task to be delegated to Agy:

```text
Ask Agy to redesign the database connection to be more resilient.
```

**Notes:**

- if you do not pass `--model`, Agy uses its own default model.
- pass a full agy model name with `--model`, e.g. `--model "Gemini 3.5 Flash (High)"` (see `agy models`).
- follow-up rescue requests can continue the latest Agy task in the repo.

### `/agy:status`

Shows running and recent Agy jobs for the current repository.

Examples:

```bash
/agy:status
/agy:status task-abc123
```

Use it to:

- check progress on background work
- see the latest completed job
- confirm whether a task is still running

### `/agy:result`

Shows the final stored Agy output for a finished job.

Examples:

```bash
/agy:result
/agy:result task-abc123
```

### `/agy:cancel`

Cancels an active background Agy job.

Examples:

```bash
/agy:cancel
/agy:cancel task-abc123
```

### `/agy:setup`

Checks whether the `agy` CLI is installed and on your `PATH`.

You can also use `/agy:setup` to manage the optional review gate.

#### Enabling review gate

```bash
/agy:setup --enable-review-gate
/agy:setup --disable-review-gate
```

When the review gate is enabled, the plugin uses a `Stop` hook to run a targeted Agy review based on Claude's response. If that review finds issues, the stop is blocked so Claude can address them first.

> [!WARNING]
> The review gate can create a long-running Claude/Agy loop and may drain usage limits quickly. Only enable it when you plan to actively monitor the session.

## Typical Flows

### Review Before Shipping

```bash
/agy:review
```

### Hand A Problem To Agy

```bash
/agy:rescue investigate why the build is failing in CI
```

### Start Something Long-Running

```bash
/agy:adversarial-review --background
/agy:rescue --background investigate the flaky test
```

Then check in with:

```bash
/agy:status
/agy:result
```

## How It Works

The plugin shells out to your local `agy` CLI, running one `agy --print` invocation per command on
the same repository checkout and machine-local environment. Reviews ask Agy to return structured
findings; rescue runs forward the task to Agy and return its output verbatim.

- Choose the model for a run with `--model "<agy model name>"` (see `agy models`); otherwise Agy uses its default.
- Resume continues the most recent Agy conversation for the repo (`agy --continue`).

## Attribution

This project is a fork of [openai/codex-plugin-cc](https://github.com/openai/codex-plugin-cc),
re-targeted to drive the `agy` CLI. It is distributed under the Apache-2.0 license; see `LICENSE`
and `NOTICE`.
