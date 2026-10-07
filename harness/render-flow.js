"use strict";

const { escapeHtml, escapeAttr } = require("./escape");
const { qrSvg } = require("./qr");

const ICONS = [
  '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="M3 4h2l2.2 11h11.3l1.5-7H7"/></svg>',
  '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3.2"/><circle cx="12" cy="12" r="7.2"/></svg>',
  '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8h12l-1 12H7L6 8z"/><path d="M9 8V7a3 3 0 0 1 6 0v1"/></svg>',
  '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19c8 1 14-5 14-13-8 0-14 6-14 13z"/><path d="M9 16c2-3 4-6 7-8"/></svg>',
  '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21V11"/><path d="M12 15c-3-.8-5-3-5-6 3 .3 5 2.2 5 6z"/><path d="M12 13c2.6-.6 5-2.4 5.5-5.2-2.8.4-4.8 2-5.5 5.2z"/></svg>',
];

function linkEmails(escaped) {
  return escaped.replace(
    /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g,
    '<a href="mailto:$1">$1</a>'
  );
}

function renderFlow(page) {
  const { brand, campaign, assetPrefix } = page;
  const flow = campaign.flow;
  const action = campaign.primaryAction;
  const c = brand.colors;
  const btnStyle = `style="background:${escapeAttr(c.accent)};color:${escapeAttr(c.accentFg)}"`;
  const privacy = brand.privacyUrl
    ? ` <a href="${escapeAttr(brand.privacyUrl)}" rel="noopener noreferrer">Privacy</a>`
    : "";
  const home = brand.siteUrl
    ? `<a class="home" href="${escapeAttr(brand.siteUrl)}">${escapeHtml(brand.name)}</a>`
    : escapeHtml(brand.name);
  const mark = brand.icon
    ? `<img class="mark" src="${assetPrefix}assets/${escapeAttr(brand.icon.file)}" alt="${escapeAttr(brand.icon.alt || "")}" width="40" height="40" />`
    : "";

  const stores = (flow.stores || [])
    .map((name, i) => {
      const icon = ICONS[i % ICONS.length];
      return `<button type="button" class="store" aria-pressed="false">
      <span class="store-mark">${icon}</span>
      <span class="store-name">${escapeHtml(name)}</span>
      <span class="store-check" aria-hidden="true"></span>
    </button>`;
    })
    .join("");

  const roles = (flow.roles || [])
    .map((role) => {
      return `<button type="button" class="role" aria-pressed="false">
      <span class="role-title">${escapeHtml(role.title)}</span>
      <span class="role-body">${escapeHtml(role.body)}</span>
    </button>`;
    })
    .join("");

  const checks = (flow.checks || [])
    .map((item, i) => {
      return `<label class="check">
      <input type="checkbox" name="qualify_${i}" />
      <span>${escapeHtml(item)}</span>
    </label>`;
    })
    .join("");

  const lines = (flow.matchLines || [])
    .map((line, i) => {
      const hidden = i === 0 ? "" : " hidden";
      return `<p class="match-line" data-match-line${hidden}>${escapeHtml(line)}</p>`;
    })
    .join("");

  const showEarnings = campaign.showEarningsPotential === true && campaign.earningsSource;
  const pay = (flow.pay || [])
    .filter((item) => {
      const earnings = /earnings potential/i.test(item.label || "") || /\$40/.test(item.value || "");
      return showEarnings || !earnings;
    })
    .map((item) => {
      return `<article class="pay">
      <p class="pay-value">${escapeHtml(item.value)}</p>
      <div>
        <p class="pay-label">${escapeHtml(item.label)}</p>
        <p class="pay-detail">${escapeHtml(item.detail)}</p>
      </div>
    </article>`;
    })
    .join("");

  const faqs = (campaign.faq || [])
    .map((item) => {
      return `<details class="faq-card">
      <summary>${escapeHtml(item.q)}</summary>
      <p>${escapeHtml(item.a)}</p>
    </details>`;
    })
    .join("");

  const reassure = (flow.reassurance || [])
    .map((item) => `<li>${linkEmails(escapeHtml(item))}</li>`)
    .join("");

  return `<div class="icp">${escapeHtml(campaign.icp)}</div>
  <header class="wrap">
    <div class="lockup">
      ${mark}
      <img class="logo" src="${assetPrefix}assets/${escapeAttr(brand.logo.file)}" alt="${escapeAttr(brand.logo.alt)}" />
    </div>
  </header>
  <main class="flow" data-flow>
    <div class="wrap flow-top">
      <p class="flow-progress">Step <span data-progress-current>1</span> of 4 · <span data-progress-label>Stores</span></p>
      <div class="flow-bar" aria-hidden="true"><span data-progress-bar></span></div>
    </div>

    <section class="panel wrap" data-step="1" data-step-label="Stores">
      <h1>${escapeHtml(campaign.headline)}</h1>
      <p class="sub">${escapeHtml(campaign.subhead)}</p>
      <p class="prompt">${escapeHtml(flow.storesPrompt || "")}</p>
      <div class="store-list" role="group" aria-label="${escapeAttr(flow.storesPrompt || "Stores")}">${stores}</div>
      <button type="button" class="btn btn-block" data-continue disabled>${escapeHtml(flow.continueLabel || "")}</button>
      <p class="hint">Choose at least one store.</p>
    </section>

    <section class="panel wrap" data-step="2" data-step-label="Eligibility" hidden>
      <h2>${escapeHtml(flow.roleTitle || "")}</h2>
      <div class="role-list">${roles}</div>
      <fieldset class="checks">
        <legend>${escapeHtml(flow.checksLegend || "All three are required")}</legend>
        ${checks}
      </fieldset>
      <button type="button" class="btn btn-block" data-match disabled>${escapeHtml(flow.matchLabel || "")}</button>
      <p class="hint">Check every box to continue.</p>
      <button type="button" class="back" data-back="1">Back</button>
    </section>

    <section class="panel wrap match" data-step="3" data-step-label="Matching" hidden tabindex="-1">
      <div class="scan" aria-hidden="true">
        <div class="scan-shelves"><span></span><span></span><span></span><span></span></div>
        <div class="scan-beam"></div>
      </div>
      <div class="match-status" aria-live="polite" aria-atomic="true">
        ${lines}
        <p class="outcome" data-outcome hidden>${escapeHtml(flow.matchOutcome || "")}</p>
      </div>
    </section>

    <section class="panel wrap" data-step="4" data-step-label="Start" hidden>
      <p class="outcome outcome-inline">${escapeHtml(flow.matchOutcome || "")}</p>
      <div class="band band-pay">
        <h2>${escapeHtml(flow.payTitle || "")}</h2>
        <div class="pay-list">${pay}</div>
      </div>
      <div class="step-close">
        <div class="band band-faq">
          <h2>Questions</h2>
          <div class="flow-faq">${faqs}</div>
        </div>
        <div class="finale">
          <div class="finale-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5 9.2 17 19 7"/></svg>
          </div>
          <h2>${escapeHtml(flow.finalTitle || "")}</h2>
          <p class="sub">${escapeHtml(flow.finalBody || "")}</p>
          <figure class="qr-block">
            ${qrSvg(action.href || "")}
            <figcaption>Scan with your phone.</figcaption>
          </figure>
          <a class="btn" id="action" ${btnStyle} data-outbound href="${escapeAttr(action.href || "#")}" rel="noopener noreferrer">${escapeHtml(action.label || "")}</a>
          <ul class="reassure">${reassure}</ul>
        </div>
      </div>
      <button type="button" class="back" data-back="2">Back</button>
    </section>
    ${
      campaign.thankYou && campaign.thankYou.enabled
        ? `<section class="panel wrap thanks-step" data-step="thanks" data-step-label="Thanks" hidden>
      <h2>Thanks! Opening the app store…</h2>
      <a class="btn" ${btnStyle} data-store-link href="${escapeAttr(action.href || "#")}" rel="noopener noreferrer">Open the app store</a>
    </section>`
        : ""
    }
  </main>
  <footer class="wrap">
    <p>${escapeHtml(campaign.legal || "")}</p>
    <p>${home}${privacy}</p>
  </footer>`;
}

module.exports = { renderFlow };
