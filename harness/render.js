"use strict";

const { escapeHtml, escapeAttr } = require("./escape");

function list(items, fn) {
  return (items || []).map(fn).join("");
}

function render(page) {
  const { brand, campaign, env, assetPrefix } = page;
  const c = brand.colors;
  const action = campaign.primaryAction;
  const formEnabled = Boolean(env.FORM_ENDPOINT);
  const privacy = brand.privacyUrl
    ? `<a href="${escapeAttr(brand.privacyUrl)}" rel="noopener noreferrer">Privacy</a>`
    : "";

  const fields = list(action.fields, (f) => {
    const req = f.required ? "required" : "";
    return `<label for="${escapeAttr(f.name)}">${escapeHtml(f.label)}</label>
<input id="${escapeAttr(f.name)}" name="${escapeAttr(f.name)}" type="${escapeAttr(f.type)}" autocomplete="${f.type === "email" ? "email" : "on"}" ${req} />`;
  });

  const formBlock =
    action.type === "form"
      ? `<section class="form-card wrap" id="action">
  <h2>${escapeHtml(action.label)}</h2>
  <form id="lead-form" method="post" action="#" novalidate>
    ${fields}
    <p class="hp" aria-hidden="true"><label>Company website<input name="website" tabindex="-1" autocomplete="off" /></label></p>
    <input type="hidden" name="utm_source" />
    <input type="hidden" name="utm_medium" />
    <input type="hidden" name="utm_campaign" />
    <input type="hidden" name="utm_content" />
    <input type="hidden" name="utm_term" />
    <input type="hidden" name="fbclid" />
    <input type="hidden" name="gclid" />
    <input type="hidden" name="ttclid" />
    <p style="margin-top:1rem"><button type="submit">${escapeHtml(action.label)}</button></p>
    <p class="status" id="form-status" role="status"></p>
  </form>
  <div class="thanks" id="thanks"><p>Got it. We will follow up.</p></div>
</section>`
      : `<section class="wrap hero" id="action"><a class="btn" href="${escapeAttr(action.href)}" rel="noopener noreferrer">${escapeHtml(action.label)}</a></section>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="referrer" content="strict-origin-when-cross-origin" />
  <title>${escapeHtml(campaign.headline)} — ${escapeHtml(brand.name)}</title>
  <meta name="description" content="${escapeAttr(campaign.subhead)}" />
  <meta property="og:title" content="${escapeAttr(campaign.headline)}" />
  <meta property="og:description" content="${escapeAttr(campaign.subhead)}" />
  ${env.PUBLIC_ORIGIN ? `<link rel="canonical" href="${escapeAttr(env.PUBLIC_ORIGIN)}" />` : ""}
  <style>
    :root{--bg:${escapeAttr(c.bg)};--fg:${escapeAttr(c.fg)};--accent:${escapeAttr(c.accent)};--accent-fg:${escapeAttr(c.accentFg)};--muted:${escapeAttr(c.muted)}}
  </style>
  <link rel="stylesheet" href="${assetPrefix}styles.css" />
</head>
<body>
  <div class="icp">${escapeHtml(campaign.icp)}</div>
  <header class="wrap">
    <img class="logo" src="${assetPrefix}assets/${escapeAttr(brand.logo.file)}" alt="${escapeAttr(brand.logo.alt)}" width="140" height="28" />
  </header>
  <main>
    <section class="hero wrap">
      <h1>${escapeHtml(campaign.headline)}</h1>
      <p class="sub">${escapeHtml(campaign.subhead)}</p>
      <p><a class="btn" href="#action">${escapeHtml(action.label)}</a></p>
      <div class="hero-art">
        <img src="${assetPrefix}assets/${escapeAttr(campaign.hero.file)}" alt="${escapeAttr(campaign.hero.alt)}" width="1200" height="800" />
      </div>
    </section>
    <section class="offer wrap">
      <h2>What you get</h2>
      <ul>${list(campaign.offer, (item) => `<li>${escapeHtml(item)}</li>`)}</ul>
    </section>
    <section class="proof wrap">
      ${list(campaign.proof, (p) => `<blockquote><p>${escapeHtml(p.quote)}</p><cite>${escapeHtml(p.who)}</cite></blockquote>`)}
    </section>
    ${formBlock}
    <section class="faq wrap">
      ${list(campaign.faq, (item) => `<details><summary>${escapeHtml(item.q)}</summary><p>${escapeHtml(item.a)}</p></details>`)}
    </section>
  </main>
  <footer class="wrap">
    <p>${escapeHtml(campaign.legal || "")}</p>
    <p>${escapeHtml(brand.name)} ${privacy}</p>
  </footer>
  ${action.type === "form" ? `<div class="sticky"><a class="btn" href="#action">${escapeHtml(action.label)}</a></div>` : ""}
  <script>
    window.__HARNESS__ = {
      formEnabled: ${formEnabled ? "true" : "false"},
      formEndpoint: ${JSON.stringify(formEnabled ? env.FORM_ENDPOINT : "")},
      pixels: {
        meta: ${JSON.stringify(env.META_PIXEL_ID || "")},
        googleAds: ${JSON.stringify(env.GOOGLE_ADS_ID || "")},
        googleLabel: ${JSON.stringify(env.GOOGLE_ADS_CONVERSION_LABEL || "")},
        tiktok: ${JSON.stringify(env.TIKTOK_PIXEL_ID || "")}
      }
    };
  </script>
  <script src="${assetPrefix}client.js" defer></script>
</body>
</html>`;
}

module.exports = { render };
