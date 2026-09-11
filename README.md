# platform-redirect

Catch-all redirector for `app.pawtograder.com`.

Pawtograder used to run as a single hosted app at `app.pawtograder.com`. It is
now self-hosted per school, so that origin no longer serves the application —
it serves this, which asks the visitor which school they are at and forwards
them there with their original path intact.

```
app.pawtograder.com/course/12/assignments/34?tab=files
                        ↓  (picker, first visit only)
pawtograder.khoury.northeastern.edu/course/12/assignments/34?tab=files
```

Course and assignment IDs carried over from the hosted database, so old
bookmarks and emailed links resolve to the same page after the hop.

## Adding a school

Add an entry to `TENANTS` in [`lib/tenants.ts`](lib/tenants.ts) and deploy.
That array drives the picker buttons, the cookie allowlist, and the middleware
redirect; nothing else needs to change.

```ts
{
  id: "example",                        // stored in the cookie — never reuse or renumber
  name: "Example University",
  detail: "School of Computing",
  origin: "https://pawtograder.example.edu"   // https, no trailing slash
}
```

## How a request is handled

`middleware.ts` sees every request that is not a static asset:

| Request                                                          | Response                                                    |
| ---------------------------------------------------------------- | ----------------------------------------------------------- |
| Browser navigation, no school cookie                             | `200` — renders the picker at the requested URL             |
| Browser navigation, school cookie set                            | `302` to that school, path + query preserved                |
| Browser navigation, cookie names a school no longer in `TENANTS` | `200` picker, stale cookie cleared                          |
| Non-GET, or a client that does not accept `text/html`            | `302`/`307` to the only school, or `404` once there are two |
| `/choose-school`, `/change-school`, `/robots.txt`, static assets | Passed through                                              |

The last row of the non-browser case is the one to watch. Webhooks and API
clients send no cookies and cannot read an interstitial, so while exactly one
school is configured they are forwarded blindly. **The moment a second school
is added that becomes an unroutable `404`** — any integration still pointed at
`app.pawtograder.com` has to be repointed at its school's origin before then.

Redirects are `302`, not `308`: a permanent redirect would be cached by the
browser and pin that URL to one school forever, which breaks switching schools
and moving a deployment. Non-GET uses `307` so the method and body survive.

## Changing the remembered school

The choice is stored in the `ptg_school` cookie (1 year, `HttpOnly`, `Secure`,
`SameSite=Lax`). Once it is set there is no UI left on this origin to hang a
link from, because every request redirects immediately. The escape hatch is:

```
https://app.pawtograder.com/change-school
```

That clears the cookie and shows the picker again. It is the URL to hand out
in support replies.

## Routes

| Path                                     | Purpose                                                           |
| ---------------------------------------- | ----------------------------------------------------------------- |
| `/[[...path]]`                           | The picker, rendered at whatever URL was requested                |
| `/choose-school?school=<id>&next=<path>` | Stores the choice, forwards to the school                         |
| `/change-school?next=<path>`             | Clears the choice, returns to the picker                          |
| `/robots.txt`                            | `Disallow: /` — this origin must not outrank the real deployments |

`next` is validated as a site-relative path before it is appended to a school's
origin, so this cannot be used as an open redirect.

> Route folders must not start with an underscore. Next.js treats those as
> private and silently excludes them from routing.

## Local development

```bash
npm install
npm run dev     # http://localhost:3000
npm run build
npm run lint
npm run typecheck
```

The picker is only reachable without a cookie — after choosing a school you
will be redirected away. Use `/change-school` or a private window to get back.

## Deployment

Vercel, zero config: framework preset Next.js, no environment variables. Point
the `app.pawtograder.com` Vercel project at this repo and assign the domain to
it.
