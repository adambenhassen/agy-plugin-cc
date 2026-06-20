import test from "node:test";
import assert from "node:assert/strict";

import { parseAgyReview, extractJsonObject, composeReviewPrompt } from "../plugins/agy/scripts/lib/agy-review.mjs";

const CLEAN = JSON.stringify({ verdict: "approve", summary: "ok", findings: [], next_steps: [] });

test("parseAgyReview parses a clean JSON object", () => {
  const result = parseAgyReview(CLEAN);
  assert.equal(result.parseError, null);
  assert.equal(result.parsed.verdict, "approve");
  assert.equal(result.rawOutput, CLEAN);
});

test("parseAgyReview extracts JSON wrapped in code fences and prose", () => {
  const raw = "Here is the review:\n\n```json\n" + CLEAN + "\n```\n\nThanks!";
  const result = parseAgyReview(raw);
  assert.equal(result.parseError, null);
  assert.equal(result.parsed.verdict, "approve");
});

test("parseAgyReview extracts a JSON object embedded in surrounding text", () => {
  const raw = "blah blah " + CLEAN + " trailing";
  const result = parseAgyReview(raw);
  assert.equal(result.parseError, null);
  assert.deepEqual(result.parsed.findings, []);
});

test("parseAgyReview returns a fallback (never throws) for unparseable text", () => {
  const result = parseAgyReview("this is not json at all");
  assert.equal(result.parsed, null);
  assert.match(result.parseError, /JSON/i);
  assert.equal(result.rawOutput, "this is not json at all");
});

test("extractJsonObject handles nested braces and braces inside strings", () => {
  const json = '{"a":{"b":"}"},"c":1}';
  assert.equal(extractJsonObject("prefix " + json + " suffix"), json);
});

test("composeReviewPrompt embeds the schema, target, and review input", () => {
  const context = {
    target: { label: "uncommitted changes" },
    collectionGuidance: "GUIDANCE_TEXT",
    content: "DIFF_CONTENT_HERE"
  };
  const schema = { type: "object", required: ["verdict"] };
  const prompt = composeReviewPrompt(context, { adversarial: true, focusText: "auth", schema });
  assert.match(prompt, /uncommitted changes/);
  assert.match(prompt, /DIFF_CONTENT_HERE/);
  assert.match(prompt, /"verdict"/);
  assert.match(prompt, /auth/);
});

test("composeReviewPrompt supports a non-adversarial review template", () => {
  const context = {
    target: { label: "branch vs main" },
    collectionGuidance: "G",
    content: "C"
  };
  const prompt = composeReviewPrompt(context, { adversarial: false, schema: { type: "object" } });
  assert.match(prompt, /branch vs main/);
  assert.match(prompt, /C/);
});
