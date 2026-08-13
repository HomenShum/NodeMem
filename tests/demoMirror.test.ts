/**
 * Demo mirror parity.
 *
 * The situation: the library's classifier is written in TypeScript
 * (`src/core/classifier.ts`). A browser opening `demo/graph-rail/index.html`
 * cannot run TypeScript, and the README promises a terminal demo that needs no
 * install and no build step — so a plain-JavaScript copy of the same classifier
 * lives at `demo/nodeMemDemoCore.mjs` and both demo surfaces import it.
 *
 * Two copies of one rule drift. They already had: on "The Next Series will be
 * announced" the library returned no entity and the demo copy invented a
 * company called "The Next Series". This test is the leash. If the two ever
 * disagree again, this fails instead of a screenshot lying.
 *
 * Delete this file the day the demo copy is deleted — not before.
 */

import { describe, it, expect } from "vitest";
import { classifyNoteworthy as library } from "../src/core/classifier.js";
// @ts-expect-error - the demo mirror is plain JavaScript with no type declarations.
import { classifyNoteworthy as demoCopy, DEMO_EVENTS } from "../demo/nodeMemDemoCore.mjs";

const CORPUS: string[] = [
  ...(DEMO_EVENTS as string[]),
  "The Next Series will be announced",
  "CardioNova Inc just raised their Series A",
  "Met with the founder last week about their runway",
  "Check out https://example.com for more info",
  "hello world",
  "",
];

describe("demo/nodeMemDemoCore.mjs mirrors src/core/classifier.ts", () => {
  it.each(CORPUS)("agrees on %j", (text) => {
    // Whole finding, not a chosen subset: score, action, entities, signals,
    // evidence spans, facets and version all have to match.
    expect(demoCopy(text)).toEqual(library(text));
  });
});
