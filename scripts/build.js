"use strict";

const fs = require("fs");
const path = require("path");
const { loadEnv } = require("../harness/load-env");
const { render } = require("../harness/render");

const root = path.join(__dirname, "..");
const env = loadEnv(root);
const client = env.CLIENT || "_example";
const clientDir = path.join(root, "clients", client);
const dist = path.join(root, "dist");

const brand = JSON.parse(fs.readFileSync(path.join(clientDir, "brand.json"), "utf8"));
const campaign = JSON.parse(fs.readFileSync(path.join(clientDir, "campaign.json"), "utf8"));

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, "assets"), { recursive: true });

const html = render({ brand, campaign, env, assetPrefix: "" });
fs.writeFileSync(path.join(dist, "index.html"), html);
fs.copyFileSync(path.join(root, "harness", "styles.css"), path.join(dist, "styles.css"));
fs.copyFileSync(path.join(root, "harness", "client.js"), path.join(dist, "client.js"));

const assetsSrc = path.join(clientDir, "assets");
for (const file of fs.readdirSync(assetsSrc)) {
  fs.copyFileSync(path.join(assetsSrc, file), path.join(dist, "assets", file));
}

fs.writeFileSync(
  path.join(dist, "_headers"),
  `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' https://connect.facebook.net; connect-src 'self' https://www.facebook.com https://connect.facebook.net${env.FORM_ENDPOINT ? " " + env.FORM_ENDPOINT : ""}; frame-ancestors 'none'; base-uri 'none'; form-action 'self';
`
);

console.log("built dist/ for client=" + client);
