# Security Policy

## Scope

This repository holds the source of the static site published at
https://juanberrio0399.github.io — HTML, CSS, vanilla JavaScript, a vendored copy of
DuckDB-WASM and the Arrow files the playground reads in the browser. There is no server,
no database and no user account: everything runs client-side, so the realistic risk is a
supply-chain or content-integrity problem (a tampered asset, a workflow that leaks a
token, a dependency pulled at a moving tag) rather than a remote compromise.

The site is served by GitHub Pages from the `main` branch and applies a
Content-Security-Policy through a `<meta http-equiv>` tag in each page.

## Supported versions

Only the current `main` branch is supported. There are no releases or tags to back-port
fixes to; the deployed site is always whatever `main` contains.

## Reporting a vulnerability

Please report privately — do not open a public issue.

1. Preferred: GitHub private vulnerability reporting, from the repository's
   [Security tab](https://github.com/juanberrio0399/juanberrio0399.github.io/security).
2. Alternative: email juandyb99@gmail.com with `SECURITY` in the subject.

Useful details: the affected file or URL, what an attacker gains, and the steps or the
request needed to reproduce it.

Expect an acknowledgement within 5 business days. Confirmed issues are fixed on `main`
and the fix goes live with the next Pages deploy; you will be credited in the commit or
the advisory unless you prefer otherwise.

## What this project already does

- Every GitHub Actions dependency is pinned to a full commit SHA, and Dependabot opens a
  weekly grouped pull request so those pins stay current instead of rotting.
- Workflows declare least-privilege `permissions:` and start with
  [Harden-Runner](https://github.com/step-security/harden-runner) in audit mode.
- Supply-chain posture is scored weekly by
  [OpenSSF Scorecard](https://github.com/ossf/scorecard); results are uploaded to GitHub
  code scanning.
