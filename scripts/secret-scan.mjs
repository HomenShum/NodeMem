/**
 * Secret scanner — checks for API keys, tokens, passwords in source files.
 * Exits non-zero if any secrets are found.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const SCAN_DIRS = ["src", "tests", "demo", "scripts"];
const SCAN_EXTS = new Set([".ts", ".tsx", ".mjs", ".js", ".json"]);
const IGNORE = new Set(["node_modules", "dist", ".git"]);

const PATTERNS = [
  /sk-[a-zA-Z0-9]{20,}/g,           // OpenAI
  /ghp_[a-zA-Z0-9]{36}/g,           // GitHub PAT
  /gho_[a-zA-Z0-9]{36}/g,           // GitHub OAuth
  /AKIA[0-9A-Z]{16}/g,              // AWS
  /xox[baprs]-[a-zA-Z0-9-]+/g,      // Slack
  /[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+@/g, // user:pass@
  /password\s*[:=]\s*["'][^"']{8,}/gi, // password =
  /api[_-]?key\s*[:=]\s*["'][^"']{20,}/gi, // api_key =
  /secret\s*[:=]\s*["'][^"']{8,}/gi, // secret =
  /token\s*[:=]\s*["'][^"']{20,}/gi, // token =
];

function walk(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    if (IGNORE.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...walk(full));
    } else if (SCAN_EXTS.has(extname(full))) {
      results.push(full);
    }
  }
  return results;
}

let found = 0;
for (const dir of SCAN_DIRS) {
  try {
    const files = walk(dir).filter((f) => !f.endsWith("secret-scan.mjs"));
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      for (const pattern of PATTERNS) {
        const matches = content.match(pattern);
        if (matches) {
          for (const m of matches) {
            console.error(`  ✗ SECRET FOUND: ${file} — ${m.slice(0, 20)}...`);
            found++;
          }
        }
      }
    }
  } catch {
    // Directory doesn't exist, skip.
  }
}

if (found > 0) {
  console.error(`\n  ✗ ${found} secret(s) found — ABORT`);
  process.exit(1);
} else {
  console.log("  ✓ No secrets found");
}
