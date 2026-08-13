/**
 * Package contract — what someone gets when they install this package.
 *
 * The person: an engineer who read the README, ran `npm i`, and typed the
 * import line the README shows. If the README promises `computeDebounce` and
 * the package barrel does not export it, their editor goes red on line one and
 * nothing in the test suite noticed. These checks make the README's promises
 * executable.
 */

import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import * as api from "../src/index.js";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

/** Every symbol the README tells a reader to import from "nodemem". */
const README_IMPORTS = [
  "classifyNoteworthy",
  "scanActivity",
  "InMemoryAdapter",
  "computeDebounce",
];

describe("package barrel", () => {
  it.each(README_IMPORTS)("exports %s, which the README tells readers to import", (name) => {
    expect(Object.keys(api)).toContain(name);
  });
});

describe("package.json", () => {
  it("declares no bin entry pointing at a file that does not exist", () => {
    for (const target of Object.values(pkg.bin ?? {}) as string[]) {
      expect(existsSync(new URL(`../${target}`, import.meta.url)), `bin target ${target}`).toBe(true);
    }
  });

  it("gets every binary its scripts invoke from a dependency it declares", () => {
    // `npm run dev` used to run `vite`. Nothing here depends on vite — it was
    // only reachable because vitest happens to install it, which npm does not
    // promise. The command failed for a human and for nobody else.
    const provided = new Set<string>();
    for (const dep of [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.devDependencies ?? {})]) {
      const depUrl = new URL(`../node_modules/${dep}/package.json`, import.meta.url);
      if (!existsSync(depUrl)) continue;
      const bin = JSON.parse(readFileSync(depUrl, "utf8")).bin;
      if (typeof bin === "string") provided.add(dep);
      else Object.keys(bin ?? {}).forEach((name) => provided.add(name));
    }

    const invoked = Object.values(pkg.scripts as Record<string, string>)
      .flatMap((line) => line.split("&&"))
      .map((part) => part.trim().split(/\s+/)[0])
      .filter((bin) => bin && !["node", "npm", "npx"].includes(bin));

    for (const bin of new Set(invoked)) {
      expect(provided, `\`${bin}\` is in a script but no declared dependency provides it`).toContain(bin);
    }
  });
});
