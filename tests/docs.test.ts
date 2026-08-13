/**
 * The documents point at the right lines, and count the tree instead of guessing.
 *
 * Two failures this file exists to stop, both of which shipped here:
 *
 * 1. A citation that names a symbol and a line number that no longer holds it.
 *    `docs/NODE-LOOPS.md` sent readers to `scanOrchestrator.ts:94` for
 *    `scanActivity` — a line inside a comment, seven lines above the function.
 *    A guard that only checks "is that line number in range" passes every one of
 *    these, because every line in a file is in range. So a citation must carry
 *    the symbol it claims is there, written `` `symbol` (`path:line`) ``, and the
 *    cited line must contain it.
 * 2. A count typed by hand. `START_HERE.md` and `TESTING.md` both said "47
 *    tests" against a tree with more than that. Counts in prose are derived
 *    here, from the same directory read the suite itself runs on.
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";

const repo = new URL("../", import.meta.url);
const read = (p: string) => readFileSync(new URL(p, repo), "utf8");

/** Every markdown file in the repo, plus the tours, whose descriptions cite code too. */
const docs = (function walk(dir: string): string[] {
  return readdirSync(new URL(dir, repo), { withFileTypes: true }).flatMap((e) => {
    if (e.name === "node_modules" || e.name === ".git") return [];
    const p = `${dir}${e.name}`;
    if (e.isDirectory()) return walk(`${p}/`);
    return p.endsWith(".md") || p.endsWith(".tour") ? [p] : [];
  });
})("");

/** `` `symbol` (`path:line`) `` — the only citation form the guard can check. */
const CITATION = /`([^`\n]+)`\s*\(`([^`\n:]+):(\d+)`\)/g;
/** Any `path:line` at all, canonical or not. An unchecked citation is the defect. */
const ANY_PATH_LINE = /[\w./-]+\.(?:ts|tsx|js|mjs|html|md|json|ya?ml|tour):\d+/g;

const testFiles = readdirSync(new URL("tests/", repo)).filter((f) => f.endsWith(".test.ts"));

describe("citations in the documents", () => {
  it.each(docs)("%s cites lines that contain the symbol they name", (doc) => {
    const text = read(doc);
    const checked: Array<[number, number]> = [];

    for (const m of text.matchAll(CITATION)) {
      const [full, symbol, file, line] = m;
      checked.push([m.index!, m.index! + full.length]);
      const where = `${doc}: ${full}`;
      expect(existsSync(new URL(file, repo)), `${where} — file is missing`).toBe(true);

      const lines = read(file).split("\n");
      const n = Number(line);
      expect(n, `${where} — past end of file (${lines.length} lines)`).toBeLessThanOrEqual(lines.length);
      expect(
        lines[n - 1],
        `${where} — that line is ${JSON.stringify(lines[n - 1].trim())}`,
      ).toContain(symbol);
    }

    // A citation written any other way is one nothing above checked. Both forms
    // that escaped before: a bare `path:line`, and prose "(line 81)" whose file
    // is only implied by a heading several lines up.
    for (const m of [...text.matchAll(ANY_PATH_LINE), ...text.matchAll(/line \d+/g)]) {
      const inside = checked.some(([start, end]) => m.index! >= start && m.index! < end);
      expect(inside, `${doc}: "${m[0]}" is a citation in a form this guard cannot check — write it as \`symbol\` (\`path:line\`)`).toBe(true);
    }
  });
});

describe("counts in the documents", () => {
  it("says how many test files there are, and is right", () => {
    let claims = 0;
    for (const doc of docs) {
      for (const m of read(doc).matchAll(/(\d+) test files/g)) {
        claims += 1;
        expect(Number(m[1]), `${doc}: "${m[0]}" — the tree has ${testFiles.length}`).toBe(testFiles.length);
      }
    }
    expect(claims, "no document states the size of the suite").toBeGreaterThan(0);
  });

  it("gives every test file a row in TESTING.md", () => {
    const testing = read("docs/codebase/TESTING.md");
    for (const f of testFiles) {
      expect(testing, `docs/codebase/TESTING.md does not mention tests/${f}`).toContain(`tests/${f}`);
    }
  });
});
