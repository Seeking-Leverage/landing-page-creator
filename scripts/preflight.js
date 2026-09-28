"use strict";

const fs = require("fs");
const path = require("path");
const { loadEnv } = require("../harness/load-env");
const { parseSafeHttpUrl } = require("../harness/urls");
const { contrast } = require("../harness/contrast");
const { validate } = require("../harness/schema");
const { resolveAsset } = require("../harness/assets");
const { pixelError } = require("../harness/pixels");

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

const brandSchema = JSON.parse(fs.readFileSync(path.join(root, "schemas", "brand.schema.json"), "utf8"));
const campaignSchema = JSON.parse(fs.readFileSync(path.join(root, "schemas", "campaign.schema.json"), "utf8"));
for (const err of validate(brand, brandSchema, "brand.json").concat(validate(campaign, campaignSchema, "campaign.json"))) {
  fail(err);
}

let logoPath;
let heroPath;
try {
  logoPath = resolveAsset(clientDir, brand.logo.file);
  heroPath = resolveAsset(clientDir, campaign.hero.file);
} catch (err) {
  fail(err.message);
}
if (fs.statSync(logoPath).size > MAX_LOGO) fail("logo exceeds 40kb");
if (fs.statSync(heroPath).size > MAX_HERO) fail("hero exceeds 200kb — compress before shipping");

const strict = process.argv.includes("--strict");
const allowLocal = !strict;

function checkUrl(label, value) {
  if (!value) return;
  try {
    parseSafeHttpUrl(value, { allowLocalhost: allowLocal });
  } catch (err) {
    fail(label + " " + err.message);
  }
}

if (campaign.primaryAction.type === "link") checkUrl("primaryAction.href", campaign.primaryAction.href);
checkUrl("FORM_ENDPOINT", env.FORM_ENDPOINT);
checkUrl("privacyUrl", brand.privacyUrl);
if (strict) checkUrl("PUBLIC_ORIGIN", env.PUBLIC_ORIGIN);

const reserved = new Set(["website", "fbclid", "gclid", "ttclid"]);
const seen = new Set();
for (const field of (campaign.primaryAction && campaign.primaryAction.fields) || []) {
  if (reserved.has(field.name) || String(field.name).startsWith("utm_")) {
    fail("field name " + field.name + " collides with a reserved field");
  }
  if (seen.has(field.name)) fail("duplicate field name " + field.name);
  seen.add(field.name);
}

for (const key of ["META_PIXEL_ID", "GOOGLE_ADS_ID", "GOOGLE_ADS_CONVERSION_LABEL", "GOOGLE_ADS_LEAD_LABEL", "TIKTOK_PIXEL_ID"]) {
  const problem = pixelError(key, env[key]);
  if (problem) fail(problem);
}

if (env.FORM_KEY && env.FORM_KEY.length < 16) fail("FORM_KEY should be at least 16 characters");
if (env.FORM_KEY) {
  console.log("preflight: FORM_KEY is server-only. The page never sends it. Allowlist the origin, rate-limit, and keep the honeypot.");
}

console.log("preflight ok — client=" + client + (strict ? " strict" : ""));
