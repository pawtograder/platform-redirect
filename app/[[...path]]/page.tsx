import { TENANTS } from "@/lib/tenants";

/**
 * The "choose your school" interstitial.
 *
 * Rendered at whatever URL the user originally requested — middleware lets
 * the request fall through rather than rewriting it — so the path is still
 * in the address bar and can be forwarded on to the school they pick.
 */

type PageProps = {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Rebuild the originally-requested path and query so the choice can carry
 * the user through to the same page on their school's deployment.
 */
function originalPathAndQuery(segments: string[] | undefined, query: Record<string, string | string[] | undefined>) {
  const path = segments?.length ? `/${segments.map(encodeURIComponent).join("/")}` : "/";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      for (const entry of value) params.append(key, entry);
    } else if (value !== undefined) {
      params.append(key, value);
    }
  }
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

export default async function ChooseSchoolPage({ params, searchParams }: PageProps) {
  const { path } = await params;
  const query = await searchParams;
  const next = originalPathAndQuery(path, query);
  const isDeepLink = next !== "/";

  return (
    <main className="card">
      {/* eslint-disable-next-line @next/next/no-img-element -- static asset, no optimization needed on a redirect page */}
      <img src="/Logo-Light.png" alt="" className="logo logo-light" />
      {/* eslint-disable-next-line @next/next/no-img-element -- static asset, no optimization needed on a redirect page */}
      <img src="/Logo-Dark.png" alt="" className="logo logo-dark" />

      <h1>Choose your school</h1>
      <p className="lede">
        Pawtograder is now hosted by each school on its own site. Pick yours to continue — we&rsquo;ll remember it next
        time.
      </p>

      {TENANTS.length === 0 ? (
        <p className="empty">No deployments are configured yet.</p>
      ) : (
        <div className="schools">
          {TENANTS.map((tenant) => (
            <a
              key={tenant.id}
              className="school"
              href={`/choose-school?school=${encodeURIComponent(tenant.id)}&next=${encodeURIComponent(next)}`}
            >
              <span>
                <span className="school-name">{tenant.name}</span>
                <br />
                <span className="school-detail">{tenant.detail}</span>
              </span>
              <svg
                className="chevron"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M6 3l5 5-5 5" />
              </svg>
            </a>
          ))}
        </div>
      )}

      {isDeepLink && (
        <p className="destination">
          You&rsquo;ll be taken to <code>{next}</code> on the site you choose.
        </p>
      )}
    </main>
  );
}
