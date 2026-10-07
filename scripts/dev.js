"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const { loadEnv } = require("../harness/load-env");
const { render } = require("../harness/render");
const { resolveAsset } = require("../harness/assets");

const root = path.join(__dirname, "..");
const env = loadEnv(root);
const client = env.CLIENT || "_example";
const port = Number(env.PORT || 4173);

function clientDirFor(name) {
  if (!/^[A-Za-z0-9_-]+$/.test(name)) return null;
  const dir = path.join(root, "clients", name);
  if (!fs.existsSync(path.join(dir, "brand.json"))) return null;
  return dir;
}

function extraPages() {
  const file = path.join(root, "clients", "pages.json");
  if (!fs.existsSync(file)) return {};
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return {};
  }
  const pages = {};
  for (const [route, name] of Object.entries(data)) {
    if (!/^[A-Za-z0-9_-]+$/.test(route)) continue;
    if (!clientDirFor(name)) continue;
    pages[route] = name;
  }
  return pages;
}

function isDocument(pathname, base) {
  return (
    pathname === base ||
    pathname === base + "/" ||
    pathname === base + "/index.html" ||
    pathname === base + "/thanks" ||
    pathname === base + "/thanks/" ||
    pathname === base + "/thanks/index.html"
  );
}

function pageFor(pathname) {
  const pages = extraPages();
  for (const route of Object.keys(pages)) {
    const base = "/" + route;
    if (isDocument(pathname, base)) {
      return { name: pages[route], prefix: base + "/", asset: null };
    }
    if (pathname.startsWith(base + "/")) {
      return { name: pages[route], prefix: base + "/", asset: pathname.slice(base.length) };
    }
  }
  return null;
}

const TYPES = {
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".avif": "image/avif",
};

function send(res, status, body, type) {
  res.writeHead(status, {
    "Content-Type": type || "text/plain; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
  });
  res.end(body);
}

function sendPage(res, name, prefix) {
  const dir = clientDirFor(name);
  if (!dir) return send(res, 404, "not found");
  const brand = JSON.parse(fs.readFileSync(path.join(dir, "brand.json"), "utf8"));
  const campaign = JSON.parse(fs.readFileSync(path.join(dir, "campaign.json"), "utf8"));
  const html = render({ brand, campaign, env, assetPrefix: prefix });
  return send(res, 200, html, "text/html; charset=utf-8");
}

function sendAsset(res, dir, pathname) {
  if (pathname === "/styles.css") {
    return send(res, 200, fs.readFileSync(path.join(root, "harness", "styles.css")), TYPES[".css"]);
  }
  if (pathname === "/client.js") {
    return send(res, 200, fs.readFileSync(path.join(root, "harness", "client.js")), TYPES[".js"]);
  }
  if (pathname === "/attribution.js") {
    return send(res, 200, fs.readFileSync(path.join(root, "harness", "attribution.js")), TYPES[".js"]);
  }
  if (pathname.startsWith("/assets/")) {
    const name = path.basename(pathname);
    let file;
    try {
      file = resolveAsset(dir, name);
    } catch {
      return send(res, 404, "not found");
    }
    return send(res, 200, fs.readFileSync(file), TYPES[path.extname(name)] || "application/octet-stream");
  }
  return send(res, 404, "not found");
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  const extra = pageFor(url.pathname);
  if (extra) {
    if (!extra.asset) return sendPage(res, extra.name, extra.prefix);
    return sendAsset(res, clientDirFor(extra.name), extra.asset);
  }
  const dir = clientDirFor(client);
  if (isDocument(url.pathname, "") || url.pathname === "/") {
    return sendPage(res, client, "/");
  }
  if (dir) return sendAsset(res, dir, url.pathname);
  send(res, 404, "not found");
});

server.listen(port, "127.0.0.1", () => {
  console.log("http://127.0.0.1:" + port + "  (client=" + client + ")");
});
