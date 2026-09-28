"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { loadEnv } = require("../harness/load-env");
const { render } = require("../harness/render");
const { contrast } = require("../harness/contrast");

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
const ctaRule = ".btn, button[type=\"submit\"]{background:var(--accent);color:var(--accent-fg)}";
if (linkAt < 0 || brandStyleAt < 0 || brandStyleAt < linkAt) {
  fail("brand colors must be applied after styles.css or the CTA keeps the previous brand");
}
if (!html.includes(ctaRule)) fail("CTA color rule missing from the page");

const c = brand.colors;
for (const [name, hex] of Object.entries(c)) {
  if (!html.toLowerCase().includes(String(hex).toLowerCase())) fail("rendered page is missing " + name + " " + hex);
}

const actions = html.split('id="action"').length - 1;
if (actions !== 1) fail("expected one #action, found " + actions);

const label = campaign.primaryAction.label;
const ctaCount = html.split(">" + label + "<").length - 1;
if (ctaCount < 1) fail("CTA label is not in the page");

if (campaign.primaryAction.type === "form") {
  if (!html.includes('name="website"')) fail("form is missing the honeypot");
  if (!html.includes('type="submit"')) fail("form is missing a submit button");
}

if (/javascript:/i.test(html)) fail("javascript: URL in the page");

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
