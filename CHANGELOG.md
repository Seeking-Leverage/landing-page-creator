# Changelog

Dated notes for releases. Add one when the behavior, the commands, or the security rules change.

## Unreleased

- QA blanks `APPCAST_PIXEL_URL` along with the other pixel ids. A flow thank-you check loads a fixed Appcast fixture, not the URL from `.env`.
- The lead form ignores a second submit until the request finishes, and turns the button back on if the send fails.
- Flow QA checks the campaign spec (match lines, unsourced earnings cards, thank-you step) instead of a client-name prefix.
- The Webflow embed scopes CSS under `.lpc-flow`, uses the file’s image type in data URIs, and still builds when `sips` is missing.
- Brand import rejects an SVG event handler written as `<svg/onload=…>` and an illegal numeric character reference, instead of saving the file or crashing.

## v0.2 — 28 Sep 2026

- Renamed the project from landing-page-harness to Landing Page Creator.
- QA no longer posts to `FORM_ENDPOINT` or loads pixels. The Chrome click still has to change the page.
- `npm start` runs the same checks as `npm run dev`. `npm run build` stays headless and rejects `http://` and localhost.
- `QA_HEADLESS=1` runs the click check without a window. CI uses that.
- Brand and campaign JSON are validated. Asset names cannot leave the client folder. Reserved form field names fail preflight.
- Meta, Google Ads, and TikTok pixels load only when that ID is set. A lead fires after a successful submit, not on page load.
- Empty required fields do not submit. The content security policy gets the form origin only, and only the hosts for pixels that are on.
- `npm test` covers escape, URLs, schemas, assets, CSP, and the lead event.

## v0.1 — 28 Sep 2026

- First public repo: one spec folder, one static page, example brand, and a local dev server.
