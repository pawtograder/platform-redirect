#!/usr/bin/env node
/**
 * Browser tests for the redirector.
 *
 * Everything this site does happens in the browser -- the path is read from
 * `location`, the choice lives in localStorage, the forward is a
 * `location.replace`. None of that is observable to curl, so these run a real
 * Chromium against the Pages-semantics dev server.
 *
 * Navigations to the school's origin are intercepted, so the tests assert on
 * the URL that was navigated to without the deployment needing to be up.
 *
 * Usage: node tests/redirect.test.mjs   (build first; starts its own server)
 */

import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = process.env.TEST_PORT ?? "4322";
const BASE = `http://localhost:${PORT}`;
const TENANT = "https://pawtograder.khoury.northeastern.edu";

let pass = 0;
let fail = 0;

function check(name, actual, expected) {
  if (actual === expected) {
    pass++;
    console.log(`PASS  ${name}`);
    return;
  }
  fail++;
  console.log(`FAIL  ${name}\n        expected: ${expected}\n        actual:   ${actual}`);
}

async function waitForServer(url, attempts = 60) {
  for (let i = 0; i < attempts; i++) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(`server at ${url} did not come up`);
}

const server = spawn(process.execPath, [join(root, "scripts", "serve.mjs")], {
  env: { ...process.env, PORT },
  stdio: "ignore"
});

let browser;
try {
  await waitForServer(BASE);
  browser = await chromium.launch();

  /** A context whose navigations to the school are stubbed out. */
  async function newCtx(options = {}) {
    const ctx = await browser.newContext(options);
    await ctx.route(`${TENANT}/**`, (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: "<html><body>TENANT</body></html>" })
    );
    return ctx;
  }

  // The Pages fallback is what makes a static catch-all possible at all: the
  // requested URL must survive being served 404.html.
  {
    const ctx = await newCtx();
    const page = await ctx.newPage();
    const res = await page.goto(`${BASE}/course/12/assignments/34?tab=files`);
    check("deep link returns 404 status (Pages fallback)", res.status(), 404);
    check("deep link stays on redirector", new URL(page.url()).host, `localhost:${PORT}`);
    check("picker heading renders", await page.locator("h1").textContent(), "Choose your school");
    check("picker body is visible (not left hidden)", await page.locator("main.card").isVisible(), true);
    check(
      "destination note shows requested path",
      (await page.locator("#destination").textContent()).replace(/\s+/g, " ").trim(),
      "You’ll be taken to /course/12/assignments/34?tab=files on the site you choose."
    );
    check(
      "school link upgraded to include path",
      await page.locator("[data-school]").getAttribute("href"),
      `${TENANT}/course/12/assignments/34?tab=files`
    );
    await ctx.close();
  }

  {
    const ctx = await newCtx();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/course/12/assignments/34?tab=files`);
    await page.locator("[data-school]").click();
    await page.waitForURL(/northeastern\.edu/);
    check("click forwards with path intact", page.url(), `${TENANT}/course/12/assignments/34?tab=files`);

    await page.goto(`${BASE}/course/99?x=1`);
    await page.waitForURL(/northeastern\.edu/);
    check("returning visit auto-forwards", page.url(), `${TENANT}/course/99?x=1`);
    check("auto-forward never renders picker", await page.locator("h1").count(), 0);
    await ctx.close();
  }

  {
    const ctx = await newCtx();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`);
    await page.locator("[data-school]").click();
    await page.waitForURL(/northeastern\.edu/);

    await page.goto(`${BASE}/change-school`);
    check("change-school shows picker", await page.locator("h1").textContent(), "Choose your school");
    check(
      "change-school link targets tenant root, not /change-school",
      await page.locator("[data-school]").getAttribute("href"),
      `${TENANT}/`
    );
    check("change-school hides destination note", await page.locator("#destination").isVisible(), false);
    check("choice cleared from storage", await page.evaluate(() => window.localStorage.getItem("ptg_school")), null);

    await page.goto(`${BASE}/course/5`);
    check("after reset, deep link shows picker again", await page.locator("h1").textContent(), "Choose your school");
    await ctx.close();
  }

  // A school that is removed from the registry must not leave visitors stuck.
  {
    const ctx = await newCtx();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`);
    await page.evaluate(() => window.localStorage.setItem("ptg_school", "school-that-was-removed"));
    await page.goto(`${BASE}/course/7`);
    check("stale school id falls back to picker", await page.locator("h1").textContent(), "Choose your school");
    check("stale school id is purged", await page.evaluate(() => window.localStorage.getItem("ptg_school")), null);
    await ctx.close();
  }

  // The destination origin always comes from the registry, so a crafted path
  // cannot point the redirect at another host.
  {
    const ctx = await newCtx();
    const page = await ctx.newPage();
    await page.goto(`${BASE}//evil.example/x`);
    const href = await page.locator("[data-school]").getAttribute("href");
    check("protocol-relative path stays on tenant host", new URL(href).host, "pawtograder.khoury.northeastern.edu");
    await ctx.close();
  }

  {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/course/12`);
    check("no-JS picker is visible", await page.locator("main.card").isVisible(), true);
    check(
      "no-JS link falls back to tenant root",
      await page.locator("[data-school]").getAttribute("href"),
      `${TENANT}/`
    );
    await ctx.close();
  }

  {
    const ctx = await newCtx();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/course/12#rubric`);
    check(
      "hash fragment preserved in link",
      await page.locator("[data-school]").getAttribute("href"),
      `${TENANT}/course/12#rubric`
    );
    await ctx.close();
  }
} finally {
  await browser?.close();
  server.kill();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
