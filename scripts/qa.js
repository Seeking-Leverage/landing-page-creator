"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { loadEnv } = require("../harness/load-env");
const { render } = require("../harness/render");
const { contrast } = require("../harness/contrast");
const { escapeHtml } = require("../harness/escape");

const root = path.join(__dirname, "..");
const pre = spawnSync(process.execPath, ["scripts/preflight.js"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});
if (pre.status) process.exit(pre.status || 1);

const env = loadEnv(root);
const client = env.CLIENT || "_example";
const clientDir = path.join(root, "clients", client);
const brand = JSON.parse(fs.readFileSync(path.join(clientDir, "brand.json"), "utf8"));
const campaign = JSON.parse(fs.readFileSync(path.join(clientDir, "campaign.json"), "utf8"));
const html = render({ brand, campaign, env, assetPrefix: "" });
const css = fs.readFileSync(path.join(root, "harness", "styles.css"), "utf8");

function fail(msg) {
  console.error("qa:", msg);
  process.exit(1);
}

const linkAt = html.indexOf('rel="stylesheet"');
const brandStyleAt = html.indexOf(":root{--bg:");
if (linkAt < 0 || brandStyleAt < 0 || brandStyleAt < linkAt) {
  fail("brand colors must be applied after styles.css or the CTA keeps the previous brand");
}
const c = brand.colors;
const painted = `background:${c.accent};color:${c.accentFg}`;
const paintedCount = html.split(painted).length - 1;
if (paintedCount < 1) fail("CTA is not painted with accent fill and accentFg text");
if ((html.match(/<button type="submit"|<a class="btn"/g) || []).length !== paintedCount) {
  fail("a button is missing its text color, so the label can disappear into the fill");
}

for (const [name, hex] of Object.entries(c)) {
  if (!html.toLowerCase().includes(String(hex).toLowerCase())) fail("rendered page is missing " + name + " " + hex);
}

const actions = html.split('id="action"').length - 1;
if (actions !== 1) fail("expected one #action, found " + actions);

const label = campaign.primaryAction.label;
const ctaCount = html.split(">" + escapeHtml(label) + "<").length - 1;
if (ctaCount < 1) fail("CTA label is not in the page");

if (campaign.primaryAction.type === "form") {
  if (!html.includes('name="website"')) fail("form is missing the honeypot");
  if (!html.includes('type="submit"')) fail("form is missing a submit button");
}

if (/javascript:/i.test(html)) fail("javascript: URL in the page");
if (/id="pid"|name="jid"/.test(html)) fail("page uses an id or name Appcast's pixel reads");

if (String(client).startsWith("hetal")) {
  if (html.includes("Match found!") || html.includes("You qualify for immediate onboarding.")) {
    fail("old qualification copy is still in the page");
  }
  if (/\$40\s*[–—-]\s*\$60/.test(html)) fail("earnings claim is still in the page");
  if (!html.includes("Next step: download the app to see audits available near you")) {
    fail("honest next-step line is missing");
  }
  if (html.includes("Checking retail coverage in your area") || html.includes("Verifying active Brand Analyst openings")) {
    fail("scan lines still imply a live coverage check");
  }
  if (!html.includes("Loading audit details…") || !html.includes("Almost done…")) {
    fail("scan lines are missing");
  }
  if (!html.includes("Thanks! Opening the app store")) fail("thank-you step is missing");
  if (!html.includes("Open the app store")) fail("thank-you fallback button is missing");
}

const exampleAccent = "#b8f26d";
if (client !== "_example" && c.accent.toLowerCase() !== exampleAccent && css.toLowerCase().includes(exampleAccent)) {
  fail("styles.css still hardcodes the example accent. That color will leak onto the CTA.");
}

const lines = [
  "qa ok \u2014 client=" + client,
  "  CTA text " + contrast(c.accent, c.accentFg).toFixed(1) + ":1",
  "  CTA on page " + contrast(c.accent, c.bg).toFixed(1) + ":1",
  "  body text " + contrast(c.fg, c.bg).toFixed(1) + ":1",
  "  brand colors win over the stylesheet",
  "  one action, label present",
];
console.log(lines.join("\n"));
console.log("  still look: phone width, headline matches the ad, logo is the real one");
