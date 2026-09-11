/**
 * Registry of self-hosted Pawtograder deployments.
 *
 * This is the only file that changes when a school onboards: add an entry
 * here and the picker, the cookie allowlist, and the middleware redirect all
 * pick it up. Entries are rendered in array order.
 */

export type Tenant = {
  /** Stable id. Stored in the school cookie, so never renumber or reuse. */
  id: string;
  /** School name shown on the picker button. */
  name: string;
  /** Short line under the name, e.g. the college or campus. */
  detail: string;
  /** Deployment origin, no trailing slash. Must be https. */
  origin: string;
};

export const TENANTS: Tenant[] = [
  {
    id: "northeastern",
    name: "Northeastern University",
    detail: "Khoury College of Computer Sciences",
    origin: "https://pawtograder.khoury.northeastern.edu"
  }
];

/** Name of the cookie holding the remembered tenant id. */
export const SCHOOL_COOKIE = "ptg_school";

/** How long the remembered choice sticks around. */
export const SCHOOL_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function getTenant(id: string | undefined): Tenant | undefined {
  if (!id) return undefined;
  return TENANTS.find((t) => t.id === id);
}

/**
 * The single tenant, when exactly one is configured.
 *
 * Used for requests that cannot be shown an interstitial (non-GET methods,
 * non-browser clients): with one deployment there is no ambiguity, so those
 * are forwarded straight through instead of being handed an HTML page they
 * will not parse. Returns undefined once a second school is added, at which
 * point such requests genuinely cannot be routed and get a 404.
 */
export function soleTenant(): Tenant | undefined {
  return TENANTS.length === 1 ? TENANTS[0] : undefined;
}

/**
 * Build the destination URL on `tenant` for an inbound path + query.
 *
 * `pathAndQuery` is trusted to be a server-derived relative path (from
 * `nextUrl`) or an already-validated `next` parameter — see `safeNext`.
 */
export function destinationFor(tenant: Tenant, pathAndQuery: string): string {
  return `${tenant.origin}${pathAndQuery}`;
}

/**
 * Validate a caller-supplied `next` value before it is appended to a tenant
 * origin. Rejects anything that is not a plain site-relative path, which
 * stops `?next=//evil.example` and `?next=https://evil.example` from turning
 * this redirector into an open redirect.
 */
export function safeNext(value: string | null | undefined): string {
  if (!value) return "/";
  if (!value.startsWith("/")) return "/";
  // "//host" and "/\host" are protocol-relative; browsers treat them as absolute.
  if (value.startsWith("//") || value.startsWith("/\\")) return "/";
  return value;
}
