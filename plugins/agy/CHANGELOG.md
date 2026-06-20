# Changelog

## Unreleased

- Fork of openai/codex-plugin-cc, re-targeted to drive the `agy` CLI instead of Codex.
- Runtime rewritten around one-shot `agy --print` invocations; the Codex app-server/broker layer was removed.
- Reviews prompt Agy for structured findings and parse them tolerantly, falling back to raw output.
- Rebranded all commands, the subagent, and skills to the `agy` namespace.

## 1.0.0

- Initial version of the Antigravity plugin for Claude Code
