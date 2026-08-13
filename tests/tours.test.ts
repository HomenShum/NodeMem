/**
 * The guided tours point at the right lines — not merely at lines that exist.
 *
 * A CodeTour with a stale line number is worse than no tour: it sends a new
 * engineer to the wrong place with full confidence. Checking that the number is
 * in range does not catch that; every line in the file is in range. So each step
 * carries the `symbol` it is about, and the check is that the cited line still
 * contains it. This found a live defect: step 2 of tour 1 pointed at the line
 * closing a docblock, one above the `DEMO_EVENTS` array it claimed to show.
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";

const toursDir = new URL("../.tours/", import.meta.url);
const tourFiles = readdirSync(toursDir).filter((f) => f.endsWith(".tour"));

describe(".tours", () => {
  it("has tours to check", () => {
    expect(tourFiles.length).toBeGreaterThan(0);
  });

  it.each(tourFiles)("%s points only at lines that exist", (tourFile) => {
    const tour = JSON.parse(readFileSync(new URL(tourFile, toursDir), "utf8"));
    expect(tour.steps.length).toBeGreaterThan(0);

    for (const step of tour.steps) {
      const where = `${tourFile}: ${step.file}:${step.line}`;
      const target = new URL(`../${step.file}`, import.meta.url);
      expect(existsSync(target), `${where} — file is missing`).toBe(true);

      const lines = readFileSync(target, "utf8").split("\n");
      expect(step.line, `${where} — not a line number`).toBeGreaterThan(0);
      expect(step.line, `${where} — past end of file (${lines.length} lines)`).toBeLessThanOrEqual(lines.length);
      // The check that matters: the cited line is the one the step is about.
      // Without `symbol` the step only proves a line exists, which every line does.
      expect(typeof step.symbol, `${where} — step has no "symbol" to check the line against`).toBe("string");
      expect(
        lines[step.line - 1],
        `${where} — cited line does not contain ${JSON.stringify(step.symbol)}; it is ${JSON.stringify(lines[step.line - 1].trim())}`,
      ).toContain(step.symbol);
      expect(String(step.description).length, `${where} — description too short to be useful`).toBeGreaterThan(20);
    }
  });
});
