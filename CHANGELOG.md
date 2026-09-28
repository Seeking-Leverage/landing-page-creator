# Changelog

Dated notes for releases. Add one when the behavior, the commands, or the security rules change.

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
