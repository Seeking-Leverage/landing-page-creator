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
- [ ] Logo is SVG or under 20kb
- [ ] LCP target: under ~2s on mid-tier mobile / 4G
- [ ] No extra fonts unless subsetted and licensed

## Devices
- [ ] iPhone Safari
- [ ] Chrome Android
- [ ] Instagram in-app browser
- [ ] Facebook in-app browser
- [ ] Desktop Chrome + Safari

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
