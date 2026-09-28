"use strict";

const fs = require("fs");
const path = require("path");
const { loadEnv } = require("../harness/load-env");
const { parseSafeHttpUrl } = require("../harness/urls");
const { contrast } = require("../harness/contrast");

const root = path.join(__dirname, "..");
const env = loadEnv(root);
const client = env.CLIENT || "_example";
const clientDir = path.join(root, "clients", client);
const MAX_HERO = 200 * 1024;
const MAX_LOGO = 40 * 1024;
const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function fail(msg) {
  console.error("preflight:", msg);
  process.exit(1);
}

function readJson(file) {
  if (!fs.existsSync(file)) fail("missing " + path.relative(root, file));
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    fail("invalid JSON " + path.relative(root, file) + ": " + err.message);
  }
}

if (!/^[A-Za-z0-9_-]+$/.test(client)) fail("CLIENT must be alphanumeric, dash, or underscore");
if (!fs.existsSync(clientDir)) fail("unknown CLIENT folder: clients/" + client);

const brand = readJson(path.join(clientDir, "brand.json"));
const campaign = readJson(path.join(clientDir, "campaign.json"));

if (!brand.name || !brand.colors || !brand.logo) fail("brand.json missing name/colors/logo");
for (const key of ["bg", "fg", "accent", "accentFg", "muted"]) {
  if (!HEX.test(brand.colors[key] || "")) fail("brand color " + key + " must be #hex");
}

const ctaText = contrast(brand.colors.accent, brand.colors.accentFg);
const ctaOnPage = contrast(brand.colors.accent, brand.colors.bg);
const bodyText = contrast(brand.colors.fg, brand.colors.bg);
if (ctaText < 4.5) {
  fail(
    "CTA unreadable: " +
      brand.colors.accentFg +
      " on " +
      brand.colors.accent +
      " is " +
      ctaText.toFixed(1) +
      ":1. Need 4.5:1. Change accentFg."
  );
}
if (ctaOnPage < 3) {
  fail(
    "CTA disappears into the page: accent " +
      brand.colors.accent +
      " on bg " +
      brand.colors.bg +
      " is " +
      ctaOnPage.toFixed(1) +
      ":1. Need 3:1."
  );
}
if (bodyText < 4.5) {
  fail("body text " + brand.colors.fg + " on " + brand.colors.bg + " is " + bodyText.toFixed(1) + ":1. Need 4.5:1.");
}

const logoPath = path.join(clientDir, "assets", brand.logo.file);
if (!fs.existsSync(logoPath)) fail("missing logo asset " + brand.logo.file);
if (fs.statSync(logoPath).size > MAX_LOGO) fail("logo exceeds 40kb");

const heroPath = path.join(clientDir, "assets", campaign.hero.file);
if (!campaign.hero || !fs.existsSync(heroPath)) fail("missing hero asset");
if (fs.statSync(heroPath).size > MAX_HERO) fail("hero exceeds 200kb \u2014 compress before shipping");

if (!campaign.headline || !campaign.primaryAction) fail("campaign missing headline or primaryAction");

const allowLocal = true;
if (campaign.primaryAction.type === "link") {
  try {
    parseSafeHttpUrl(campaign.primaryAction.href, { allowLocalhost: allowLocal });
  } catch (err) {
    fail("primaryAction.href " + err.message);
  }
}

if (env.FORM_ENDPOINT) {
  try {
    parseSafeHttpUrl(env.FORM_ENDPOINT, { allowLocalhost: allowLocal });
  } catch (err) {
    fail("FORM_ENDPOINT " + err.message);
  }
}

if (brand.privacyUrl) {
  try {
    parseSafeHttpUrl(brand.privacyUrl, { allowLocalhost: allowLocal });
  } catch (err) {
    fail("privacyUrl " + err.message);
  }
}

if (env.FORM_KEY && env.FORM_KEY.length < 16) fail("FORM_KEY should be at least 16 characters");

console.log("preflight ok \u2014 client=" + client);
