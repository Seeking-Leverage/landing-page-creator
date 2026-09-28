"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const { loadEnv } = require("../harness/load-env");
const { render } = require("../harness/render");
const { contrast } = require("../harness/contrast");

const root = path.join(__dirname, "..");

function fail(msg) {
  console.error("qa:", msg);
  process.exit(1);
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p)) || "";
}

function rgbToHex(rgb) {
  const m = String(rgb).match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
  if (!m) return null;
  return (
    "#" +
    m
      .slice(1, 4)
      .map((n) => Number(n).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

const chrome = findChrome();
if (!chrome) {
  fail("no browser. QA will not pass on source alone. Install Chrome or set CHROME_PATH.");
}

const env = loadEnv(root);
const client = env.CLIENT || "_example";
const clientDir = path.join(root, "clients", client);
const brand = JSON.parse(fs.readFileSync(path.join(clientDir, "brand.json"), "utf8"));
const campaign = JSON.parse(fs.readFileSync(path.join(clientDir, "campaign.json"), "utf8"));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-qa-"));
const html = render({ brand, campaign, env, assetPrefix: "" });
const probe = `<script>
window.addEventListener("load", function () {
  var nodes = Array.prototype.slice.call(document.querySelectorAll("a.btn, button[type=submit]"));
  var primary = document.querySelector("#action button[type=submit], #action a.btn") || nodes[0];
  var buttons = nodes.map(function (el) {
    var cs = getComputedStyle(el);
    return { text: (el.innerText || "").trim(), color: cs.color, background: cs.backgroundColor };
  });
  if (primary) primary.click();
  var status = document.getElementById("form-status");
  var out = {
    buttons: buttons,
    status: status ? status.textContent : "",
    thanks: document.body.classList.contains("is-thanks"),
    hash: location.hash
  };
  var pre = document.createElement("pre");
  pre.id = "qa-probe";
  pre.textContent = JSON.stringify(out);
  document.body.appendChild(pre);
});
</script>`;
fs.writeFileSync(path.join(dir, "index.html"), html.replace("</body>", probe + "</body>"));
fs.copyFileSync(path.join(root, "harness", "styles.css"), path.join(dir, "styles.css"));
fs.copyFileSync(path.join(root, "harness", "client.js"), path.join(dir, "client.js"));
fs.cpSync(path.join(clientDir, "assets"), path.join(dir, "assets"), { recursive: true });

const run = spawnSync(
  chrome,
  ["--headless=new", "--disable-gpu", "--no-sandbox", "--virtual-time-budget=4000", "--dump-dom", path.join(dir, "index.html")],
  { encoding: "utf8", timeout: 20000 }
);
fs.rmSync(dir, { recursive: true, force: true });
if (run.error) fail("browser failed to start: " + run.error.message);
const dom = (run.stdout || "") + (run.stderr || "");
const marker = dom.match(/<pre id="qa-probe">([\s\S]*?)<\/pre>/);
if (!marker) fail("browser did not run the button. QA cannot pass without that click.");
let report;
try {
  const quot = String.fromCharCode(38) + "quot;";
  const amp = String.fromCharCode(38) + "amp;";
  report = JSON.parse(
    marker[1].replace(new RegExp(quot, "g"), '"').replace(new RegExp(amp, "g"), String.fromCharCode(38))
  );
} catch (err) {
  fail("browser returned an unreadable button report");
}
if (!report.buttons.length) fail("no CTA button on the page");

for (const button of report.buttons) {
  if (!button.text) fail("CTA has no label");
  const fill = rgbToHex(button.background);
  const ink = rgbToHex(button.color);
  if (!fill || !ink) fail("could not read the CTA colors from the browser");
  const ratio = contrast(fill, ink);
  if (ratio < 4.5) {
    fail("clicked CTA is unreadable in the browser: " + ink + " on " + fill + " is " + ratio.toFixed(1) + ":1");
  }
  console.log("qa click \u2014 \"" + button.text + "\" " + ink + " on " + fill + " " + ratio.toFixed(1) + ":1");
}

const reacted =
  campaign.primaryAction.type === "form"
    ? Boolean(report.status) || report.thanks
    : report.hash === "#action";
if (!reacted) fail("the CTA click did nothing");
console.log("qa click \u2014 button responded");
