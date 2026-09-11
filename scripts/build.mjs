#!/usr/bin/env node
/**
 * Renders the static site into dist/.
 *
 * The whole point of the build step is that `tenants.json` stays the single
 * source of truth: it is rendered into the picker markup (so the page works
 * without JS) and inlined into the head script (so the redirect can run
 * before paint). index.html and 404.html are byte-identical -- the script
 * reads the requested path from `location`, so one page serves both the root
 * and every deep link.
 */

import { readFile, writeFile, mkdir, copyFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");

/** Files copied verbatim. CNAME binds the custom domain; .nojekyll stops
 *  GitHub from running the output through Jekyll. */
const STATIC_FILES = ["CNAME", "robots.txt", "public/Logo-Light.png", "public/Logo-Dark.png", "public/favicon.ico"];

const CHEVRON = `<svg class="chevron" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3l5 5-5 5" /></svg>`;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Reject anything that is not a plain https origin. A trailing slash or a
 * path here would be silently concatenated with the requested path and
 * produce a broken destination, so it fails the build instead.
 */
function validateTenant(tenant, index) {
  const where = `tenants[${index}]`;
  for (const field of ["id", "name", "detail", "origin"]) {
    if (typeof tenant[field] !== "string" || !tenant[field].trim()) {
      throw new Error(`${where}: "${field}" must be a non-empty string`);
    }
  }
  let url;
  try {
    url = new URL(tenant.origin);
  } catch {
    throw new Error(`${where}: origin "${tenant.origin}" is not a valid URL`);
  }
  if (url.protocol !== "https:") {
    throw new Error(`${where}: origin must be https, got "${tenant.origin}"`);
  }
  if (tenant.origin !== url.origin) {
    throw new Error(`${where}: origin must have no path, query, or trailing slash (expected "${url.origin}")`);
  }
}

function renderButtons(tenants) {
  if (tenants.length === 0) {
    return `<p class="empty">No deployments are configured yet.</p>`;
  }
  return tenants
    .map(
      (tenant) =>
        // href points at the school's root so this is a working link with JS
        // disabled; the head script upgrades it to include the requested path.
        `<a class="school" data-school="${escapeHtml(tenant.id)}" href="${escapeHtml(tenant.origin)}/">` +
        `<span><span class="school-name">${escapeHtml(tenant.name)}</span><br />` +
        `<span class="school-detail">${escapeHtml(tenant.detail)}</span></span>` +
        CHEVRON +
        `</a>`
    )
    .join("");
}

const { tenants } = JSON.parse(await readFile(join(root, "tenants.json"), "utf8"));
if (!Array.isArray(tenants)) {
  throw new Error("tenants.json: expected a `tenants` array");
}
tenants.forEach(validateTenant);

const ids = tenants.map((t) => t.id);
const duplicate = ids.find((id, i) => ids.indexOf(id) !== i);
if (duplicate) {
  throw new Error(`tenants.json: duplicate tenant id "${duplicate}"`);
}

const template = await readFile(join(root, "src", "template.html"), "utf8");

// Only the fields the client actually needs, so the page does not carry
// build-time metadata into the bundle.
const clientTenants = tenants.map(({ id, origin }) => ({ id, origin }));

for (const marker of ["/*__TENANTS__*/", "<!--__SCHOOL_BUTTONS__-->"]) {
  if (!template.includes(marker)) {
    throw new Error(`src/template.html is missing the ${marker} placeholder`);
  }
}

const html = template
  .replace("/*__TENANTS__*/ []", JSON.stringify(clientTenants))
  .replace("<!--__SCHOOL_BUTTONS__-->", renderButtons(tenants));

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

// 404.html is the catch-all: GitHub Pages serves it for every path it has no
// file for, leaving the requested URL in the address bar for the script to read.
await writeFile(join(dist, "index.html"), html);
await writeFile(join(dist, "404.html"), html);
await writeFile(join(dist, ".nojekyll"), "");
await copyFile(join(root, "src", "styles.css"), join(dist, "styles.css"));

for (const file of STATIC_FILES) {
  await copyFile(join(root, file), join(dist, file.replace(/^public\//, "")));
}

console.log(`Built dist/ with ${tenants.length} school${tenants.length === 1 ? "" : "s"}: ${ids.join(", ")}`);
