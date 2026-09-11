import { NextRequest, NextResponse } from "next/server";
import { SCHOOL_COOKIE, SCHOOL_COOKIE_MAX_AGE, destinationFor, getTenant, safeNext } from "@/lib/tenants";

/**
 * Records the user's school and forwards them to it.
 *
 * Listed in the middleware passthrough so that it still works for a user who
 * already has a cookie and is switching schools.
 *
 * NOTE: this path must not start with an underscore — Next.js treats
 * underscore-prefixed folders as private and excludes them from routing, so
 * an `app/_switch/choose` route silently 404s.
 */
function noStore(response: NextResponse): NextResponse {
  response.headers.set("cache-control", "no-store");
  return response;
}

export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tenant = getTenant(params.get("school") ?? undefined);

  // An unknown school id means a stale or hand-edited link. Send them back to
  // the picker rather than guessing which deployment they meant.
  if (!tenant) {
    return noStore(NextResponse.redirect(new URL(safeNext(params.get("next")), request.nextUrl), 302));
  }

  const response = noStore(NextResponse.redirect(destinationFor(tenant, safeNext(params.get("next"))), 302));
  response.cookies.set(SCHOOL_COOKIE, tenant.id, {
    maxAge: SCHOOL_COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/"
  });
  return response;
}
