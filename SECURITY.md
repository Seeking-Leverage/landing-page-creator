# Security

This repo is meant to be cloned. Treat every clone as untrusted input plus your own secrets.

## Never commit
- `.env` or real pixel / form / API values
- Client brand folders other than `clients/_example/`
- Private fonts you are not licensed to distribute
- Lead lists, webhooks you do not want strangers to POST to

## Threat model
1. **Open form relay** — if `FORM_ENDPOINT` is a URL you do not own, cloners and bots will submit into it. Use your own endpoint. The browser cannot hold a secret, so do not expect the page to send `FORM_KEY` or `X-Landing-Key`. Allowlist the page origin, rate-limit, and drop honeypot-filled submissions. `FORM_KEY`, when set, is a reminder for that server. Preflight says so.
2. **HTML injection** — campaign copy is escaped as text. Do not switch the renderer to `innerHTML` for headline, offer, or FAQ.
3. **Open redirect** — CTA and form action must be `https:` (or `http://localhost` in dev). `javascript:` and protocol-relative tricks are rejected in preflight.
4. **Pixel leakage** — pixels load only when IDs are set in `.env`. Blank IDs = no third-party scripts.
5. **Supply chain** — this kit has **zero runtime npm dependencies**. Do not add packages without pinning and reviewing them. There is no `postinstall`.
6. **Brand pull** — `npm run brand` only fetches public `https` URLs. It refuses localhost, link-local, and private IPs, including bracketed IPv6, and it connects to the address it just checked. It re-checks every redirect. It will not save an SVG logo that contains a script, an event handler, or `foreignObject`. The remaining limit: any public host can still be fetched. Run it on a laptop, not from a server that can reach private networks the DNS check cannot see.

## If you add a sample form server
- Bind to localhost by default
- Require a secret header
- Allowlist origins
- Rate limit by IP
- Drop honeypot-filled submissions
- Do not follow `?redirect=` from the query string

## Report
Open a private GitHub security advisory on this repository, or email the repo owner. Do not file public issues for unfixed injection or relay bugs.
