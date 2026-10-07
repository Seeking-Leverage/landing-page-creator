"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { loadEnv } = require("../harness/load-env");
const { render } = require("../harness/render");
const { pageConfig } = require("../harness/page-config");
const { inlineJson } = require("../harness/inline-json");

const root = path.join(__dirname, "..");
const env = loadEnv(root);
const client = env.CLIENT || "_example";
const clientDir = path.join(root, "clients", client);
const outDir = path.join(clientDir, "webflow");

function scopeSelector(selector) {
  let sel = selector.trim();
  if (!sel || sel.startsWith("@")) return sel;
  sel = sel.replace(/\bbody\.is-flow\b/g, ".hetal-flow");
  sel = sel.replace(/\bhtml\b/g, "");
  sel = sel.replace(/\bbody\b/g, ".hetal-flow");
  sel = sel.replace(/^:root\b/, ".hetal-flow");
  sel = sel.replace(/\s+/g, " ").replace(/\s+,/g, ",").replace(/,\s+/g, ",").trim();
  sel = sel.replace(/^,|,$/g, "").trim();
  if (!sel) return "";
  if (sel === ".hetal-flow" || sel.startsWith(".hetal-flow ") || sel.startsWith(".hetal-flow.") || sel.startsWith(".hetal-flow:") || sel.startsWith(".hetal-flow[")) {
    return sel;
  }
  return ".hetal-flow " + sel;
}

function scopeBlock(css) {
  let result = "";
  let i = 0;
  while (i < css.length) {
    while (i < css.length && /\s/.test(css[i])) {
      result += css[i];
      i++;
    }
    if (i >= css.length) break;
    const open = css.indexOf("{", i);
    if (open === -1) {
      result += css.slice(i);
      break;
    }
    const prelude = css.slice(i, open).trim();
    let depth = 1;
    let j = open + 1;
    while (j < css.length && depth) {
      if (css[j] === "{") depth++;
      else if (css[j] === "}") depth--;
      j++;
    }
    const body = css.slice(open + 1, j - 1);
    if (prelude.startsWith("@keyframes")) {
      result += prelude + "{" + body + "}";
    } else if (prelude.startsWith("@media") || prelude.startsWith("@supports")) {
      result += prelude + "{" + scopeBlock(body) + "}";
    } else {
      const scoped = prelude
        .split(",")
        .map(scopeSelector)
        .filter(Boolean)
        .join(",");
      if (scoped) result += scoped + "{" + body + "}";
    }
    i = j;
  }
  return result;
}

function scopeCss(css) {
  const renamed = css.replace(/shelf-scan/g, "hetal-shelf-scan");
  return scopeBlock(renamed);
}

function dataUri(file) {
  const buf = fs.readFileSync(file);
  return "data:image/png;base64," + buf.toString("base64");
}

function iconUri(file) {
  const tmp = path.join(require("os").tmpdir(), "hetal-app-icon-96.png");
  execFileSync("sips", ["-z", "96", "96", file, "--out", tmp], { stdio: "ignore" });
  return dataUri(tmp);
}

const brand = JSON.parse(fs.readFileSync(path.join(clientDir, "brand.json"), "utf8"));
const campaign = JSON.parse(fs.readFileSync(path.join(clientDir, "campaign.json"), "utf8"));
const html = render({ brand, campaign, env, assetPrefix: "" });
const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<script>\s*window\.__HARNESS__/);
if (!bodyMatch) {
  console.error("could not find the page body");
  process.exit(1);
}

const assets = path.join(clientDir, "assets");
const logoUri = dataUri(path.join(assets, brand.logo.file));
const markUri = brand.icon ? iconUri(path.join(assets, brand.icon.file)) : "";
let fragment = bodyMatch[1];
fragment = fragment.replaceAll('src="assets/' + brand.logo.file + '"', 'src="' + logoUri + '"');
if (brand.icon) {
  fragment = fragment.replaceAll('src="assets/' + brand.icon.file + '"', 'src="' + markUri + '"');
}
if (/src="assets\//.test(fragment)) {
  console.error("an image still points at a local asset");
  process.exit(1);
}

const embed = '<div class="hetal-flow">' + fragment.trim() + "</div>\n";
const css = fs.readFileSync(path.join(root, "harness", "styles.css"), "utf8");
const c = brand.colors;
const head =
  "<style>\n" +
  scopeCss(css) +
  "\n.hetal-flow{--bg:" +
  c.bg +
  ";--fg:" +
  c.fg +
  ";--accent:" +
  c.accent +
  ";--accent-fg:" +
  c.accentFg +
  ";--muted:" +
  c.muted +
  "}\n.hetal-flow .btn,.hetal-flow button[type=\"submit\"]{background:var(--accent);color:var(--accent-fg)}\n</style>\n";
const clientJs = fs.readFileSync(path.join(root, "harness", "client.js"), "utf8");
const attributionJs = fs.readFileSync(path.join(root, "harness", "attribution.js"), "utf8");
const footer =
  "<script>\nwindow.__HARNESS__ = " +
  inlineJson(pageConfig(campaign, env)) +
  ";\n" +
  attributionJs +
  "\n" +
  clientJs +
  "\n</script>\n";

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "head.html"), head);
fs.writeFileSync(path.join(outDir, "embed.html"), embed);
fs.writeFileSync(path.join(outDir, "footer.html"), footer);
fs.writeFileSync(
  path.join(outDir, "preview.html"),
  "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">" +
    head +
    "</head><body>" +
    embed +
    footer +
    "</body></html>\n"
);

function report(name, text) {
  const limit = 50000;
  console.log(name + " " + text.length + (text.length > limit ? " OVER 50000" : " ok"));
}
report("head", head);
report("embed", embed);
report("footer", footer);
console.log("wrote " + outDir);
