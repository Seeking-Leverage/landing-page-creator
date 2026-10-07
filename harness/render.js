"use strict";

const { escapeHtml, escapeAttr } = require("./escape");
const { inlineJson } = require("./inline-json");
const { assertAssetName } = require("./assets");
const { renderFlow } = require("./render-flow");
const { pageConfig } = require("./page-config");

function list(items, fn) {
  return (items || []).map(fn).join("");
}

function render(page) {
  const { brand, campaign, env, assetPrefix } = page;
  const c = brand.colors;
  const action = campaign.primaryAction;
  const privacy = brand.privacyUrl
    ? `<a href="${escapeAttr(brand.privacyUrl)}" rel="noopener noreferrer">Privacy</a>`
    : "";
  const home = brand.siteUrl
    ? `<a class="home" href="${escapeAttr(brand.siteUrl)}">${escapeHtml(brand.name)}</a>`
    : escapeHtml(brand.name);

  assertAssetName(brand.logo.file);
  assertAssetName(campaign.hero.file);
  const btnStyle = `style="background:${escapeAttr(c.accent)};color:${escapeAttr(c.accentFg)}"`;
  const fields = list(action.fields, (f) => {
    const req = f.required ? "required" : "";
    return `<label for="${escapeAttr(f.name)}">${escapeHtml(f.label)}</label>
<input id="${escapeAttr(f.name)}" name="${escapeAttr(f.name)}" type="${escapeAttr(f.type)}" autocomplete="${f.type === "email" ? "email" : "on"}" ${req} />`;
  });

  const formBlock =
    action.type === "form"
      ? `<section class="form-card wrap" id="action">
  <h2>${escapeHtml(action.label)}</h2>
  <form id="lead-form" method="post" action="#">
    ${fields}
    <p class="hp" aria-hidden="true"><label>Company website<input name="website" tabindex="-1" autocomplete="off" /></label></p>
    <input type="hidden" name="source" />
    <input type="hidden" name="utm_source" />
    <input type="hidden" name="utm_medium" />
    <input type="hidden" name="utm_campaign" />
    <input type="hidden" name="utm_content" />
    <input type="hidden" name="utm_term" />
    <input type="hidden" name="ccuid" />
    <input type="hidden" name="fbclid" />
    <input type="hidden" name="gclid" />
    <input type="hidden" name="ttclid" />
    <p style="margin-top:1rem"><button type="submit" ${btnStyle}>${escapeHtml(action.label)}</button></p>
    <p class="status" id="form-status" role="status"></p>
  </form>
  <div class="thanks" id="thanks"><p>Got it. We will follow up.</p></div>
</section>`
      : `<section class="wrap hero" id="action"><a class="btn" ${btnStyle} href="${escapeAttr(action.href)}" rel="noopener noreferrer">${escapeHtml(action.label)}</a></section>`;

  const classic = `<div class="icp">${escapeHtml(campaign.icp)}</div>
  <header class="wrap">
    <img class="logo" src="${assetPrefix}assets/${escapeAttr(brand.logo.file)}" alt="${escapeAttr(brand.logo.alt)}" width="140" height="28" />
  </header>
  <main>
    <section class="hero wrap">
      <h1>${escapeHtml(campaign.headline)}</h1>
      <p class="sub">${escapeHtml(campaign.subhead)}</p>
      <p><a class="btn" ${btnStyle} href="#action">${escapeHtml(action.label)}</a></p>
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
    <p>${home} ${privacy}</p>
  </footer>
  ${action.type === "form" ? `<div class="sticky"><a class="btn" ${btnStyle} href="#action">${escapeHtml(action.label)}</a></div>` : ""}`;

  const body = campaign.flow ? renderFlow(page) : classic;

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
  <link rel="stylesheet" href="${assetPrefix}styles.css" />
  <style>
    :root{--bg:${escapeAttr(c.bg)};--fg:${escapeAttr(c.fg)};--accent:${escapeAttr(c.accent)};--accent-fg:${escapeAttr(c.accentFg)};--muted:${escapeAttr(c.muted)}}
    .btn, button[type="submit"]{background:var(--accent);color:var(--accent-fg)}
  </style>
</head>
<body${campaign.flow ? ' class="is-flow"' : ""}>
  ${body}
  <script>
    window.__HARNESS__ = ${inlineJson(pageConfig(campaign, env))};
  </script>
  <script src="${assetPrefix}attribution.js" defer></script>
  <script src="${assetPrefix}client.js" defer></script>
</body>
</html>`;
}

module.exports = { render };
