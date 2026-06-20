import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadPromptTemplate, interpolateTemplate } from "./prompts.mjs";

const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Extract the first balanced JSON object from arbitrary text.
 *
 * Agy returns plain text, so a structured review may be wrapped in prose or
 * code fences. This scans for the first `{`, then walks to its matching `}`,
 * ignoring braces inside string literals. Returns the JSON substring or null.
 */
export function extractJsonObject(text) {
  if (typeof text !== "string") {
    return null;
  }
  const start = text.indexOf("{");
  if (start === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === "{") {
      depth++;
    } else if (char === "}") {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
}

/**
 * Tolerantly parse an agy review response into the shape `renderReviewResult`
 * expects: `{ parsed, parseError, rawOutput }`. Never throws.
 */
export function parseAgyReview(rawText) {
  const rawOutput = typeof rawText === "string" ? rawText : "";
  const candidate = extractJsonObject(rawOutput);
  if (!candidate) {
    return { parsed: null, parseError: "Agy did not return a JSON object.", rawOutput };
  }
  try {
    return { parsed: JSON.parse(candidate), parseError: null, rawOutput };
  } catch (error) {
    return { parsed: null, parseError: error instanceof Error ? error.message : String(error), rawOutput };
  }
}

/**
 * Build a review prompt for agy. Reuses the prompt templates and appends an
 * explicit schema contract, since agy has no separate structured-output param.
 */
export function composeReviewPrompt(context, options = {}) {
  const { adversarial = false, focusText = "", schema, rootDir = PLUGIN_ROOT } = options;
  const templateName = adversarial ? "adversarial-review" : "review";
  const template = loadPromptTemplate(rootDir, templateName);

  const body = interpolateTemplate(template, {
    REVIEW_KIND: adversarial ? "Adversarial Review" : "Review",
    TARGET_LABEL: context.target.label,
    USER_FOCUS: focusText || "No extra focus provided.",
    REVIEW_COLLECTION_GUIDANCE: context.collectionGuidance ?? "",
    REVIEW_INPUT: context.content ?? ""
  });

  const schemaBlock = [
    "",
    "<output_schema>",
    "Respond with ONLY a single JSON object matching this JSON Schema.",
    "Do not wrap it in code fences and do not add any prose before or after it.",
    JSON.stringify(schema, null, 2),
    "</output_schema>",
    ""
  ].join("\n");

  return `${body}${schemaBlock}`;
}
