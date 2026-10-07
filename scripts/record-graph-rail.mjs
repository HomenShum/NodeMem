/**
 * Record demo/graph-rail as a live clip — the capture gate's honest sequence,
 * on video instead of two stills.
 *
 * Same static server and window.__graphRail hooks as
 * scripts/capture-graph-rail.mjs. The clip shows: the pipeline noticing
 * entities (dim, unmeasured nodes appearing), a human hovering then clicking
 * one real Confirm button, and the single traversal edge that draws. Nothing
 * is staged; the recording is the demo running.
 *
 * Output: assets/graph-rail/live-graph-rail.gif (via ffmpeg; webm kept in the
 * OS temp dir only).
 *
 *   node scripts/record-graph-rail.mjs
 */

import { stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { serveRepo, DEMO_PATH } from "./serve.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const { server, origin } = await serveRepo();
const url = `${origin}${DEMO_PATH}`;

const videoDir = join(tmpdir(), `graph-rail-video-${Date.now()}`);
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1400, height: 860 },
  recordVideo: { dir: videoDir, size: { width: 1400, height: 860 } },
});
const page = await context.newPage();
page.on("pageerror", (e) => console.error("  page error:", e.message));

await page.goto(url);
await page.waitForFunction(() => window.__graphRail?.pipelineDone === true, null, { timeout: 30000 });
await page.waitForTimeout(4000); // watch the noticed nodes settle, still edge-less

// A human confirms exactly ONE suggestion: hover first, pause, then click.
const confirm = page.locator('[data-testid="confirm-suggestion"]').first();
await confirm.hover();
await page.waitForTimeout(1200);
await confirm.click();
await page.waitForFunction(() => window.__graphRail.session.getSnapshot().edges.length === 1, null, { timeout: 5000 });
await page.waitForTimeout(5000); // watch the single traversal edge settle

const video = page.video();
await context.close(); // flushes the webm
await browser.close();
server.close();
const webm = await video.path();

const gif = join(root, "assets", "graph-rail", "live-graph-rail.gif");
const ff = spawnSync(
  "ffmpeg",
  ["-y", "-i", webm, "-vf", "fps=8,scale=960:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer", gif],
  { stdio: ["ignore", "inherit", "inherit"] },
);
if (ff.status !== 0) {
  console.error(`  ✗ ffmpeg failed (webm kept at ${webm})`);
  process.exit(1);
}
const size = (await stat(gif)).size;
console.log(`  ✓ ${gif} (${(size / 1024 / 1024).toFixed(2)} MB, source ${webm})`);
