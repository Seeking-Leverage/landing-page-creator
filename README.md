# Landing Page Creator

Clone this, point it at a brand, and get a static landing page you can host. It is for paid traffic: one offer, one action, fast on a phone and inside Instagram or Facebook.

The shared code is the same for every company. What changes is a folder: colors, logo, headline, and the button. Secrets stay in `.env` on your machine.

No production npm dependencies. Node 18 or newer.

![How a spec becomes a hosted page](docs/images/how-it-fits.svg)

## What you get

| Included | You still add |
| --- | --- |
| A single-column page that widens on desktop | The words that match the ad |
| Logo and hero slots, size-capped | The real logo and a compressed hero |
| UTM, `fbclid`, `gclid`, and `ttclid` captured on the form | A form endpoint you control |
| Meta, Google Ads, and TikTok hooks, off until you set IDs | Those IDs, in `.env` only |
| Contrast check, then a real Chrome window that clicks the button | A look at the page on a phone before you spend |
| `dist/` plus security headers | An HTTPS host |

Do not send ads to the example page. Do not commit a real client folder or `.env`.

## Use it

```bash
git clone https://github.com/Seeking-Leverage/landing-page-creator.git
cd landing-page-creator
cp .env.example .env
npm run dev
```

Open http://127.0.0.1:4173

`npm run dev` and `npm start` run QA first, including a Chrome window that clicks the button. `npm run build` does not open Chrome. It does refuse `http://` and localhost URLs, because that output is what you ship. Set `QA_HEADLESS=1` to run the click check without a window. Details: [docs/QA.md](docs/QA.md).

If you already cloned this when it was named `landing-page-harness`, `git pull` still works. GitHub redirects the old URL. To point the remote at the new name:

```bash
git remote set-url origin https://github.com/Seeking-Leverage/landing-page-creator.git
```

## Use a private copy. Do not fork

A fork of this public repo is public. Client copy, logos, and endpoints do not belong there. `.gitignore` already keeps `clients/*` (except `_example`) and `.env` out of git. That still applies in your private copy.

```bash
git clone https://github.com/Seeking-Leverage/landing-page-creator.git my-pages
cd my-pages
git remote rename origin upstream
gh repo create Seeking-Leverage/my-pages --private --source=. --remote=origin
git push -u origin main
```

Later:

```bash
git fetch upstream
git pull upstream main
```

## Make a page for one company

```bash
cp -r clients/_example clients/acme
```

Edit:

- `clients/acme/brand.json` — name and the five colors. `accentFg` is the button label. It must contrast with `accent`.
- `clients/acme/campaign.json` — headline, offer, and the one action.
- `clients/acme/assets/logo.svg` — the logo. PNG or WebP is fine. Keep it under 40 KB.
- `clients/acme/assets/` — the hero named in `campaign.json`. Under 200 KB.

In `.env`:

```
CLIENT=acme
FORM_ENDPOINT=https://your-endpoint.example/lead
```

Then `npm run dev`. Leave `clients/acme` out of git. Only `clients/_example` is public.

### Draft a brand from a public URL

This reads design tokens and, when it can, a small same-site logo. It does not copy fonts or photography, and it refuses private or local addresses.

```bash
npm run brand -- https://client-site.com --name acme
CLIENT=acme npm run dev
```

Check the colors. A site with no tokens comes back as a guess. The accent often comes from `theme-color`, not the real button.

## How wide the page is

Phones already use the screen. Desktop width is `--max` in [harness/styles.css](harness/styles.css):

| Window | Column |
| --- | --- |
| Under 800px | 40rem |
| 800px and up | 68rem |
| 1200px and up | 80rem |

Change those three values if a brand should be narrower. Restart dev after you edit the file.

## Ship it

![Spec to a live ad URL](docs/images/ship-path.svg)

```bash
npm run build
```

Host the `dist/` folder on Cloudflare Pages, Netlify, GitHub Pages, or any static host. HTTPS only. The checklist is [docs/GO-LIVE.md](docs/GO-LIVE.md).

Pixels stay off until you set an ID in `.env`. A lead event fires only after the form endpoint returns success, not on page load.

| Env | What loads |
| --- | --- |
| `META_PIXEL_ID` | Meta `PageView`, then `Lead` |
| `GOOGLE_ADS_ID` plus `GOOGLE_ADS_CONVERSION_LABEL` or `GOOGLE_ADS_LEAD_LABEL` | Google tag, then one conversion |
| `TIKTOK_PIXEL_ID` | TikTok page view, then `Lead` (`TIKTOK_LEAD_EVENT` overrides the name) |

The content security policy in `dist/_headers` adds a vendor's hosts only when that vendor's ID is set. Google's country domains are not listed. The policy allows `https://www.google.com` only. Check Tag Assistant on the live page and add a blocked country host yourself if it reports one. GitHub Pages cannot send these headers. See [docs/GO-LIVE.md](docs/GO-LIVE.md).

## What is shared

| Shared, in this repo | Per company, on your machine |
| --- | --- |
| Layout, speed, escaping | Colors, logo, name |
| Device width | Headline and offer |
| UTM and click-id fields | The one action |
| URL and contrast checks | Assets |
| Pixel loaders | Pixel IDs |

`harness/` is that shared runtime. You should not need to edit it for a normal page.

## Security

[SECURITY.md](SECURITY.md). Short version: your form endpoint, your pixel IDs, and your client folders stay local. Campaign text is escaped. `npm run brand` only fetches public https URLs.
