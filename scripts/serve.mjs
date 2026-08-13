/**
 * Serves the repository over HTTP so a browser can open `demo/graph-rail/`.
 *
 * Run directly, it is this repo's `npm run dev` — it prints the one URL worth
 * opening and stays up. Imported, it is the same server the two capture scripts
 * start on an ephemeral port, so the page a human looks at and the page the
 * gate asserts against are served identically.
 *
 * No build step and no framework on purpose: `demo/graph-rail/index.html` is
 * hand-written ES modules resolved through an importmap, so plain static files
 * are all it needs.
 *
 *   npm run dev            # http://127.0.0.1:5173/demo/graph-rail/index.html
 *   PORT=8080 npm run dev
 */

import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".map": "application/json",
  ".json": "application/json",
  ".css": "text/css",
  ".png": "image/png",
  ".gif": "image/gif",
};

/** The one page this server exists to serve. */
export const DEMO_PATH = "/demo/graph-rail/index.html";

/**
 * Start a static file server rooted at the repository.
 *
 * @param {number} port - 0 asks the OS for a free port, which is what the
 *   capture scripts want so parallel runs never collide.
 * @returns {Promise<{ server: http.Server, origin: string }>}
 */
export async function serveRepo(port = 0) {
  const server = http.createServer(async (req, res) => {
    try {
      // Strip the leading slash so `join` cannot escape ROOT, then prove it.
      const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^([/\\])+/, "");
      const file = join(ROOT, path);
      if (!file.startsWith(normalize(ROOT))) throw new Error("outside root");
      const body = await readFile(file);
      res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end("not found");
    }
  });
  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  return { server, origin: `http://127.0.0.1:${server.address().port}` };
}

// Run directly: stay up and tell the human where to look.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { origin } = await serveRepo(Number(process.env.PORT) || 5173);
  console.log(`\n  NodeMem graph rail → ${origin}${DEMO_PATH}`);
  console.log("  (the page loads React, graphology and sigma from esm.sh at run time)");
  console.log("  Ctrl-C to stop.\n");
}
