#!/usr/bin/env node
/**
 * Serves dist/ the way GitHub Pages does, so the redirect behaviour can be
 * checked locally before deploying.
 *
 * The part that matters is the fallback: any path with no matching file gets
 * 404.html *with a 404 status* and the requested URL left untouched. That
 * status is what a real deep link returns in production too, so testing
 * against a plain static server would hide it.
 */

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, normalize } from "node:path";

const dist = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const port = Number(process.env.PORT ?? 4321);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8"
};

function contentType(path) {
  const ext = path.slice(path.lastIndexOf("."));
  return TYPES[ext] ?? "application/octet-stream";
}

async function readIfFile(path) {
  // Contain traversal: a request for ../../etc/passwd must not escape dist/.
  if (!normalize(path).startsWith(dist)) return null;
  try {
    if (!(await stat(path)).isFile()) return null;
    return await readFile(path);
  } catch {
    return null;
  }
}

createServer(async (request, response) => {
  // GitHub Pages serves GET and HEAD only; anything else is rejected outright.
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { "content-type": "text/plain; charset=utf-8", allow: "GET, HEAD" });
    response.end("Method Not Allowed\n");
    return;
  }

  const pathname = decodeURIComponent(new URL(request.url, `http://localhost:${port}`).pathname);
  const candidate = pathname.endsWith("/") ? join(dist, pathname, "index.html") : join(dist, pathname);

  const body = await readIfFile(candidate);
  if (body) {
    response.writeHead(200, { "content-type": contentType(candidate) });
    response.end(request.method === "HEAD" ? undefined : body);
    return;
  }

  const fallback = await readFile(join(dist, "404.html"));
  response.writeHead(404, { "content-type": "text/html; charset=utf-8" });
  response.end(request.method === "HEAD" ? undefined : fallback);
}).listen(port, () => {
  console.log(`Serving dist/ with GitHub Pages semantics on http://localhost:${port}`);
});
