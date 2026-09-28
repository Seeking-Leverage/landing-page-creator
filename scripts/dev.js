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
const clientDir = path.join(root, "clients", client);
const port = Number(env.PORT || 4173);

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

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  if (url.pathname === "/" || url.pathname === "/index.html") {
    const brand = JSON.parse(fs.readFileSync(path.join(clientDir, "brand.json"), "utf8"));
    const campaign = JSON.parse(fs.readFileSync(path.join(clientDir, "campaign.json"), "utf8"));
    const html = render({ brand, campaign, env, assetPrefix: "/" });
    return send(res, 200, html, "text/html; charset=utf-8");
  }
  if (url.pathname === "/styles.css") {
    return send(res, 200, fs.readFileSync(path.join(root, "harness", "styles.css")), TYPES[".css"]);
  }
  if (url.pathname === "/client.js") {
    return send(res, 200, fs.readFileSync(path.join(root, "harness", "client.js")), TYPES[".js"]);
  }
  if (url.pathname.startsWith("/assets/")) {
    const name = path.basename(url.pathname);
    let file;
    try {
      file = resolveAsset(clientDir, name);
    } catch {
      return send(res, 404, "not found");
    }
    return send(res, 200, fs.readFileSync(file), TYPES[path.extname(name)] || "application/octet-stream");
  }
  send(res, 404, "not found");
});

server.listen(port, "127.0.0.1", () => {
  console.log("http://127.0.0.1:" + port + "  (client=" + client + ")");
});
