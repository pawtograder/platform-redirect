# platform-redirect

Catch-all redirector for `app.pawtograder.com`, hosted on GitHub Pages.

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

Add an entry to [`tenants.json`](tenants.json) and merge. That file is the only
thing that changes: the build renders it into the picker markup _and_ inlines
it into the redirect script.

```json
{
  "id": "example",
  "name": "Example University",
  "detail": "School of Computing",
  "origin": "https://pawtograder.example.edu"
}
```

`id` is stored in the visitor's browser — never reuse or renumber one. `origin`
must be `https` with no path or trailing slash; the build fails if it isn't,
rather than emitting a subtly broken destination. Duplicate ids also fail the
build.

## How it works

GitHub Pages serves only static files, so there is no middleware and no
server-side redirect. Two properties of Pages make a catch-all possible anyway:

1. **`404.html` is the fallback for every unmatched path**, and the requested
   URL stays in the address bar. `index.html` and `404.html` are byte-identical
   — one page serves the root and every deep link, reading the path from
   `location`.
2. **Custom domains get HTTPS**, so `app.pawtograder.com` keeps working.

The redirect script runs in `<head>`, before the body is parsed, so a returning
visitor never sees the picker paint. Until it decides, `html.resolving` keeps
the body hidden; a `<noscript>` block un-hides it for clients that never run it.

| Request                                   | What happens                                                           |
| ----------------------------------------- | ---------------------------------------------------------------------- |
| First visit, any path                     | Picker renders at the requested URL                                    |
| Later visits                              | Forwarded to the remembered school before paint, path and query intact |
| Stored school no longer in `tenants.json` | Picker renders, stale value purged                                     |
| JavaScript disabled                       | Picker renders; links go to the school's root (path is not preserved)  |
| `POST` or any non-GET                     | `405` from Pages — see below                                           |

The destination origin always comes from the registry and only the path is
taken from the URL, so a crafted link cannot retarget the redirect at another
host.

### Known costs of being static

- **Deep links return HTTP 404** (with the redirecting page as the body).
  Browsers don't care and `robots.txt` disallows indexing, but it means this
  origin can't be health-checked by status code.
- **Non-browser clients get no redirect.** Pages serves GET and HEAD only;
  a `POST` gets `405`, and an API client gets the 404 page rather than a `Location`
  header. This is fine today because nothing machine-facing points here —
  webhooks go to each school's own deployment and the CLI uses
  `api.pawtograder.com` — but a new integration must never be pointed at this
  origin.
- **The choice is per-browser** (`localStorage`), not per-device. It does not
  survive clearing site data or a different browser.

## Changing the remembered school

Once a choice is stored every visit forwards immediately, so there is no UI
left on this origin to hang a "not your school?" link from. The escape hatch is:

```
https://app.pawtograder.com/change-school
```

That clears the stored school and shows the picker again. It is the URL to hand
out in support replies.

## Local development

```bash
npm install
npm run build     # renders tenants.json + src/ into dist/
npm run serve     # http://localhost:4321, with Pages' 404 fallback semantics
npm test          # Chromium tests against the above
npm run lint      # prettier --check
```

Use `npm run serve` rather than any static file server: it reproduces the 404
fallback and the GET/HEAD-only restriction, which is exactly the behaviour the
redirect depends on.

The picker only appears if no school is stored — after choosing one you will be
forwarded. Visit `/change-school` or use a private window to get back to it.

## Deployment

Pushes to `main` build and publish to Pages via
[`deploy.yml`](.github/workflows/deploy.yml). One-time setup:

1. **Settings → Pages → Source: GitHub Actions.**
2. **Settings → Pages → Custom domain: `app.pawtograder.com`**, and tick
   _Enforce HTTPS_ once the certificate is issued. The [`CNAME`](CNAME) file in
   this repo is what makes the domain stick across deploys.
3. **DNS:** point `app.pawtograder.com` at Pages, replacing the Vercel record:

   ```
   app.pawtograder.com.  CNAME  pawtograder.github.io.
   ```

   `pawtograder.com` already runs on Pages from `pawtograder/website`, so the
   apex domain is verified for the org and the subdomain needs no extra step.

4. Delete the Vercel project once DNS has propagated and `/change-school`
   resolves over HTTPS.

> Visitors who picked a school while this ran on Vercel had it stored in an
> `HttpOnly` cookie, which this build cannot read. They will see the picker once
> more and then be remembered again.
