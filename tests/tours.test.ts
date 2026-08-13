/**
 * The guided tours point at real lines.
 *
 * A CodeTour with a stale line number is worse than no tour: it sends a new
 * engineer to the wrong place with full confidence. Files move, so this runs on
 * every `npm test`.
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
      // A step landing on a blank line means the file moved underneath the tour.
      expect(lines[step.line - 1].trim(), `${where} — lands on a blank line`).not.toBe("");
      expect(String(step.description).length, `${where} — description too short to be useful`).toBeGreaterThan(20);
    }
  });
});
