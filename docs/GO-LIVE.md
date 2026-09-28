# Go-live checklist

Paid traffic dies on slow or broken pages. Run this before you spend.

## Host
- [ ] HTTPS only
- [ ] `dist/` is what you deploy, not the repo root
- [ ] `PUBLIC_ORIGIN` in `.env` matches the live host
- [ ] Custom domain if the ad preview should look on-brand

## Performance
- [ ] `npm run preflight` passes
- [ ] Hero image is WebP/AVIF/SVG and under 200kb
- [ ] Logo is SVG, PNG, or WebP and under 40kb
- [ ] LCP target: under ~2s on mid-tier mobile / 4G
- [ ] No extra fonts unless subsetted and licensed

## Devices
- [ ] iPhone Safari
- [ ] Chrome Android
- [ ] Instagram in-app browser
- [ ] Facebook in-app browser
- [ ] Desktop Chrome + Safari

## Headers

`dist/_headers` is generated from your `.env`. Copy that file's values. Do not invent a second policy.

- Netlify and Cloudflare Pages read `_headers` as shipped.
- Vercel needs the same `Content-Security-Policy` copied into `vercel.json` `headers`.
- nginx: `add_header` in the location that serves the page. A location-level `add_header` replaces server-level ones, so repeat every header there.
- GitHub Pages cannot set headers. Put a CDN that can in front of it, or host somewhere else.

Google Ads is allowed to talk to `https://www.google.com` only. Country hosts such as `https://www.google.co.uk` are not in the policy. Open Tag Assistant on the live page. If it reports a blocked Google host, add that exact origin. CSP cannot wildcard a TLD.

## Tracking
- [ ] UTMs and `fbclid` / `gclid` / `ttclid` persist as hidden fields
- [ ] View event fires once
- [ ] Lead event fires once on thank-you, not on page load
- [ ] Pixel IDs only in `.env`, never in `campaign.json` committed to git

## Conversion
- [ ] Ad headline matches page headline
- [ ] One primary action
- [ ] Form posts to your endpoint, 2xx, then thank-you state
- [ ] Honeypot field is present and ignored by your endpoint when filled

## Legal
- [ ] Privacy link is real
- [ ] Pixels off in regions where you lack a basis, or add consent first
