# Decisions and operation

[Español](operation.es.md) · Back to the [README](../README.md)

## Decisions and limits

- **No framework, no build step.** The site is a few hundred lines of markup. A bundler would add a toolchain to maintain and a whole class of deploy failures for nothing. It also keeps Pages on *deploy from branch*, so a "built" site can't drift from the sources.
- **CSP in a meta tag.** It's weaker than a header (no `frame-ancestors`, no report endpoint), but it's the only option Pages gives you, and it still blocks inline script, unexpected hosts and form posts. Adding an external asset means editing the policy on every page.
- **The engine loads on the first query, not on page load.** The playground is there to be tried, not downloaded. Deferring the 7 MB is what keeps its Lighthouse performance score close to the portfolio page.
- **The engine is pinned and integrity-checked rather than fully self-hosted.** The `.wasm` files are too big to keep in Git for a Pages site; the hashes give the same guarantee without the weight. Only the small JS API is committed.
- **The snapshot is committed data, not a live API call.** The playground shows what the repo contains. It doesn't call GitHub at runtime, so it works offline once the engine is cached and can't leak a token.
- **What it isn't.** No backend, no database, no analytics, no cookies, no forms, and nothing the visitor types leaves the browser. It isn't a general SQL service: the dataset is fixed at ~28 KB and lives in the visitor's memory.

## What runs on its own

| What | When | Where the result lands |
|---|---|---|
| Lighthouse CI | every PR, every push to `main`, manual dispatch | The `lighthouse` check plus an uploaded HTML report (temporary public storage) |
| OpenSSF Scorecard | Tuesdays 06:17 UTC, pushes to `main`, PRs touching `.github/**` | SARIF in the Security tab and the badge in the README |
| Dependabot | Tuesdays, one grouped PR | A `ci:` PR that moves the pinned action SHAs and their version comments |
| GitHub Pages | every push to `main` | <https://juanberrio0399.github.io> |

`main` is protected: a pull request can't merge until the `lighthouse` check passes, and the branch has to be up to date first.

## When something fails

- **Lighthouse goes red.** Accessibility, best practices and SEO fail below 0.9; performance only warns. Open the report linked in the job log, it names the failing audit. Thresholds and audited URLs are in `.lighthouserc.json`.
- **The playground stops loading.** Almost always the pinned engine: if jsDelivr serves a file whose hash doesn't match the `SRI` map, the fetch fails and the page shows the "integrity check" message. Re-run the vendor script for the pinned version and compare hashes before changing them.
- **Scorecard drops.** The score reacts to unpinned actions, missing `permissions` blocks and stale dependencies. The SARIF entry in the Security tab points at the file and line.

## Not done yet

- The snapshot is refreshed by hand. Until `build_data.py` runs on a schedule (#42) the data ages; the `snapshot` table is there so a visitor can see how old it is.
- DNS and security settings are managed in the GitHub UI. Moving them to Terraform is the intended next step, and the only reason a deploy workflow would be worth adding.
- Open ideas are tracked as issues, for example the Speculation Rules API (#34) and a bigger remote-attach playground (#36).
