import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const mediaPath = "assets/noderoom-review-approve.gif";
const storyboardPath = "docs/FEATURE_PROOF_STORYBOARD.md";
const receiptPath = "docs/eval/nodemem-storyboard-proof.json";

const requiredStoryBeats = [
  "Passive scan",
  "Noteworthy suggestion",
  "Explicit approval",
  "Dismissal learning",
  "Provider-neutral storage",
];

main();

function main() {
  const media = readFileSync(mediaPath);
  const stats = statSync(mediaPath);
  const storyboard = readFileSync(storyboardPath, "utf8");
  const missingBeats = requiredStoryBeats.filter((beat) => !storyboard.includes(beat));
  if (missingBeats.length > 0) {
    throw new Error(`storyboard missing proof beats: ${missingBeats.join(", ")}`);
  }

  const receipt = {
    generatedAt: new Date().toISOString(),
    media: {
      path: mediaPath,
      bytes: stats.size,
      sha256: createHash("sha256").update(media).digest("hex"),
    },
    storyboard: {
      path: storyboardPath,
      requiredBeats: requiredStoryBeats,
    },
    smokeReceipts: [
      "docs/eval/nodemem-smoke.json",
      "docs/eval/nodemem-in-memory-smoke.json",
      "docs/eval/nodemem-convex-smoke.json",
    ],
    note:
      "This repo validates the checked-in NodeRoom capture. A future standalone showcase should replace this with browser frame capture.",
  };

  mkdirSync(dirname(receiptPath), { recursive: true });
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(`nodemem storyboard proof: PASS ${mediaPath} -> ${receiptPath}`);
}
