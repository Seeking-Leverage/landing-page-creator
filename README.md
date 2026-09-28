# Landing page harness

Public kit for paid-channel landing pages.

- **Harness** (this repo): speed, layout, devices, UTMs, pixel hooks, safe rendering.
- **Spec** (`clients/<name>/`): brand, copy, action, assets.

No production npm dependencies. Clone, copy `.env.example` → `.env`, run locally.

## Can you use it immediately?

**Demo: yes.** Clone, `cp .env.example .env`, `npm run dev`. The `_example` page runs locally with no pixels and no form backend.

**Paid traffic: not until you add a spec and a host.** The harness is the runtime. A live campaign still needs:

| Ready now | You add per campaign |
| --- | --- |
| Layout, escape, UTM fields, preflight, static build | `clients/<name>/brand.json` + `campaign.json` |
| Example assets | Real logo + compressed hero |
| Form UI + honeypot | `FORM_ENDPOINT` you control (CORS + rate limit) |
| Pixel hooks (off when blank) | IDs in **your** `.env` only |
| `dist/` + security headers | HTTPS host (Cloudflare Pages, etc.) |

Do not point ads at the example page. Do not commit real client folders or `.env`.

## Quick start

```bash
git clone https://github.com/Seeking-Leverage/landing-page-harness.git
cd landing-page-harness
cp .env.example .env
# Node 18+
npm run dev
```

Open http://127.0.0.1:4173

## Pull brand colors from a URL

This drafts `brand.json` from a public https page. It does not copy their font files or their photos. You still write the offer.

```bash
npm run brand -- https://client-site.com --name acme
CLIENT=acme npm run dev
```

What it writes, locally only (real client folders are gitignored):

- `clients/acme/brand.json` — bg, text, accent, muted, logo
- `clients/acme/campaign.json` — placeholder copy, not the ad
- `clients/acme/assets/` — their logo if it is a small same-site SVG/PNG, otherwise a monogram

Check the colors before you spend. A marketing homepage with no design tokens comes back as a guess.

## Build

```bash
npm run build
```

Host `dist/` on any static host. Use HTTPS.

See the rest of this file on GitHub for the architecture diagram, or `docs/GO-LIVE.md` before you spend.
