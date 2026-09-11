import { NextRequest, NextResponse } from "next/server";
import { SCHOOL_COOKIE, safeNext } from "@/lib/tenants";

/**
 * Forgets the remembered school and returns the user to the picker.
 *
 * Once a choice is stored the middleware forwards every request instantly, so
 * there is no UI left on this origin to hang a "not your school?" link from.
 * This URL is that escape hatch, deliberately given a human-memorable path so
 * it can be handed out in support replies:
 *
 *   https://app.pawtograder.com/change-school
 *
 * It is listed in the middleware passthrough, so it keeps working even for a
 * user who already has a cookie.
 */
export function GET(request: NextRequest) {
  const next = safeNext(request.nextUrl.searchParams.get("next"));
  const response = NextResponse.redirect(new URL(next, request.nextUrl), 302);
  response.headers.set("cache-control", "no-store");
  response.cookies.delete(SCHOOL_COOKIE);
  return response;
}
