const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { loadEnv } = require("../harness/load-env");
const { render } = require("../harness/render");
const { resolveAsset } = require("../harness/assets");
const { buildCsp, originOf } = require("../harness/csp");

const root = path.join(__dirname, "..");
const pre = spawnSync(process.execPath, [path.join("scripts", "preflight.js"), "--strict"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});
if (pre.status) process.exit(pre.status || 1);

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
fs.copyFileSync(path.join(root, "harness", "attribution.js"), path.join(dist, "attribution.js"));
fs.copyFileSync(path.join(root, "harness", "client.js"), path.join(dist, "client.js"));
if (campaign.thankYou && campaign.thankYou.enabled) {
  fs.mkdirSync(path.join(dist, "thanks"), { recursive: true });
  fs.writeFileSync(
    path.join(dist, "thanks", "index.html"),
    render({ brand, campaign, env, assetPrefix: "../" })
  );
}

for (const name of fs.readdirSync(path.join(clientDir, "assets"))) {
  const file = resolveAsset(clientDir, name);
  fs.copyFileSync(file, path.join(dist, "assets", path.basename(file)));
}

let formOrigin = "";
if (env.FORM_ENDPOINT) formOrigin = originOf(env.FORM_ENDPOINT);
const csp = buildCsp({
  meta: Boolean(env.META_PIXEL_ID),
  google: Boolean(env.GOOGLE_ADS_ID),
  tiktok: Boolean(env.TIKTOK_PIXEL_ID),
  appcast: Boolean(env.APPCAST_PIXEL_URL),
  formOrigin,
});

fs.writeFileSync(
  path.join(dist, "_headers"),
  `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=()
  Content-Security-Policy: ${csp}
`
);

console.log("built dist/ for client=" + client);
