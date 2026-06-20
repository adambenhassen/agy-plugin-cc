---
description: Check whether the local Agy CLI is ready and optionally toggle the stop-time review gate
argument-hint: '[--enable-review-gate|--disable-review-gate]'
allowed-tools: Bash(node:*)
---

Run:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/agy-companion.mjs" setup --json $ARGUMENTS
```

Output rules:
- Present the setup output to the user.
- If the result says Agy is unavailable, tell the user to install the `agy` CLI and make sure it is on their `PATH`, then rerun `/agy:setup`. If `agy` is already installed, suggest `agy update`.
- The `agy` CLI is a prebuilt binary; do not attempt to install it with a package manager.
