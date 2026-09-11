import { NextRequest, NextResponse } from "next/server";
import { SCHOOL_COOKIE, destinationFor, getTenant, soleTenant } from "@/lib/tenants";

/**
 * Catch-all redirector for the retired app.pawtograder.com origin.
 *
 * Every request that is not a static asset lands here. Browsers that have
 * already picked a school are forwarded straight to that deployment with the
 * path and query intact; everyone else falls through to the picker page.
 *
 * Redirects are 307/308-free on purpose — see `redirectTo`.
 */

/** Requests we answer ourselves rather than forwarding. */
const PASSTHROUGH_PREFIXES = ["/_next/"];
const PASSTHROUGH_PATHS = [
  "/choose-school",
  "/change-school",
  "/favicon.ico",
  "/robots.txt",
  "/Logo-Light.png",
  "/Logo-Dark.png"
];

/**
 * 302, deliberately.
 *
 * A 308 would be permanently cached by the browser, pinning a user's machine
 * to one school's origin for that URL forever — which breaks the moment they
 * switch schools or a deployment moves. 302/307 keeps the mapping revocable.
 * 307 is used for non-GET so the method and body survive the hop.
 */
function redirectTo(url: string, method: string): NextResponse {
  const response = NextResponse.redirect(url, method === "GET" || method === "HEAD" ? 302 : 307);
  // The destination depends on a cookie, so a shared cache (a campus proxy, a
  // CDN) must not reuse one visitor's redirect for the next. no-store is
  // blunter than Vary: Cookie but leaves no room for an intermediary to get
  // it wrong and strand a user on another school's deployment.
  response.headers.set("cache-control", "no-store");
  return response;
}

/**
 * Whether the client is a browser navigating to a page, as opposed to an API
 * client, webhook, or fetch() call. Only the former can make sense of the
 * picker interstitial; the latter need a real redirect or an error.
 */
function wantsHtml(request: NextRequest): boolean {
  return (request.headers.get("accept") ?? "").includes("text/html");
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (PASSTHROUGH_PATHS.includes(pathname) || PASSTHROUGH_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const pathAndQuery = `${pathname}${search}`;
  const isNavigation = (request.method === "GET" || request.method === "HEAD") && wantsHtml(request);

  // Non-browser traffic (webhooks, API clients, old integrations) cannot be
  // shown a picker. While there is exactly one deployment there is no
  // ambiguity, so forward it; once a second school exists the request is
  // genuinely unroutable and 404 is the honest answer.
  if (!isNavigation) {
    const only = soleTenant();
    if (!only) {
      return new NextResponse("This address has moved. Pawtograder is now hosted per-school; update your endpoint.", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8" }
      });
    }
    return redirectTo(destinationFor(only, pathAndQuery), request.method);
  }

  const remembered = getTenant(request.cookies.get(SCHOOL_COOKIE)?.value);
  if (remembered) {
    return redirectTo(destinationFor(remembered, pathAndQuery), request.method);
  }

  // No usable choice: render the picker. Drop a stale cookie so a tenant id
  // that has since been removed does not linger and get re-checked forever.
  const response = NextResponse.next();
  response.headers.set("cache-control", "no-store");
  if (request.cookies.has(SCHOOL_COOKIE)) {
    response.cookies.delete(SCHOOL_COOKIE);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"]
};
